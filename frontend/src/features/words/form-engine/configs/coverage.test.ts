import { describe, expect, it } from 'vitest';
import { Lang, PartOfSpeech } from '@/ts/enums';
import { coverageForLanguage } from './coverage';

describe('coverageForLanguage', () => {
    it('lists all four parts of speech for English, Spanish and German', () => {
        for (const lang of [Lang.EN, Lang.ES, Lang.DE]) {
            expect(coverageForLanguage(lang)).toEqual([
                PartOfSpeech.noun,
                PartOfSpeech.verb,
                PartOfSpeech.adjective,
                PartOfSpeech.adverb,
            ]);
        }
    });

    it('excludes adverb for Estonian — no Estonian adverb config exists', () => {
        expect(coverageForLanguage(Lang.EE)).toEqual([
            PartOfSpeech.noun,
            PartOfSpeech.verb,
            PartOfSpeech.adjective,
        ]);
    });
});
