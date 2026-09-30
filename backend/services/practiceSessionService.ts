/**
 * Practice Session Service — the database side of saved practice sessions.
 * Spec: .context/plans/phase-5-5-saved-practice.md §3 (D2–D9) and §5.
 *
 * Rules kept here:
 *  - Every query filters by the user id from the token. A row of another user looks
 *    the same as a missing row (`null` / `false`), so the API answers 404.
 *  - Expiry is checked on every read (`expires_at > now()`) and expired rows are
 *    deleted on every write. No timer or cron job.
 *  - `create` keeps at most `MAX_SAVED_SESSIONS` rows: it deletes the oldest ones first.
 *    It runs in a transaction behind a per-user advisory lock, so two saves at the same
 *    time cannot both pass the count check.
 *  - `update` does not count toward the limit and starts a new expiry period.
 *  - The database clock (`now()`) decides everything, never the app clock.
 */

const { db }: typeof import('../src/db') = require('../src/db');
const { practiceSessions }: typeof import('../src/db/schema') = require('../src/db/schema');
const { and, asc, desc, eq, gt, inArray, lte, sql } = require('drizzle-orm');
const { MAX_SAVED_SESSIONS, SESSION_TTL_DAYS }: typeof import('./exercises') = require('./exercises');

import type { SessionRequest, SessionSummary } from './exercises';

type SessionRow = typeof practiceSessions.$inferSelect;

export interface PracticeSessionListItem {
    id: string;
    summary: SessionSummary;
    createdAt: Date;
    updatedAt: Date;
    expiresAt: Date;
}

export interface PracticeSessionDto extends PracticeSessionListItem {
    snapshot: Record<string, unknown>;
}

const expiresAtExpression = sql`now() + make_interval(days => ${SESSION_TTL_DAYS})`;

const toListItem = (row: SessionRow): PracticeSessionListItem => ({
    id: row.id,
    summary: row.summary as SessionSummary,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    expiresAt: row.expiresAt,
});

const toDto = (row: SessionRow): PracticeSessionDto => ({
    ...toListItem(row),
    snapshot: row.snapshot as Record<string, unknown>,
});

/** Newest first: the session saved or updated last is the first one the user sees. */
export async function listSessions(userId: string): Promise<PracticeSessionListItem[]> {
    const rows: SessionRow[] = await db
        .select()
        .from(practiceSessions)
        .where(and(eq(practiceSessions.userId, userId), gt(practiceSessions.expiresAt, sql`now()`)))
        .orderBy(desc(practiceSessions.updatedAt), desc(practiceSessions.id));
    return rows.map(toListItem);
}

export async function getSession(userId: string, id: string): Promise<PracticeSessionDto | null> {
    const [row]: SessionRow[] = await db
        .select()
        .from(practiceSessions)
        .where(
            and(
                eq(practiceSessions.id, id),
                eq(practiceSessions.userId, userId),
                gt(practiceSessions.expiresAt, sql`now()`),
            ),
        )
        .limit(1);
    return row ? toDto(row) : null;
}

/** Saves a new session; the oldest ones go when the limit is reached. */
export async function createSession(userId: string, input: SessionRequest): Promise<PracticeSessionDto> {
    return db.transaction(async (tx: any) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'practice_sessions:' + userId}))`);

        await tx
            .delete(practiceSessions)
            .where(and(eq(practiceSessions.userId, userId), lte(practiceSessions.expiresAt, sql`now()`)));

        // Room for the new one: keep the newest (limit - 1) rows, delete the rest.
        const rows: Array<{ id: string }> = await tx
            .select({ id: practiceSessions.id })
            .from(practiceSessions)
            .where(eq(practiceSessions.userId, userId))
            .orderBy(asc(practiceSessions.updatedAt), asc(practiceSessions.id));
        const surplus = rows.length - (MAX_SAVED_SESSIONS - 1);
        if (surplus > 0) {
            const oldest = rows.slice(0, surplus).map((row) => row.id);
            await tx
                .delete(practiceSessions)
                .where(and(eq(practiceSessions.userId, userId), inArray(practiceSessions.id, oldest)));
        }

        const [created]: SessionRow[] = await tx
            .insert(practiceSessions)
            .values({
                userId,
                snapshot: input.snapshot,
                summary: input.summary,
                expiresAt: expiresAtExpression,
            })
            .returning();
        return toDto(created);
    });
}

/** Replaces snapshot and summary and starts a new expiry period. `null` when the row is gone or expired. */
export async function updateSession(
    userId: string,
    id: string,
    input: SessionRequest,
): Promise<PracticeSessionDto | null> {
    return db.transaction(async (tx: any) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'practice_sessions:' + userId}))`);

        await tx
            .delete(practiceSessions)
            .where(and(eq(practiceSessions.userId, userId), lte(practiceSessions.expiresAt, sql`now()`)));

        const [row]: SessionRow[] = await tx
            .update(practiceSessions)
            .set({
                snapshot: input.snapshot,
                summary: input.summary,
                expiresAt: expiresAtExpression,
                updatedAt: sql`now()`,
            })
            .where(and(eq(practiceSessions.id, id), eq(practiceSessions.userId, userId)))
            .returning();
        return row ? toDto(row) : null;
    });
}

/** `true` when a row was deleted. An expired row counts as gone only after the next write cleaned it. */
export async function deleteSession(userId: string, id: string): Promise<boolean> {
    const deleted = await db
        .delete(practiceSessions)
        .where(and(eq(practiceSessions.id, id), eq(practiceSessions.userId, userId)))
        .returning({ id: practiceSessions.id });
    return deleted.length > 0;
}
