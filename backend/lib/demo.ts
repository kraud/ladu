/**
 * Demo access (.context/plans/demo-access.md): helpers for the ephemeral demo accounts.
 * Slice 0 holds only the live count; the bootstrap, the restrictions and the caps join it in
 * Slices 1 and 2.
 */
const { and, count, eq, gt, sql } = require("drizzle-orm");
const { db }: typeof import("../src/db") = require("../src/db");
const { users } = require("../src/db/schema");

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
