import { describe, expect, it } from 'vitest';
import { PartOfSpeech } from '@/ts/enums';
import { langColor, posColor } from './chartColors';

describe('posColor', () => {
    it('maps each creatable part of speech to its token', () => {
        expect(posColor(PartOfSpeech.noun)).toBe('var(--accent)');
        expect(posColor(PartOfSpeech.verb)).toBe('var(--lang-es)');
        expect(posColor(PartOfSpeech.adjective)).toBe('var(--warning)');
        expect(posColor(PartOfSpeech.adverb)).toBe('var(--lang-gb)');
    });

    it('falls back to --accent for a part of speech with no chart colour', () => {
        expect(posColor(PartOfSpeech.pronoun)).toBe('var(--accent)');
    });
});

describe('langColor', () => {
    it('maps each UI language label to its --lang-* token', () => {
        expect(langColor('English')).toBe('var(--lang-gb)');
        expect(langColor('Spanish')).toBe('var(--lang-es)');
        expect(langColor('German')).toBe('var(--lang-de)');
        expect(langColor('Estonian')).toBe('var(--lang-ee)');
    });
});
