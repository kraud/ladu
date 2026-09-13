/**
 * Regression test: the config-driven field lists must equal the old
 * `AdverbForm{EN,ES,DE}` field lists transcribed verbatim in
 * `.context/.frontend/snapshot/forms-adjectives-adverbs.md`. There is no
 * Estonian adverb form in the old app at all.
 */
import { describe, expect, it } from 'vitest';
import { Lang, PartOfSpeech } from '@/ts/enums';
import { matchesVisibility, type FieldConfig } from './types';
import { getFormConfig } from './index';

/** Field names that would actually render given these sibling values — the same filter `FieldRenderer` applies via `visibleWhen`. */
function visibleNames(fields: FieldConfig[], values: Record<string, unknown>): string[] {
    return fields
        .filter((f) => !f.visibleWhen || matchesVisibility(f.visibleWhen, values[f.visibleWhen.field]))
        .map((f) => f.name);
}

describe('getFormConfig(Adverb, lang) — old field-list parity', () => {
    it('English: adverb*, comparative, superlative', () => {
        const config = getFormConfig(PartOfSpeech.adverb, Lang.EN)!;
        expect(config.fields.map((f) => f.name)).toEqual(['adverb', 'comparative', 'superlative']);
        expect(config.fields.find((f) => f.name === 'adverb')?.required).toBe(true);
        expect(config.fields.filter((f) => f.name !== 'adverb').every((f) => !f.required)).toBe(true);
    });

    it('Spanish: adverb*, comparative, superlative', () => {
        const config = getFormConfig(PartOfSpeech.adverb, Lang.ES)!;
        expect(config.fields.map((f) => f.name)).toEqual(['adverb', 'comparative', 'superlative']);
        expect(config.fields.find((f) => f.name === 'adverb')?.required).toBe(true);
        expect(config.fields.filter((f) => f.name !== 'adverb').every((f) => !f.required)).toBe(true);
    });

    it('there is no Estonian adverb config', () => {
        expect(getFormConfig(PartOfSpeech.adverb, Lang.EE)).toBeUndefined();
    });

    describe('German — gradable-branched visibility', () => {
        const config = getFormConfig(PartOfSpeech.adverb, Lang.DE)!;

        it('the full config carries gradable*, adverb*, comparative, superlative', () => {
            expect(config.fields.map((f) => f.name)).toEqual(['gradable', 'adverb', 'comparative', 'superlative']);
            expect(config.fields.find((f) => f.name === 'gradable')?.required).toBe(true);
            expect(config.fields.find((f) => f.name === 'adverb')?.required).toBe(true);
            expect(config.fields.filter((f) => f.name === 'comparative' || f.name === 'superlative').every((f) => !f.required)).toBe(true);
        });

        it('comparative/superlative are visible by default, before gradable is picked', () => {
            expect(visibleNames(config.fields, { gradable: '' })).toEqual(['gradable', 'adverb', 'comparative', 'superlative']);
        });

        it('comparative/superlative stay visible once "Gradable" is picked', () => {
            expect(visibleNames(config.fields, { gradable: 'Gradable' })).toEqual(['gradable', 'adverb', 'comparative', 'superlative']);
        });

        it('comparative/superlative are hidden once "Non-gradable" is picked', () => {
            expect(visibleNames(config.fields, { gradable: 'Non-gradable' })).toEqual(['gradable', 'adverb']);
        });
    });

    it('every field.caseName is field.name + the language suffix', () => {
        const suffixes: Record<Lang, string> = { [Lang.EN]: 'EN', [Lang.ES]: 'ES', [Lang.DE]: 'DE', [Lang.EE]: 'EE' };
        for (const lang of [Lang.EN, Lang.ES, Lang.DE]) {
            const config = getFormConfig(PartOfSpeech.adverb, lang)!;
            for (const field of config.fields) {
                expect(field.caseName).toBe(`${field.name}${suffixes[lang]}`);
            }
        }
    });
});
