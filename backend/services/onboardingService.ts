/**
 * The database side of the first-login onboarding (.context/plans/onboarding.md, Slice 3d).
 * The choice of concepts is pure (services/onboarding); this file reads the account and writes
 * the Words, translations, cases, tags and the onboarding status.
 */

import type { ConceptForms, PoolConcept } from '../lib/onboardingPool';
import type { ChoiceRequest, OnboardingChoice, SelectedConcept } from './onboarding';

const { db }: typeof import('../src/db') = require('../src/db');
const { users, words, translations, translationCases, tags, tagWords }: typeof import('../src/db/schema') = require('../src/db/schema');
const { and, eq } = require('drizzle-orm');
const { readPool, readForms }: typeof import('../lib/onboardingPool') = require('../lib/onboardingPool');
const { selectConcepts, capacity, topicLabel }: typeof import('./onboarding') = require('./onboarding');
const { capitalizeGermanNouns }: typeof import('../lib/germanNouns') = require('../lib/germanNouns');

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// --- Pool data (read once; tests can replace it) ---------------------------------------------------

let data: { pool: PoolConcept[]; forms: Record<string, ConceptForms> } | null = null;

const poolData = () => {
    data ??= { pool: readPool(), forms: readForms().concepts };
    return data;
};

/** Tests only: a small synthetic pool instead of the committed one; `null` goes back to the files. */
export const setOnboardingData = (next: { pool: PoolConcept[]; forms: Record<string, ConceptForms> } | null): void => {
    data = next;
};

// --- Reads ----------------------------------------------------------------------------------------

export interface OnboardingAccount {
    id: string;
    languages: string[];
    nativeLanguage: string | null;
    uiLanguage: string | null;
}

const choiceFor = (account: OnboardingAccount, request: ChoiceRequest): OnboardingChoice => ({
    languages: account.languages,
    nativeLanguage: account.nativeLanguage,
    levels: request.levels,
    topics: request.topics,
});

/** D18: the slider maximum for a choice. */
export const capacityFor = (account: OnboardingAccount, request: ChoiceRequest): number => {
    const { pool, forms } = poolData();
    return capacity(pool, forms, choiceFor(account, request));
};

// --- Writes ---------------------------------------------------------------------------------------

/** Postgres takes at most 65,535 parameters per statement; a case row has 3. */
const CASE_ROWS_PER_INSERT = 5000;

/** "Label", or "Label (2)", "Label (3)"… when the user already has it (case-insensitive, tags D13). */
const freeLabel = (label: string, used: Set<string>): string => {
    let candidate = label;
    for (let suffix = 2; used.has(candidate.toLowerCase()); suffix++) candidate = `${label} (${suffix})`;
    used.add(candidate.toLowerCase());
    return candidate;
};

export type CreateResult =
    | { ok: true; words: number; tags: { id: string; label: string; topic: string; words: number }[] }
    | { ok: false; code: 'not_pending' };

/**
 * Creates the onboarding's Words in one transaction. The user row is locked first and must still be
 * `pending` (two clicks cannot create twice); it is `done` at the end.
 */
export const createOnboarding = async (account: OnboardingAccount, request: ChoiceRequest & { count: number }): Promise<CreateResult> => {
    const { pool, forms } = poolData();
    const selected: SelectedConcept[] = selectConcepts(pool, forms, choiceFor(account, request), request.count);

    return db.transaction(async (tx: Tx) => {
        const [row] = await tx
            .select({ status: users.onboardingStatus })
            .from(users)
            .where(eq(users.id, account.id))
            .for('update');
        if (row?.status !== 'pending') return { ok: false, code: 'not_pending' } as const;

        // Tags: the picked topics in the user's order, then core; only the ones that got words (D23).
        // A concept with two topics is in both (the 2026-10 pool refresh).
        const topicsUsed = [...request.topics, 'core'].filter((topic) => selected.some((concept) => concept.topics.includes(topic)));
        const existing = await tx.select({ label: tags.label }).from(tags).where(eq(tags.authorId, account.id));
        const used = new Set<string>(existing.map((tag: { label: string }) => tag.label.toLowerCase()));
        const createdTags = topicsUsed.length
            ? await tx
                .insert(tags)
                .values(topicsUsed.map((topic) => ({
                    authorId: account.id,
                    label: freeLabel(topicLabel(topic, account.uiLanguage), used),
                    visibility: 'Private' as const,
                })))
                .returning({ id: tags.id, label: tags.label })
            : [];
        const tagIdByTopic = new Map<string, string>(topicsUsed.map((topic, i) => [topic, createdTags[i].id]));

        if (selected.length) {
            // The first chosen concept is the newest, so the word list (newest first) starts with it.
            const now = Date.now();
            const wordRows = await tx
                .insert(words)
                .values(selected.map((concept, i) => {
                    const createdAt = new Date(now - i * 1000);
                    return { userId: account.id, partOfSpeech: concept.partOfSpeech, createdAt, updatedAt: createdAt };
                }))
                .returning({ id: words.id });

            const translationInputs = selected.flatMap((concept, i) =>
                capitalizeGermanNouns(concept.partOfSpeech, concept.translations).map((translation) => ({ wordId: wordRows[i].id, translation })));
            const translationRows = await tx
                .insert(translations)
                .values(translationInputs.map(({ wordId, translation }) => ({ wordId, language: translation.language })))
                .returning({ id: translations.id });

            const caseRows = translationInputs.flatMap(({ translation }, i) =>
                translation.cases.map((c) => ({ translationId: translationRows[i].id, caseName: c.caseName, word: c.word })));
            for (let start = 0; start < caseRows.length; start += CASE_ROWS_PER_INSERT) {
                await tx.insert(translationCases).values(caseRows.slice(start, start + CASE_ROWS_PER_INSERT));
            }

            // One link for every concept/topic pair whose tag exists (a topic the user did not pick has none).
            const tagLinks = selected.flatMap((concept, i) =>
                concept.topics.flatMap((topic) => {
                    const tagId = tagIdByTopic.get(topic);
                    return tagId ? [{ tagId, wordId: wordRows[i].id }] : [];
                }));
            if (tagLinks.length) await tx.insert(tagWords).values(tagLinks);
        }

        await tx.update(users).set({ onboardingStatus: 'done', updatedAt: new Date() }).where(eq(users.id, account.id));

        return {
            ok: true,
            words: selected.length,
            tags: topicsUsed.map((topic, i) => ({
                id: createdTags[i].id,
                label: createdTags[i].label,
                topic,
                words: selected.filter((concept) => concept.topics.includes(topic)).length,
            })),
        } as const;
    });
};

/** `pending` → `skipped`. False when the account is not `pending`. */
export const skipOnboarding = async (userId: string): Promise<boolean> => {
    const updated = await db
        .update(users)
        .set({ onboardingStatus: 'skipped', updatedAt: new Date() })
        .where(and(eq(users.id, userId), eq(users.onboardingStatus, 'pending')))
        .returning({ id: users.id });
    return updated.length > 0;
};
