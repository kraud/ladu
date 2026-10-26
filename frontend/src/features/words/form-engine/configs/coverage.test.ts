import { describe, expect, it } from 'vitest';
import { Lang, PartOfSpeech } from '@/ts/enums';
import { coverageForLanguage } from './coverage';

describe('coverageForLanguage', () => {
    it('lists the parts of speech with a form for every language (Estonian adverb since Slice H4, conjunctions since the conjunctions plan)', () => {
        for (const lang of [Lang.EN, Lang.ES, Lang.DE, Lang.EE]) {
            expect(coverageForLanguage(lang)).toEqual([
                PartOfSpeech.noun,
                PartOfSpeech.verb,
                PartOfSpeech.adjective,
                PartOfSpeech.adverb,
                PartOfSpeech.conjunction,
                PartOfSpeech.preposition,
            ]);
        }
    });

    it('lists only the parts of speech French has so far (nouns and adjectives, slice 4; verbs, slice 5)', () => {
        expect(coverageForLanguage(Lang.FR)).toEqual([PartOfSpeech.noun, PartOfSpeech.verb, PartOfSpeech.adjective]);
    });
});
