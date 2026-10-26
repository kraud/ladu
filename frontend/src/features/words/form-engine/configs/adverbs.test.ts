/**
 * Regression test: the config-driven field lists must equal the old
 * `AdverbForm{EN,ES,DE}` field lists transcribed verbatim in
 * `.context/.frontend/snapshot/forms-adjectives-adverbs.md`, plus the gradable radio and the
 * periphrastic checkboxes added later. The Estonian adverb form is new (Slice H4) and is pinned here directly.
 */
import { describe, expect, it } from 'vitest';
import { AdverbCases, Lang, PartOfSpeech } from '@/ts/enums';
import { derivedStoredWord, isDerived, isStoredCheckbox, matchesVisibility, type FieldConfig } from './types';
import { getFormConfig } from './index';
import { casesToFieldValues, fieldsToCases } from '../TranslationCard';
import { LANG_SUFFIX } from '@/lib/language';

/** Field names that would actually render given these sibling values — the same filter `FieldRenderer` applies via `visibleWhen`. */
function visibleNames(fields: FieldConfig[], values: Record<string, unknown>): string[] {
    return fields
        .filter((f) => !f.visibleWhen || matchesVisibility(f.visibleWhen, values[f.visibleWhen.field]))
        .map((f) => f.name);
}

describe('getFormConfig(Adverb, lang) — old field-list parity', () => {
    it('English: gradable*, adverb*, comparative and superlative derived from the adverb while the stored checkbox is checked', () => {
        const config = getFormConfig(PartOfSpeech.adverb, Lang.EN)!;
        expect(config.fields.map((f) => f.name)).toEqual(['gradable', 'adverb', 'comparative', 'superlative', 'periphrastic']);
        expect(config.fields.find((f) => f.name === 'gradable')?.required).toBe(true);
        expect(config.fields.find((f) => f.name === 'adverb')?.required).toBe(true);
        expect(config.fields.filter((f) => ['comparative', 'superlative', 'periphrastic'].includes(f.name)).every((f) => !f.required)).toBe(true);
        const derivation = (name: string) => {
            const field = config.fields.find((f) => f.name === name);
            return field?.kind === 'text' ? field.derivedWhen : undefined;
        };
        expect(derivation('comparative')).toEqual({ when: { field: 'periphrastic', equals: true }, prefix: 'more ', fromField: 'adverb', store: true });
        expect(derivation('superlative')).toEqual({ when: { field: 'periphrastic', equals: true }, prefix: 'most ', fromField: 'adverb', store: true });
        expect(isStoredCheckbox(config.fields.find((f) => f.name === 'periphrastic')!)).toBe(true);
    });

    it('Spanish: gradable*, adverb*, a comparative derived from the adverb ("más"), a superlative that is always typed', () => {
        const config = getFormConfig(PartOfSpeech.adverb, Lang.ES)!;
        expect(config.fields.map((f) => f.name)).toEqual(['gradable', 'adverb', 'comparative', 'superlative', 'periphrasticComparative']);
        expect(config.fields.find((f) => f.name === 'gradable')?.required).toBe(true);
        expect(config.fields.find((f) => f.name === 'adverb')?.required).toBe(true);
        const comparative = config.fields.find((f) => f.name === 'comparative');
        expect(comparative?.kind === 'text' && comparative.derivedWhen).toEqual({
            when: { field: 'periphrasticComparative', equals: true },
            prefix: 'más ',
            fromField: 'adverb',
            store: true,
        });
        const superlative = config.fields.find((f) => f.name === 'superlative');
        expect(superlative?.kind === 'text' && superlative.derivedWhen).toBeUndefined();
        expect(isStoredCheckbox(config.fields.find((f) => f.name === 'periphrasticComparative')!)).toBe(true);
    });

    it('Estonian (new, H4): gradable*, adverb*, comparative, a superlative derived and stored while the stored checkbox is checked (D27, Q9)', () => {
        const config = getFormConfig(PartOfSpeech.adverb, Lang.EE)!;
        expect(config.fields.map((f) => f.name)).toEqual(['gradable', 'adverb', 'comparative', 'superlative', 'periphrasticSuperlative']);
        expect(config.fields.find((f) => f.name === 'gradable')?.required).toBe(true);
        expect(config.fields.find((f) => f.name === 'adverb')?.required).toBe(true);
        expect(config.fields.filter((f) => !['gradable', 'adverb'].includes(f.name)).every((f) => !f.required)).toBe(true);
        const superlative = config.fields.find((f) => f.name === 'superlative');
        expect(superlative?.kind === 'text' && superlative.derivedWhen).toEqual({
            when: { field: 'periphrasticSuperlative', equals: true },
            prefix: 'kõige ',
            fromField: 'comparative',
            store: true,
        });
        expect(isStoredCheckbox(config.fields.find((f) => f.name === 'periphrasticSuperlative')!)).toBe(true);
    });

    it('German: the superlative shows a fixed "am" prefix (D25)', () => {
        const superlative = getFormConfig(PartOfSpeech.adverb, Lang.DE)!.fields.find((f) => f.name === 'superlative');
        expect(superlative?.adornment).toEqual({ text: 'am' });
    });

    describe('French (language-french.md, slice 6)', () => {
        const fields = () => getFormConfig(PartOfSpeech.adverb, Lang.FR)!.fields;
        const named = (name: string) => fields().find((f) => f.name === name)!;

        it('gradable*, adverb*, the "plus" box above the comparative and the superlative, which share one row', () => {
            expect(fields().map((f) => f.name)).toEqual(['gradable', 'adverb', 'periphrastic', 'comparative', 'superlative']);
            expect(fields().filter((f) => f.required).map((f) => f.name)).toEqual(['gradable', 'adverb']);
            for (const name of ['comparative', 'superlative']) {
                expect(named(name).layout).toMatchObject({ row: 'degree', block: 'frDegree', fitRow: true, alignTop: true });
            }
            expect(named('comparative').layout?.column).not.toBe(named('superlative').layout?.column);
            expect(isStoredCheckbox(named('periphrastic'))).toBe(true);
        });

        it('comparative: with the "plus" box on it shows and saves "plus " + the adverb', () => {
            const comparative = named('comparative');
            expect(comparative.kind === 'text' && comparative.derivedWhen).toEqual({
                when: { field: 'periphrastic', equals: true },
                prefix: 'plus ',
                fromField: 'adverb',
                store: true,
            });
            expect(derivedStoredWord(comparative, { periphrastic: true, adverb: 'vite' })).toBe('plus vite');
            expect(isDerived(comparative, { periphrastic: false })).toBe(false);
        });

        it('the superlative is always locked: "le " + the comparative, also the typed irregular one (bien → mieux → le mieux)', () => {
            const superlative = named('superlative');
            expect(isDerived(superlative, {})).toBe(true);
            expect(derivedStoredWord(superlative, { periphrastic: true, adverb: 'vite', comparative: '' })).toBe('le plus vite');
            expect(derivedStoredWord(superlative, { periphrastic: false, adverb: 'bien', comparative: 'mieux' })).toBe('le mieux');
            expect(derivedStoredWord(superlative, { periphrastic: false, comparative: '' })).toBeUndefined();
        });

        it('the saved cases hold the box, the derived comparative and the derived superlative', () => {
            const values = { gradable: 'Gradable', adverb: 'vite', periphrastic: true, comparative: '', superlative: '' };
            expect(fieldsToCases(fields(), values)).toEqual([
                { caseName: AdverbCases.gradableFR, word: 'Gradable' },
                { caseName: AdverbCases.adverbFR, word: 'vite' },
                { caseName: AdverbCases.periphrasticFR, word: 'true' },
                { caseName: AdverbCases.comparativeFR, word: 'plus vite' },
                { caseName: AdverbCases.superlativeFR, word: 'le plus vite' },
            ]);
            const irregular = { gradable: 'Gradable', adverb: 'bien', periphrastic: false, comparative: 'mieux', superlative: '' };
            expect(fieldsToCases(fields(), irregular)).toEqual([
                { caseName: AdverbCases.gradableFR, word: 'Gradable' },
                { caseName: AdverbCases.adverbFR, word: 'bien' },
                { caseName: AdverbCases.comparativeFR, word: 'mieux' },
                { caseName: AdverbCases.superlativeFR, word: 'le mieux' },
            ]);
        });

        it('a stored word starts with an empty superlative box: it is shown from the comparative', () => {
            const values = casesToFieldValues(fields(), [
                { caseName: AdverbCases.adverbFR, word: 'bien' },
                { caseName: AdverbCases.comparativeFR, word: 'mieux' },
                { caseName: AdverbCases.superlativeFR, word: 'le mieux' },
            ]);
            expect(values.superlative).toBe('');
            expect(values.comparative).toBe('mieux');
        });
    });

    describe.each([
        [Lang.EN, ['periphrastic']],
        [Lang.ES, ['periphrasticComparative']],
        [Lang.DE, []],
        [Lang.EE, ['periphrasticSuperlative']],
        [Lang.FR, ['periphrastic']],
    ])('%s — gradable-branched visibility', (lang, checkbox) => {
        const config = getFormConfig(PartOfSpeech.adverb, lang)!;
        // French lists the box before the degree row; the others list it last.
        const all = lang === Lang.FR ? ['gradable', 'adverb', ...checkbox, 'comparative', 'superlative'] : ['gradable', 'adverb', 'comparative', 'superlative', ...checkbox];

        it('everything is visible by default, before gradable is picked', () => {
            expect(visibleNames(config.fields, { gradable: '' })).toEqual(all);
        });

        it('everything stays visible once "Gradable" is picked', () => {
            expect(visibleNames(config.fields, { gradable: 'Gradable' })).toEqual(all);
        });

        it('only the radio and the adverb stay once "Non-gradable" is picked', () => {
            expect(visibleNames(config.fields, { gradable: 'Non-gradable' })).toEqual(['gradable', 'adverb']);
        });
    });

    it('every field.caseName is field.name + the language suffix', () => {
        for (const lang of [Lang.EN, Lang.ES, Lang.DE, Lang.EE, Lang.FR]) {
            const config = getFormConfig(PartOfSpeech.adverb, lang)!;
            for (const field of config.fields) {
                expect(field.caseName).toBe(`${field.name}${LANG_SUFFIX[lang]}`);
            }
        }
    });
});
