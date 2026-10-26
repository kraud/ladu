/**
 * `POST /api/demo` (public): starts a demo (demo-access.md, Slice 1). Makes a throwaway demo
 * account with sample data and answers like a login, so the app opens a session at once.
 *
 * Checks, in this order: the demo gate (403 `demo_disabled`), the language choice (400
 * `demo_invalid_languages`, D16), the captcha (400 `captcha_failed`, 503 `captcha_unavailable`;
 * captcha.md C9), the per-IP limit (429 `demo_rate_limited`), the live-demo cap
 * (503 `demo_busy`). The sample data is a copy of the
 * template user (`lib/demoTemplate.ts`); with no template, 503 `demo_unavailable` and nothing is kept. The cap check and the insert run under
 * one advisory lock, so parallel starts cannot pass the cap together. The duration and the word/tag
 * caps are frozen on the new row (D7); the live cap is read on each start (D15).
 */
const asyncHandler = require("express-async-handler");
const { randomUUID } = require("crypto");
const { eq, sql }: typeof import("drizzle-orm") = require("drizzle-orm");
const { db }: typeof import("../src/db") = require("../src/db");
const { users }: typeof import("../src/db/schema") = require("../src/db/schema");
const { getAccessSettings }: typeof import("../lib/accessGate") = require("../lib/accessGate");
const { countLiveDemos, DemoError, DEMO_CODE, takeDemoStart }: typeof import("../lib/demo") = require("../lib/demo");
const { cloneDemoTemplate }: typeof import("../lib/demoTemplate") = require("../lib/demoTemplate");
const { isCountedRefusal, recordDemoRefusal, recordDemoStart }: typeof import("../lib/demoStats") = require("../lib/demoStats");
const { assertCaptcha }: typeof import("../lib/captcha") = require("../lib/captcha");
const { HttpError }: typeof import("../lib/httpError") = require("../lib/httpError");
const { termsAcceptance }: typeof import("../lib/terms") = require("../lib/terms");
const { withStatus }: typeof import("../lib/adminRequest") = require("../lib/adminRequest");
const { serializeLoginUser, isSupportedLanguage, normalizeLanguageSelection, parseThemeInput }: typeof import("./userController") =
  require("./userController");

const { LANGUAGE_NAMES: ALL_LANGUAGES }: typeof import("../lib/languages") = require("../lib/languages");
/** Any fixed number: it only has to be the same for every demo start. */
const DEMO_START_LOCK = 734001;

const startDemo = asyncHandler(async (req: any, res: any) => {
  const user = await withStatus(res, () => countRefusal(() => createDemo(req)));
  res.status(201).json(serializeLoginUser(user));
});

/**
 * Counts a refused start for the admin statistics (D20), then lets the refusal go on. A failed count
 * is logged and does not change the answer.
 */
const countRefusal = async <T>(start: () => Promise<T>): Promise<T> => {
  try {
    return await start();
  } catch (error) {
    const code = (error as { apiCode?: unknown }).apiCode;
    if (error instanceof HttpError && isCountedRefusal(code)) {
      await recordDemoRefusal(code).catch((e: unknown) => console.error("Could not count a demo refusal:", e));
    }
    throw error;
  }
};

const createDemo = async (req: any) => {
  const { demo } = await getAccessSettings();
  if (!demo.enabled) throw new DemoError(403, DEMO_CODE.disabled, "The demo is off");

  // The app's UI language is a label, like login sends.
  const uiLanguage = isSupportedLanguage(req.body?.uiLanguage) ? req.body.uiLanguage : "English";
  // The languages the visitor picked on /demo (D16), with the registration rules (≥ 2, in the
  // order picked). With none sent, all four, the UI language first: no language is "primary".
  let languages: string[];
  if (req.body?.languages === undefined) {
    languages = [uiLanguage, ...ALL_LANGUAGES.filter((l) => l !== uiLanguage)];
  } else {
    const picked = normalizeLanguageSelection(req.body.languages);
    if (!picked.ok) throw new DemoError(400, DEMO_CODE.invalidLanguages, picked.message);
    languages = picked.languages;
  }
  // The native language: the UI language when it was picked, else the first pick (D16).
  const nativeLanguage = languages.includes(uiLanguage) ? uiLanguage : languages[0];
  const themeResult = parseThemeInput(req.body?.theme);
  const theme = themeResult.ok ? themeResult.theme : null;
  // The captcha comes before the IP limit: a bot must not use up a real visitor's starts. The demo
  // refuses when Cloudflare cannot be reached (captcha.md C6).
  await assertCaptcha(req, "demo", { onUnreachable: "refuse" });
  // A bad request does not use one of the visitor's starts: the limit comes after the checks above.
  if (!takeDemoStart(req.ip ?? "unknown")) {
    throw new DemoError(429, DEMO_CODE.rateLimited, "Too many demos from this network. Try again later.");
  }

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${DEMO_START_LOCK})`);
    if ((await countLiveDemos(tx)) >= demo.maxLive) {
      throw new DemoError(503, DEMO_CODE.busy, "Too many demos are running. Try again in a few minutes.");
    }

    const id = randomUUID();
    const now = new Date();
    const [created] = await tx
      .insert(users)
      .values({
        id,
        name: "Demo",
        username: `demo-${id}`,
        // `.invalid` is reserved (RFC 2606): no mail can ever reach it.
        email: `demo+${id}@ladu.invalid`,
        password: null,
        languages,
        uiLanguage,
        nativeLanguage,
        theme,
        verified: true,
        // The /demo page shows the Terms note before the click (D12).
        ...termsAcceptance(now),
        isDemo: true,
        demoExpiresAt: new Date(now.getTime() + demo.durationMinutes * 60_000),
      })
      .returning();

    const seeded = await cloneDemoTemplate(tx, created.id, now, languages);
    if (!seeded) {
      // The transaction rolls back: no demo account without its sample data.
      console.error("Demo start refused: no demo template. Run `node scripts/seed-demo-template.js` (backend).");
      throw new DemoError(503, DEMO_CODE.unavailable, "The demo is not available right now");
    }

    // The caps count on top of the sample data (D3), frozen now (D7).
    const [withLimits] = await tx
      .update(users)
      .set({ demoWordLimit: seeded.words + demo.maxWords, demoTagLimit: seeded.tags + demo.maxTags })
      .where(eq(users.id, created.id))
      .returning();
    // The start log for the admin statistics (D19, D20). It stays after the purge.
    await recordDemoStart(tx, {
      userId: created.id,
      startedAt: now,
      expiresAt: created.demoExpiresAt as Date,
      uiLanguage,
      languages,
      seedWords: seeded.words,
      seedTags: seeded.tags,
      seedConfigs: seeded.configs,
      wordLimit: withLimits.demoWordLimit as number,
      tagLimit: withLimits.demoTagLimit as number,
    });
    return withLimits;
  });
};

export = { startDemo };
