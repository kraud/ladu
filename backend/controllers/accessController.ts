const asyncHandler = require("express-async-handler");
const Sentry = require("@sentry/node");
const { eq, sql } = require("drizzle-orm");
const { db }: typeof import("../src/db") = require("../src/db");
const { accessRequests, registrationInvites, loginAllowedUsers, users, auditLog } = require("../src/db/schema");
const { getAccessSettings, normalizeInviteEmail }: typeof import("../lib/accessGate") = require("../lib/accessGate");
const { captchaKeys, assertCaptcha }: typeof import("../lib/captcha") = require("../lib/captcha");
const { AccessRequestError, MAX_PENDING_REQUESTS }: typeof import("../lib/accessRequests") = require("../lib/accessRequests");
const { withStatus }: typeof import("../lib/adminRequest") = require("../lib/adminRequest");
const sendMail = require("../utils/sendEmail");
import type { AccessRequestKind } from "../lib/accessRequests";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 255;

/**
 * `GET /api/access` (public) — feeds the banners in the learner app. Only the mode and
 * the owner's extra line; never a list of invites or allowed accounts. The server
 * enforces the gates itself, so a banner is a courtesy. `demo.enabled` tells the
 * `/demo` page whether to show the start button; the caps stay private. `onboarding.enabled`
 * tells the app whether to open /onboarding for a `pending` account (onboarding.md D26).
 * `captcha` carries the public Turnstile site key, and only while the check is really on: the
 * switch is on AND both keys are set (captcha.md C3, C4). The secret key never leaves the server.
 */
const getAccess = asyncHandler(async (_req: any, res: any) => {
  const settings = await getAccessSettings();
  const keys = captchaKeys();
  // A change must show at once: no browser or proxy caching.
  res.set("Cache-Control", "no-store");
  res.json({
    registration: { mode: settings.registrationMode, note: settings.registrationNote },
    login: { mode: settings.loginMode, note: settings.loginNote },
    demo: { enabled: settings.demo.enabled },
    onboarding: { enabled: settings.onboarding.enabled },
    captcha: settings.captcha.enabled && keys ? { enabled: true, siteKey: keys.siteKey } : { enabled: false },
  });
});

/** The "no address set" warning goes to the log once per start, not on every request. */
let warnedNoNotifyAddress = false;

/**
 * Is a request useless? Then the route answers as if it was saved, and saves nothing. The answer
 * must never tell whether an email has an account or is on a list (access-requests.md).
 */
const isRequestUseless = async (email: string, kind: AccessRequestKind): Promise<boolean> => {
  const [account] = await db
    .select({ id: users.id, bannedAt: users.bannedAt, deletedAt: users.deletedAt })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);

  if (kind === "registration") {
    if (account) return true;
    const [invite] = await db.select({ id: registrationInvites.id }).from(registrationInvites).where(eq(registrationInvites.email, email)).limit(1);
    return Boolean(invite);
  }

  // `login`: the owner can only allow an account that exists, is not deleted, and is not banned.
  if (!account || account.deletedAt || account.bannedAt) return true;
  const [allowed] = await db.select({ userId: loginAllowedUsers.userId }).from(loginAllowedUsers).where(eq(loginAllowedUsers.userId, account.id)).limit(1);
  return Boolean(allowed);
};

/**
 * `POST /api/access/request` (public) — `{ email, hasAccount, captchaToken? }`. A visitor asks for
 * access while a gate is limited or closed. `hasAccount` sets the kind: `login` or `registration`.
 * Order: input, captcha (refuses when Cloudflare is down: this route sends mail), the gate (409
 * `access_not_needed` when open), then the useless cases and the cap (all answer the same 202 and
 * save nothing), then the row and its audit row in one transaction. One mail to the team for each
 * NEW request, after the commit.
 */
const requestAccess = asyncHandler(async (req: any, res: any) => {
  const { email: rawEmail, hasAccount } = req.body ?? {};
  const email = typeof rawEmail === "string" ? normalizeInviteEmail(rawEmail) : "";
  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    res.status(400);
    throw new Error("Enter a valid email address");
  }
  if (typeof hasAccount !== "boolean") {
    res.status(400);
    throw new Error("hasAccount must be true or false");
  }
  const kind: AccessRequestKind = hasAccount ? "login" : "registration";

  const created = await withStatus(res, async () => {
    await assertCaptcha(req, "access_request", { onUnreachable: "refuse" });

    const settings = await getAccessSettings();
    const mode = kind === "login" ? settings.loginMode : settings.registrationMode;
    if (mode === "open") throw new AccessRequestError(409, "access_not_needed", "Access is open, so a request is not needed");

    if (await isRequestUseless(email, kind)) return false;

    return db.transaction(async (tx) => {
      const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(accessRequests).where(eq(accessRequests.kind, kind));
      if (count >= MAX_PENDING_REQUESTS) {
        Sentry.captureMessage(`The ${kind} access request list is full (${MAX_PENDING_REQUESTS}): a request was not saved`, "warning");
        return false;
      }
      // The unique pair decides a repeat or a race: what it refuses was already asked.
      const [row] = await tx.insert(accessRequests).values({ email, kind }).onConflictDoNothing().returning({ id: accessRequests.id });
      if (!row) return false;
      await tx.insert(auditLog).values({
        staffId: null,
        action: "access.request_create",
        targetType: "access_request",
        targetId: row.id,
        metadata: { email, kind },
      });
      return true;
    });
  });

  if (created) {
    const to = process.env.ACCESS_REQUEST_EMAIL?.trim();
    if (!to) {
      if (!warnedNoNotifyAddress) {
        warnedNoNotifyAddress = true;
        console.warn("ACCESS_REQUEST_EMAIL is not set: access requests are saved, but no email goes to the team.");
      }
    } else {
      // After the commit. A failed send is logged and does not change the answer.
      await sendMail({ email: to, requestEmail: email, kind, type: "accessRequest", language: "English" }).catch((error: unknown) =>
        console.error("Failed to send access request email:", error),
      );
    }
  }

  res.status(202).json({ received: true });
});

export = { getAccess, requestAccess };
