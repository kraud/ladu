/**
 * Account access rules shared by both logins and `protect` (admin-dashboard.md
 * slice 1): who may sign in, and what we record when they do.
 */
const { db }: typeof import("../src/db") = require("../src/db");
const { users, loginEvents }: typeof import("../src/db/schema") = require("../src/db/schema");
const { eq }: typeof import("drizzle-orm") = require("drizzle-orm");

type AccessFields = { bannedAt: Date | null; deletedAt: Date | null };

/**
 * Why an account may not sign in, or null if it may. A deleted account wins
 * over a banned one: to the user it must look like the account is gone.
 */
const accountBlock = (user: AccessFields): "deleted" | "banned" | null => {
  if (user.deletedAt) return "deleted";
  if (user.bannedAt) return "banned";
  return null;
};

/**
 * Two-letter country code from Cloudflare's `CF-IPCountry` header, or null.
 * We store the country only, never the IP. Cloudflare sends "XX" (unknown)
 * and "T1" (Tor); both mean "no useful country", so they become null.
 * The header is absent in local dev.
 */
const countryFromRequest = (req: { headers: Record<string, unknown> }): string | null => {
  const raw = req.headers["cf-ipcountry"];
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code) || code === "XX" || code === "T1") return null;
  return code;
};

/** Writes `users.last_login_*` and one `login_events` row for a successful login. */
const recordLogin = async (
  userId: string,
  method: "password" | "google",
  req: { headers: Record<string, unknown> },
) => {
  const country = countryFromRequest(req);
  const now = new Date();
  await db.update(users).set({ lastLoginAt: now, lastLoginCountry: country }).where(eq(users.id, userId));
  await db.insert(loginEvents).values({ userId, method, country, createdAt: now });
};

export = { accountBlock, countryFromRequest, recordLogin };
