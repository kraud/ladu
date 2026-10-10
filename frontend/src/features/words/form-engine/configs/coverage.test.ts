import { describe, expect, it } from 'vitest';
import { Lang, PartOfSpeech } from '@/ts/enums';
import { coverageForLanguage } from './coverage';

describe('coverageForLanguage', () => {
    it('lists all four parts of speech for every language (Estonian adverb since Slice H4)', () => {
        for (const lang of [Lang.EN, Lang.ES, Lang.DE, Lang.EE]) {
            expect(coverageForLanguage(lang)).toEqual([
                PartOfSpeech.noun,
                PartOfSpeech.verb,
                PartOfSpeech.adjective,
                PartOfSpeech.adverb,
            ]);
        }
    });
});
