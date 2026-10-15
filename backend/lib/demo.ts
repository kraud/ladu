/**
 * Demo access (.context/plans/demo-access.md): helpers for the ephemeral demo accounts.
 *
 * - `countLiveDemos`: the demos running now, for the live cap (D15) and the admin tab.
 * - `DemoError` and `DEMO_CODE`: the refusals, with a stable `code` the learner app translates.
 * - `takeDemoStart`: the per-IP limit on `POST /api/demo`. In memory only: an IP is never
 *   written to the database or to a log.
 * - `isDemoExpired`: the expiry check `protect` runs on every request.
 * - `assertNotDemo`: the refusal of an action a demo may not take (D10).
 * - `assertDemoVisibility`: a demo's tags are always Private (D10 b).
 * - `assertDemoRoom`: the word and tag caps on every create and clone path (D3, D11).
 */
const { and, count, eq, gt, sql } = require("drizzle-orm");
const { db }: typeof import("../src/db") = require("../src/db");
const { users, words, tags } = require("../src/db/schema");
const { HttpError }: typeof import("./httpError") = require("./httpError");

/** Both `db` and a transaction can run the count. */
export type DemoExecutor = Pick<typeof db, "select">;

/**
 * The demos that are live now: demo accounts that have not expired. The template (no expiry) is
 * not counted, and an expired demo stops counting at once, before the purge deletes it.
 * Uses the partial index `users_demo_expires_idx`.
 */
export const countLiveDemos = async (executor: DemoExecutor = db): Promise<number> => {
  const [row] = await executor
    .select({ value: count() })
    .from(users)
    .where(and(eq(users.isDemo, true), gt(users.demoExpiresAt, sql`now()`)));
  return Number(row?.value ?? 0);
};

/** Machine-readable codes. The learner app maps them to translated messages. */
export const DEMO_CODE = {
  disabled: "demo_disabled",
  rateLimited: "demo_rate_limited",
  busy: "demo_busy",
  restricted: "demo_restricted",
  wordLimit: "demo_word_limit",
  tagLimit: "demo_tag_limit",
} as const;

/** A demo refusal: an HTTP status plus an `apiCode` that the error middleware sends as `code`. */
export class DemoError extends HttpError {
  constructor(
    status: number,
    readonly apiCode: string,
    message: string,
  ) {
    super(status, message);
  }
}

const RESTRICTED_MESSAGE = "This is not available in the demo";

/**
 * Refuses an action that a demo account may not take (D10): 403 with `demo_restricted`. Puts the
 * status on `res` (the shared error handler reads it) and throws. The UI hides these actions for
 * a demo; this is the boundary.
 */
export const assertNotDemo = (user: { isDemo?: boolean | null } | undefined, res: any): void => {
  if (!user?.isDemo) return;
  res.status(403);
  throw new DemoError(403, DEMO_CODE.restricted, RESTRICTED_MESSAGE);
};

/** The only tag visibility a demo may use (D10 b): a real user can never see or follow a demo's tag. */
export const assertDemoVisibility = (user: { isDemo?: boolean | null } | undefined, visibility: unknown, res: any): void => {
  if (visibility !== "Private") assertNotDemo(user, res);
};

/** What a demo account carries for the cap checks (`req.user`, loaded by `protect`). */
export interface DemoCapUser {
  id: string;
  isDemo?: boolean | null;
  demoWordLimit?: number | null;
  demoTagLimit?: number | null;
}

/**
 * Refuses a create or clone that would take a demo past its word or tag cap (D3, D11): 403
 * `demo_word_limit` / `demo_tag_limit`, and nothing of the request is written. Call it inside the
 * transaction that writes, before the writes: it locks the demo's `users` row, so two parallel
 * requests take turns and cannot pass the cap together (Review log S2-5). The caps are absolute
 * (seed + configured maximum), frozen on the row when the demo started (D7). A normal account: no-op.
 */
export const assertDemoRoom = async (
  tx: Pick<typeof db, "select">,
  user: DemoCapUser | undefined,
  add: { words?: number; tags?: number },
  res: any,
): Promise<void> => {
  if (!user?.isDemo) return;
  await tx.select({ id: users.id }).from(users).where(eq(users.id, user.id)).for("update");

  if (add.words) {
    const [row] = await tx.select({ value: count() }).from(words).where(eq(words.userId, user.id));
    if (Number(row?.value ?? 0) + add.words > (user.demoWordLimit ?? 0)) {
      res.status(403);
      throw new DemoError(403, DEMO_CODE.wordLimit, "The demo cannot have more words");
    }
  }
  if (add.tags) {
    const [row] = await tx.select({ value: count() }).from(tags).where(eq(tags.authorId, user.id));
    if (Number(row?.value ?? 0) + add.tags > (user.demoTagLimit ?? 0)) {
      res.status(403);
      throw new DemoError(403, DEMO_CODE.tagLimit, "The demo cannot have more tags");
    }
  }
};

/** True for a live demo session whose time is over. The template (no expiry) and normal users: false. */
export const isDemoExpired = (
  user: { isDemo: boolean; demoExpiresAt: Date | null },
  now: Date = new Date(),
): boolean => user.isDemo && user.demoExpiresAt !== null && user.demoExpiresAt <= now;

// --- Per-IP limit on demo starts (Review log S1-1) -----------------------------------------------

const START_WINDOW_MS = 60 * 60 * 1000;
const DEFAULT_STARTS_PER_IP = 5;
/** Above this many entries, the expired ones are removed before a new one is added. */
const PRUNE_ABOVE = 1000;

/** `DEMO_STARTS_PER_IP` (a whole number ≥ 1) or the default. Read on each call, so a test can change it. */
const startsPerIp = (): number => {
  const value = Number(process.env.DEMO_STARTS_PER_IP);
  return Number.isInteger(value) && value >= 1 ? value : DEFAULT_STARTS_PER_IP;
};

/** IP → the starts in its current one-hour window. Memory only; a restart clears it, which is acceptable. */
const startsByIp = new Map<string, { windowStart: number; count: number }>();

/**
 * Counts one demo start for this IP. Returns false when the IP has used all its starts in the
 * current window (a fixed window of one hour from its first start).
 */
export const takeDemoStart = (ip: string, now: number = Date.now()): boolean => {
  if (startsByIp.size > PRUNE_ABOVE) {
    for (const [key, entry] of startsByIp) if (now - entry.windowStart >= START_WINDOW_MS) startsByIp.delete(key);
  }

  const entry = startsByIp.get(ip);
  if (!entry || now - entry.windowStart >= START_WINDOW_MS) {
    startsByIp.set(ip, { windowStart: now, count: 1 });
    return true;
  }
  if (entry.count >= startsPerIp()) return false;
  entry.count += 1;
  return true;
};

/** For tests only: forget every IP. */
export const resetDemoStartLimiter = (): void => startsByIp.clear();
