/**
 * Which concepts one onboarding creates (pure, no Express, no DB).
 * Spec: .context/plans/onboarding.md — D5, D9, D16, D18, D22 (Slice 3c).
 *
 * - A concept counts for a language when the precomputed forms (pool-forms.json, D20) have a
 *   translation in it. It is used only with at least 2 of the user's languages (D9); its Word gets
 *   every one of the user's languages that the forms have.
 * - Every learning language (the account's languages without the native one) picks from its own
 *   level band (D5). About one pick in five is core vocabulary of the band (D22); the others are
 *   the picked topics' concepts of the band, one topic after the other, each by rank. When the
 *   band's topic concepts run out: more core of the band, then the picked topics and the core of the
 *   next band, then the picked topics and the core of the band below (D16, widened in D24).
 * - The languages take turns, one concept each, until the count is reached; a language that has
 *   nothing left leaves its share to the others. A concept, or a concept with the same words in
 *   the user's languages as one already taken (couch / sofa), is never taken twice.
 * - Deterministic: the same choice gives the same concepts.
 */

import type { ConceptForms, PoolConcept } from '../../lib/onboardingPool';

const { CORE_TOPIC, POOL_BANDS }: typeof import('../../lib/onboardingPool') = require('../../lib/onboardingPool');

/** D22: the share of core vocabulary in each language's picks. */
export const CORE_SHARE = 0.2;
/** D14: the slider's range and step. Below MIN_WORDS only when the capacity is smaller (D25). */
export const MIN_WORDS = 50;
export const MAX_WORDS = 150;
export const WORDS_STEP = 10;

export interface OnboardingChoice {
    /** The account's languages, in account order. */
    languages: string[];
    nativeLanguage: string | null;
    /** Learning language → 'beginner' | 'intermediate' | 'advanced'. */
    levels: Record<string, string>;
    /** Picked topic ids (not 'core'). */
    topics: string[];
}

export interface SelectedConcept {
    id: string;
    /** The tag the Word gets: a topic id or 'core'. */
    topic: string;
    partOfSpeech: string;
    translations: { language: string; cases: { caseName: string; word: string }[] }[];
}

/** The account's languages minus the native one (all of them when no native language is set). */
export const learningLanguages = (languages: string[], nativeLanguage: string | null): string[] =>
    languages.filter((language) => language !== nativeLanguage);

/** Topics one after the other (a1, b1, c1, a2, b2…), each list already in rank order. */
const interleave = <T>(lists: T[][]): T[] => {
    const out: T[] = [];
    for (let i = 0; lists.some((list) => i < list.length); i++) {
        for (const list of lists) if (i < list.length) out.push(list[i]);
    }
    return out;
};

const byRank = (a: PoolConcept, b: PoolConcept): number => a.rank - b.rank || a.id.localeCompare(b.id);

/**
 * One language's candidates, in the order D16/D22 take them: a generator, so the core share is
 * kept on the picks the language really makes (concepts taken by another language are skipped).
 */
function* candidatesFor(
    language: string,
    level: string,
    topics: string[],
    eligible: PoolConcept[],
    isFree: (concept: PoolConcept) => boolean,
): Generator<PoolConcept> {
    const bands: readonly string[] = POOL_BANDS;
    const band = bands.indexOf(level);
    const nextBand = bands[band + 1];
    const forLanguage = eligible.filter((concept) => concept.words[language]).sort(byRank);
    const topicsOf = (bandName: string | undefined) =>
        bandName ? interleave(topics.map((topic) => forLanguage.filter((c) => c.topic === topic && c.band === bandName))) : [];

    const topicQueue = topicsOf(level);
    const coreOf = (bandName: string | undefined) =>
        bandName ? forLanguage.filter((concept) => concept.topic === CORE_TOPIC && concept.band === bandName) : [];
    const coreQueue = coreOf(level);
    // D24: after the band, the next band up, then the band below (easier words, still useful revision).
    const nextQueue = [...topicsOf(nextBand), ...coreOf(nextBand), ...topicsOf(bands[band - 1]), ...coreOf(bands[band - 1])];
    const take = (queue: PoolConcept[]): PoolConcept | undefined => {
        while (queue.length) {
            const concept = queue.shift()!;
            if (isFree(concept)) return concept;
        }
        return undefined;
    };

    let picked = 0;
    let core = 0;
    while (true) {
        const wantsCore = core < Math.round(CORE_SHARE * (picked + 1));
        const concept = wantsCore
            ? take(coreQueue) ?? take(topicQueue) ?? take(nextQueue)
            : take(topicQueue) ?? take(coreQueue) ?? take(nextQueue);
        if (!concept) return;
        picked++;
        if (concept.topic === CORE_TOPIC) core++;
        yield concept;
    }
}

/**
 * The concepts for one choice, at most `count` (Infinity: all that the rules can reach — the
 * capacity). `pool` is the parsed pool.tsv; only `keep` lines are used.
 */
export function selectConcepts(
    pool: PoolConcept[],
    forms: Record<string, ConceptForms>,
    choice: OnboardingChoice,
    count: number,
): SelectedConcept[] {
    const userLanguages = new Set(choice.languages);
    // The concept's words, reduced to the user's languages that have precomputed forms.
    const usable = new Map<string, PoolConcept>();
    for (const concept of pool) {
        if (concept.status !== 'keep' || !forms[concept.id]) continue;
        const words = Object.fromEntries(
            Object.entries(concept.words).filter(([language]) => userLanguages.has(language) && forms[concept.id][language]),
        );
        if (Object.keys(words).length >= 2) usable.set(concept.id, { ...concept, words });
    }
    const eligible = [...usable.values()].filter((c) => c.topic === CORE_TOPIC || choice.topics.includes(c.topic));

    const takenIds = new Set<string>();
    const takenWords = new Set<string>();
    const wordsKey = (concept: PoolConcept) =>
        `${concept.partOfSpeech}|${Object.entries(concept.words).sort(([a], [b]) => a.localeCompare(b)).map(([l, w]) => `${l}:${w.word.toLowerCase()}`).join('|')}`;
    const isFree = (concept: PoolConcept) => !takenIds.has(concept.id) && !takenWords.has(wordsKey(concept));

    const streams = learningLanguages(choice.languages, choice.nativeLanguage)
        .filter((language) => choice.levels[language])
        .map((language) => candidatesFor(language, choice.levels[language], choice.topics, eligible, isFree));

    const selected: PoolConcept[] = [];
    let active = streams;
    while (selected.length < count && active.length) {
        const stillActive: Generator<PoolConcept>[] = [];
        for (const stream of active) {
            if (selected.length >= count) break;
            const next = stream.next();
            if (next.done) continue;
            takenIds.add(next.value.id);
            takenWords.add(wordsKey(next.value));
            selected.push(next.value);
            stillActive.push(stream);
        }
        // A stream cut off by the count stays out; it would not be asked again anyway.
        active = selected.length < count ? stillActive : [];
    }

    return selected.map((concept) => ({
        id: concept.id,
        topic: concept.topic,
        partOfSpeech: concept.partOfSpeech,
        translations: choice.languages
            .filter((language) => concept.words[language])
            .map((language) => ({
                language,
                cases: Object.entries(forms[concept.id][language].cases).map(([caseName, word]) => ({ caseName, word })),
            })),
    }));
}

/** D18: how many words the slider may offer for a choice — the reachable concepts, rounded down to a step, at most MAX_WORDS. */
export function capacity(pool: PoolConcept[], forms: Record<string, ConceptForms>, choice: OnboardingChoice): number {
    const reachable = selectConcepts(pool, forms, choice, Infinity).length;
    return Math.min(MAX_WORDS, Math.floor(reachable / WORDS_STEP) * WORDS_STEP);
}
