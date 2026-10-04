import { describe, expect, it } from 'vitest';
import { Lang, PartOfSpeech } from '@/ts/enums';
import type { PreselectedWord } from './preselection';
import { describeWords } from './wordFilter';

const house: PreselectedWord = { id: 'w1', partOfSpeech: PartOfSpeech.noun, label: 'house', languages: ['EN', 'DE'] };
const run: PreselectedWord = { id: 'w2', partOfSpeech: PartOfSpeech.verb, label: 'run', languages: ['EN', 'ES'] };
const cat: PreselectedWord = { id: 'w3', partOfSpeech: PartOfSpeech.noun, label: 'cat', languages: ['ES'] };

const all = { languages: [Lang.EN, Lang.ES, Lang.DE], partsOfSpeech: [PartOfSpeech.noun, PartOfSpeech.verb] };

describe('describeWords', () => {
    it('uses every word when all its types and languages are selected', () => {
        const result = describeWords([house, run], all);
        expect(result.map((r) => r.included)).toEqual([true, true]);
        expect(result[0]!.activeLanguages).toEqual(['EN', 'DE']);
    });

    it('drops a word whose word type is not selected', () => {
        const result = describeWords([house, run], { ...all, partsOfSpeech: [PartOfSpeech.noun] });
        expect(result.map((r) => r.included)).toEqual([true, false]);
    });

    it('removes an unselected language from every word that has it, and keeps the others', () => {
        const result = describeWords([house, run], { ...all, languages: [Lang.EN, Lang.ES] });
        expect(result[0]!.activeLanguages).toEqual(['EN']);
        expect(result[1]!.activeLanguages).toEqual(['EN', 'ES']);
        expect(result.map((r) => r.included)).toEqual([true, true]);
    });

    it('drops a word when all its languages are unselected', () => {
        const result = describeWords([house, cat], { ...all, languages: [Lang.EN] });
        expect(result.map((r) => r.included)).toEqual([true, false]);
        expect(result[1]!.activeLanguages).toEqual([]);
    });

    it('keeps the order of the words and does not change them', () => {
        const result = describeWords([cat, house, run], all);
        expect(result.map((r) => r.word.id)).toEqual(['w3', 'w1', 'w2']);
        expect(result[1]!.word).toBe(house);
    });
});
