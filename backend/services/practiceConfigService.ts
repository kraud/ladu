/**
 * Practice Config Service — the database side of saved practice configurations.
 * Spec: .context/plans/phase-5-5-saved-practice.md.
 *
 * Security rule: every query filters by the user id from the token. A row of
 * another user looks the same as a missing row (`null`), so the API answers 404.
 */

const { db }: typeof import('../src/db') = require('../src/db');
const { practiceConfigs, words }: typeof import('../src/db/schema') = require('../src/db/schema');
const { and, desc, eq, inArray, sql } = require('drizzle-orm');
const { visibleWordCondition }: typeof import('./exerciseService') = require('./exerciseService');
const { fetchWordsWithRelations }: typeof import('./wordService') = require('./wordService');

import type { ConfigRequest } from './exercises';
import type { WordResponse } from './wordService';

export interface PracticeConfigDto {
    id: string;
    name: string;
    description: string | null;
    params: unknown;
    wordIds: string[] | null;
    tagIds: string[] | null;
    /** How many saved words the user can no longer see. Always 0 when there are no saved words. */
    missingCount: number;
    createdAt: Date;
    updatedAt: Date;
}

type ConfigRow = typeof practiceConfigs.$inferSelect;

/** How many of each row's word ids are gone (deleted, or no longer reachable). One query for all rows. */
async function missingCounts(userId: string, rows: ConfigRow[]): Promise<Map<string, number>> {
    const allIds = [...new Set(rows.flatMap((row) => row.wordIds ?? []))];
    const counts = new Map<string, number>();
    if (allIds.length === 0) return counts;

    const visible = await db
        .select({ id: words.id })
        .from(words)
        .where(and(inArray(words.id, allIds), await visibleWordCondition(userId)));
    const visibleIds = new Set<string>(visible.map((row: { id: string }) => row.id));

    for (const row of rows) {
        counts.set(row.id, (row.wordIds ?? []).filter((id) => !visibleIds.has(id)).length);
    }
    return counts;
}

const toDto = (row: ConfigRow, missingCount: number): PracticeConfigDto => ({
    id: row.id,
    name: row.name,
    description: row.description,
    params: row.params,
    wordIds: row.wordIds,
    tagIds: row.tagIds,
    missingCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
});

/** Postgres unique violation, seen directly or wrapped by the driver layer. */
const isUniqueViolation = (error: any): boolean => (error?.cause?.code ?? error?.code) === '23505';

export type SaveResult = { ok: true; config: PracticeConfigDto } | { ok: false; reason: 'name_taken' | 'not_found' };

export async function listConfigs(userId: string): Promise<PracticeConfigDto[]> {
    const rows: ConfigRow[] = await db
        .select()
        .from(practiceConfigs)
        .where(eq(practiceConfigs.userId, userId))
        .orderBy(desc(practiceConfigs.createdAt), desc(practiceConfigs.id));
    const counts = await missingCounts(userId, rows);
    return rows.map((row) => toDto(row, counts.get(row.id) ?? 0));
}

export async function createConfig(userId: string, input: ConfigRequest): Promise<SaveResult> {
    try {
        const [row]: ConfigRow[] = await db
            .insert(practiceConfigs)
            .values({
                userId,
                name: input.name,
                description: input.description,
                params: input.params,
                wordIds: input.wordIds,
                tagIds: input.tagIds,
            })
            .returning();
        const counts = await missingCounts(userId, [row]);
        return { ok: true, config: toDto(row, counts.get(row.id) ?? 0) };
    } catch (error) {
        if (isUniqueViolation(error)) return { ok: false, reason: 'name_taken' };
        throw error;
    }
}

export async function updateConfig(userId: string, id: string, input: ConfigRequest): Promise<SaveResult> {
    try {
        const [row]: ConfigRow[] = await db
            .update(practiceConfigs)
            .set({
                name: input.name,
                description: input.description,
                params: input.params,
                wordIds: input.wordIds,
                tagIds: input.tagIds,
                updatedAt: sql`now()`,
            })
            .where(and(eq(practiceConfigs.id, id), eq(practiceConfigs.userId, userId)))
            .returning();
        if (!row) return { ok: false, reason: 'not_found' };
        const counts = await missingCounts(userId, [row]);
        return { ok: true, config: toDto(row, counts.get(row.id) ?? 0) };
    } catch (error) {
        if (isUniqueViolation(error)) return { ok: false, reason: 'name_taken' };
        throw error;
    }
}

/** `true` when a row was deleted. */
export async function deleteConfig(userId: string, id: string): Promise<boolean> {
    const deleted = await db
        .delete(practiceConfigs)
        .where(and(eq(practiceConfigs.id, id), eq(practiceConfigs.userId, userId)))
        .returning({ id: practiceConfigs.id });
    return deleted.length > 0;
}

/**
 * The saved words the user can still see, in the saved order — or `null` when the
 * configuration does not exist (or is not the user's).
 */
export async function getConfigWords(userId: string, id: string): Promise<WordResponse[] | null> {
    const [row]: ConfigRow[] = await db
        .select()
        .from(practiceConfigs)
        .where(and(eq(practiceConfigs.id, id), eq(practiceConfigs.userId, userId)))
        .limit(1);
    if (!row) return null;

    const savedIds = row.wordIds ?? [];
    if (savedIds.length === 0) return [];

    const visible = await db
        .select({ id: words.id })
        .from(words)
        .where(and(inArray(words.id, savedIds), await visibleWordCondition(userId)));
    const visibleIds = new Set<string>(visible.map((r: { id: string }) => r.id));
    const orderedIds = savedIds.filter((wordId) => visibleIds.has(wordId));

    // `fetchWordsWithRelations` does not keep the input order.
    const byId = new Map((await fetchWordsWithRelations(orderedIds, userId)).map((word) => [word.id, word]));
    return orderedIds.flatMap((wordId) => byId.get(wordId) ?? []);
}
