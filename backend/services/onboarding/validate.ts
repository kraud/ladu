/**
 * Request validation for the onboarding routes (pure, no Express, no DB).
 * Spec: .context/plans/onboarding.md — D4, D14, D15 (Slice 3c).
 *
 * The languages are not part of the request: they are the account's (D8; the app changes them
 * through the profile route first). A level is needed for every learning language and nothing else.
 */

import type { Validation } from '../exercises/validate';
import { learningLanguages, MAX_WORDS, MIN_WORDS, WORDS_STEP } from './select';

const { TOPICS }: typeof import('../../scripts/lexicon/onboarding-topics') = require('../../scripts/lexicon/onboarding-topics');
const { POOL_BANDS }: typeof import('../../lib/onboardingPool') = require('../../lib/onboardingPool');

/** D15. */
export const MIN_TOPICS = 3;
export const MAX_TOPICS = 6;

export interface ChoiceRequest {
    levels: Record<string, string>;
    topics: string[];
}

const fail = (code: string, message: string): { ok: false; code: string; message: string } => ({ ok: false, code, message });

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/** `{ levels, topics }` for the account's languages (capacity and create). */
export function validateChoice(
    body: unknown,
    account: { languages: string[]; nativeLanguage: string | null },
): Validation<ChoiceRequest> {
    if (!isPlainObject(body)) return fail('invalid_body', 'The request body must be an object');

    const learning = learningLanguages(account.languages, account.nativeLanguage);
    const { levels, topics } = body;
    if (!isPlainObject(levels)) return fail('invalid_levels', 'levels must be an object');
    const levelLanguages = Object.keys(levels);
    if (levelLanguages.length !== learning.length || !learning.every((language) => language in levels)) {
        return fail('invalid_levels', `levels must have exactly the learning languages: ${learning.join(', ')}`);
    }
    if (!Object.values(levels).every((level) => typeof level === 'string' && (POOL_BANDS as readonly string[]).includes(level))) {
        return fail('invalid_levels', `Each level must be one of: ${POOL_BANDS.join(', ')}`);
    }

    const topicIds = TOPICS.map((topic) => topic.id);
    if (!Array.isArray(topics) || !topics.every((topic) => typeof topic === 'string' && topicIds.includes(topic))) {
        return fail('invalid_topics', 'topics must be a list of topic ids');
    }
    if (new Set(topics).size !== topics.length) return fail('invalid_topics', 'topics must not repeat');
    if (topics.length < MIN_TOPICS || topics.length > MAX_TOPICS) {
        return fail('invalid_topics', `Pick ${MIN_TOPICS} to ${MAX_TOPICS} topics`);
    }

    return { ok: true, value: { levels: levels as Record<string, string>, topics: topics as string[] } };
}

/** `{ levels, topics, count }` (create). The count must also fit the capacity: `checkCount`. */
export function validateCreate(
    body: unknown,
    account: { languages: string[]; nativeLanguage: string | null },
): Validation<ChoiceRequest & { count: number }> {
    const choice = validateChoice(body, account);
    if (!choice.ok) return choice;
    const { count } = body as Record<string, unknown>;
    if (typeof count !== 'number' || !Number.isInteger(count) || count < WORDS_STEP || count > MAX_WORDS || count % WORDS_STEP !== 0) {
        return fail('invalid_count', `count must be ${WORDS_STEP} to ${MAX_WORDS}, in steps of ${WORDS_STEP}`);
    }
    return { ok: true, value: { ...choice.value, count } };
}

/**
 * The count against the choice's capacity (D18, D25): never more than the capacity, and at least
 * MIN_WORDS unless the capacity itself is smaller (then any step up to it).
 */
export function checkCount(count: number, capacity: number): Validation<number> {
    if (count > capacity) return fail('count_over_capacity', `With these levels and topics, at most ${capacity} words`);
    if (count < MIN_WORDS && capacity >= MIN_WORDS) return fail('invalid_count', `count must be at least ${MIN_WORDS}`);
    return { ok: true, value: count };
}
