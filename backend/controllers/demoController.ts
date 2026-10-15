/**
 * `POST /api/demo` (public): starts a demo (demo-access.md, Slice 1). Makes a throwaway demo
 * account with sample data and answers like a login, so the app opens a session at once.
 *
 * Checks, in this order: the demo gate (403 `demo_disabled`), the per-IP limit (429
 * `demo_rate_limited`), the live-demo cap (503 `demo_busy`). The cap check and the insert run under
 * one advisory lock, so parallel starts cannot pass the cap together. The duration and the word/tag
 * caps are frozen on the new row (D7); the live cap is read on each start (D15).
 */
const asyncHandler = require("express-async-handler");
const { randomUUID } = require("crypto");
const { sql }: typeof import("drizzle-orm") = require("drizzle-orm");
const { db }: typeof import("../src/db") = require("../src/db");
const { users }: typeof import("../src/db/schema") = require("../src/db/schema");
const { getAccessSettings }: typeof import("../lib/accessGate") = require("../lib/accessGate");
const { countLiveDemos, DemoError, DEMO_CODE, takeDemoStart }: typeof import("../lib/demo") = require("../lib/demo");
const { seedDemoData, SEED_COUNTS }: typeof import("../lib/demoSeed") = require("../lib/demoSeed");
const { termsAcceptance }: typeof import("../lib/terms") = require("../lib/terms");
const { withStatus }: typeof import("../lib/adminRequest") = require("../lib/adminRequest");
const { serializeLoginUser, isSupportedLanguage, parseThemeInput }: typeof import("./userController") =
  require("./userController");

const ALL_LANGUAGES = ["English", "Spanish", "German", "Estonian"];
/** Any fixed number: it only has to be the same for every demo start. */
const DEMO_START_LOCK = 734001;

const startDemo = asyncHandler(async (req: any, res: any) => {
  const user = await withStatus(res, async () => {
    const { demo } = await getAccessSettings();
    if (!demo.enabled) throw new DemoError(403, DEMO_CODE.disabled, "The demo is off");
    if (!takeDemoStart(req.ip ?? "unknown")) {
      throw new DemoError(429, DEMO_CODE.rateLimited, "Too many demos from this network. Try again later.");
    }

    // The app's UI language (a label, like login sends) becomes the native language and comes first
    // in the list. All four languages are on, and none is the default "primary" one.
    const uiLanguage = isSupportedLanguage(req.body?.uiLanguage) ? req.body.uiLanguage : "English";
    const languages = [uiLanguage, ...ALL_LANGUAGES.filter((l) => l !== uiLanguage)];
    const themeResult = parseThemeInput(req.body?.theme);
    const theme = themeResult.ok ? themeResult.theme : null;

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
          nativeLanguage: uiLanguage,
          theme,
          verified: true,
          // The /demo page shows the Terms note before the click (D12).
          ...termsAcceptance(now),
          isDemo: true,
          demoExpiresAt: new Date(now.getTime() + demo.durationMinutes * 60_000),
          demoWordLimit: SEED_COUNTS.words + demo.maxWords,
          demoTagLimit: SEED_COUNTS.tags + demo.maxTags,
        })
        .returning();
      await seedDemoData(tx, created.id);
      return created;
    });
  });

  res.status(201).json(serializeLoginUser(user));
});

export = { startDemo };
