/**
 * Pins `expectedCaseCount` against the real configs' field lists (also pinned,
 * independently, by `configs/{nouns,verbs,adjectives,adverbs}.test.ts`) —
 * every combination with no `visibleWhen` is a plain count; the two
 * branching configs collapse to their largest branch; the language with no
 * config at all returns 0.
 */
import { describe, expect, it } from 'vitest';
import { PartOfSpeech } from '@/ts/enums';
import type { LangKey } from '@/features/words/types';
import { expectedCaseCount } from './completion';

describe('expectedCaseCount — plain configs (no visibleWhen)', () => {
    it.each<[PartOfSpeech, LangKey, number]>([
        [PartOfSpeech.noun, 'EN', 3],
        [PartOfSpeech.noun, 'ES', 4],
        [PartOfSpeech.noun, 'DE', 10],
        [PartOfSpeech.noun, 'EE', 8],
        [PartOfSpeech.verb, 'EN', 21],
        [PartOfSpeech.verb, 'ES', 28],
        [PartOfSpeech.verb, 'DE', 29],
        [PartOfSpeech.adjective, 'EN', 3],
        [PartOfSpeech.adjective, 'DE', 3],
        [PartOfSpeech.adjective, 'EE', 8],
        [PartOfSpeech.adverb, 'EN', 3],
        [PartOfSpeech.adverb, 'ES', 3],
    ])('%s / %s -> %i', (pos, lang, expected) => {
        expect(expectedCaseCount(pos, lang)).toBe(expected);
    });

    it('Estonian verb: 22 fields minus the persisted:false searchInEnglish checkbox', () => {
        expect(expectedCaseCount(PartOfSpeech.verb, 'EE')).toBe(21);
    });
});

describe('expectedCaseCount — branching configs collapse to the largest branch', () => {
    it('Spanish adjective: 0 unconditioned + max(Neutral=2, M/F=4)', () => {
        expect(expectedCaseCount(PartOfSpeech.adjective, 'ES')).toBe(4);
    });

    it('German adverb: 2 unconditioned (gradable, adverb) + max(Gradable=2, Non-gradable=0)', () => {
        expect(expectedCaseCount(PartOfSpeech.adverb, 'DE')).toBe(4);
    });
});

describe('expectedCaseCount — no config at all', () => {
    it('Estonian adverb (no route in the old app either) returns 0', () => {
        expect(expectedCaseCount(PartOfSpeech.adverb, 'EE')).toBe(0);
    });

    it('an unshipped part of speech returns 0 for every language', () => {
        expect(expectedCaseCount(PartOfSpeech.preposition, 'EN')).toBe(0);
    });
});

describe('expectedCaseCount — memoisation does not change the answer', () => {
    it('returns the same value on repeated calls for the same pair', () => {
        const first = expectedCaseCount(PartOfSpeech.noun, 'DE');
        const second = expectedCaseCount(PartOfSpeech.noun, 'DE');
        expect(second).toBe(first);
        expect(second).toBe(10);
    });
});
