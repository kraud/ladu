/**
 * Regression test: the config-driven field lists must equal the old
 * `AdjectiveForm{EN,ES,DE,EE}` field lists transcribed verbatim in
 * `.context/.frontend/snapshot/forms-adjectives-adverbs.md`.
 */
import { describe, expect, it } from 'vitest';
import { AdjectiveCases, Lang, PartOfSpeech } from '@/ts/enums';
import { derivedStoredWord, isDerived, isStoredCheckbox, matchesVisibility, type FieldConfig } from './types';
import { getFormConfig } from './index';
import { LANG_SUFFIX } from '@/lib/language';

/** Field names that would actually render given these sibling values — the same filter `FieldRenderer` applies via `visibleWhen`. */
function visibleNames(fields: FieldConfig[], values: Record<string, unknown>): string[] {
    return fields
        .filter((f) => !f.visibleWhen || matchesVisibility(f.visibleWhen, values[f.visibleWhen.field]))
        .map((f) => f.name);
}

describe('getFormConfig(Adjective, lang) — old field-list parity', () => {
    it('English: positive*, comparative, superlative', () => {
        const config = getFormConfig(PartOfSpeech.adjective, Lang.EN)!;
        expect(config.fields.map((f) => f.name)).toEqual(['positive', 'comparative', 'superlative']);
        expect(config.fields.find((f) => f.name === 'positive')?.required).toBe(true);
        expect(config.fields.filter((f) => f.name !== 'positive').every((f) => !f.required)).toBe(true);
    });

    it('German: positive*, komparativ, superlativ', () => {
        const config = getFormConfig(PartOfSpeech.adjective, Lang.DE)!;
        expect(config.fields.map((f) => f.name)).toEqual(['positive', 'komparativ', 'superlativ']);
        expect(config.fields.find((f) => f.name === 'positive')?.required).toBe(true);
        expect(config.fields.filter((f) => f.name !== 'positive').every((f) => !f.required)).toBe(true);
    });

    it('German: the superlative shows a fixed "am" prefix (D25: stored without it)', () => {
        const config = getFormConfig(PartOfSpeech.adjective, Lang.DE)!;
        expect(config.fields.find((f) => f.name === 'superlativ')?.adornment).toEqual({ text: 'am' });
        expect(config.fields.find((f) => f.name === 'komparativ')?.adornment).toBeUndefined();
    });

    it('Spanish: the gender radio takes the branch from a lookup result', () => {
        const gender = getFormConfig(PartOfSpeech.adjective, Lang.ES)!.fields.find((f) => f.name === 'gender');
        const fromLookup = gender?.kind === 'radio' ? gender.fromLookup : undefined;
        expect(fromLookup?.(new Map([[AdjectiveCases.neutralSingularES, 'feliz']]))).toBe('Neutral');
        expect(fromLookup?.(new Map([[AdjectiveCases.maleSingularES, 'rojo']]))).toBe('M/F');
        expect(fromLookup?.(new Map())).toBeUndefined();
    });

    it('Estonian: algvorre*, keskvorre*, an optional ulivorre with its "kõige" checkbox, 5 optional case fields (D20)', () => {
        const config = getFormConfig(PartOfSpeech.adjective, Lang.EE)!;
        expect(config.fields.map((f) => f.name)).toEqual([
            'algvorre',
            'keskvorre',
            'ulivorre',
            'periphrasticSuperlative',
            'pluralNimetav',
            'singularOmastav',
            'pluralOmastav',
            'singularOsastav',
            'pluralOsastav',
        ]);
        const required = ['algvorre', 'keskvorre'];
        for (const name of required) {
            expect(config.fields.find((f) => f.name === name)?.required).toBe(true);
        }
        expect(config.fields.filter((f) => !required.includes(f.name)).every((f) => !f.required)).toBe(true);
    });

    it('Estonian superlative: derived from the comparative while the checkbox is checked; the checkbox is stored (D20)', () => {
        const fields = getFormConfig(PartOfSpeech.adjective, Lang.EE)!.fields;
        const ulivorre = fields.find((f) => f.name === 'ulivorre');
        expect(ulivorre?.kind === 'text' && ulivorre.derivedWhen).toEqual({
            when: { field: 'periphrasticSuperlative', equals: true },
            prefix: 'kõige ',
            fromField: 'keskvorre',
        });
        const flag = fields.find((f) => f.name === 'periphrasticSuperlative');
        expect(flag).toMatchObject({ kind: 'checkbox', caseName: AdjectiveCases.periphrasticSuperlativeEE });
        expect(flag && isStoredCheckbox(flag)).toBe(true);
    });

    it('Estonian layout: positive/comparative/superlative share one row; omastav and osastav pair singular/plural', () => {
        const config = getFormConfig(PartOfSpeech.adjective, Lang.EE)!;
        expect(config.fields.find((f) => f.name === 'algvorre')?.layout).toEqual({ row: 'degree', column: 'Positive' });
        expect(config.fields.find((f) => f.name === 'keskvorre')?.layout).toEqual({ row: 'degree', column: 'Comparative' });
        expect(config.fields.find((f) => f.name === 'ulivorre')?.layout).toEqual({ row: 'degree', column: 'Superlative' });
        expect(config.fields.find((f) => f.name === 'pluralNimetav')?.layout).toBeUndefined();
        expect(config.fields.find((f) => f.name === 'singularOmastav')?.layout).toEqual({ row: 'omastav', column: 'Singular' });
        expect(config.fields.find((f) => f.name === 'pluralOmastav')?.layout).toEqual({ row: 'omastav', column: 'Plural' });
        expect(config.fields.find((f) => f.name === 'singularOsastav')?.layout).toEqual({ row: 'osastav', column: 'Singular' });
        expect(config.fields.find((f) => f.name === 'pluralOsastav')?.layout).toEqual({ row: 'osastav', column: 'Plural' });
    });

    describe('Spanish — gender-branched field set', () => {
        const config = getFormConfig(PartOfSpeech.adjective, Lang.ES)!;

        it('the full config carries gender plus every branch field, gender case-less', () => {
            expect(config.fields.map((f) => f.name)).toEqual([
                'gender',
                'neutralSingular',
                'neutralPlural',
                'maleSingular',
                'malePlural',
                'femaleSingular',
                'femalePlural',
            ]);
            const gender = config.fields.find((f) => f.name === 'gender')!;
            expect(gender.persisted).toBe(false);
            expect(gender.caseName).toBeUndefined();
            expect(gender.required).toBe(true);
        });

        it('Neutral branch renders exactly neutralSingular, neutralPlural — both required', () => {
            expect(visibleNames(config.fields, { gender: 'Neutral' })).toEqual(['gender', 'neutralSingular', 'neutralPlural']);
            expect(config.fields.find((f) => f.name === 'neutralSingular')?.required).toBe(true);
            expect(config.fields.find((f) => f.name === 'neutralPlural')?.required).toBe(true);
        });

        it('M/F branch renders exactly maleSingular, malePlural, femaleSingular, femalePlural — only the singulars required', () => {
            expect(visibleNames(config.fields, { gender: 'M/F' })).toEqual([
                'gender',
                'maleSingular',
                'malePlural',
                'femaleSingular',
                'femalePlural',
            ]);
            expect(config.fields.find((f) => f.name === 'maleSingular')?.required).toBe(true);
            expect(config.fields.find((f) => f.name === 'femaleSingular')?.required).toBe(true);
            expect(config.fields.find((f) => f.name === 'malePlural')?.required).toBe(false);
            expect(config.fields.find((f) => f.name === 'femalePlural')?.required).toBe(false);
        });

        it('neither branch renders while gender is unset', () => {
            expect(visibleNames(config.fields, { gender: '' })).toEqual(['gender']);
        });

        it('layout pairs singular/plural onto the same row, one row per gender branch', () => {
            expect(config.fields.find((f) => f.name === 'neutralSingular')?.layout).toEqual({
                row: 'neutral',
                column: 'Singular',
            });
            expect(config.fields.find((f) => f.name === 'neutralPlural')?.layout).toEqual({
                row: 'neutral',
                column: 'Plural',
            });
            expect(config.fields.find((f) => f.name === 'maleSingular')?.layout).toEqual({
                row: 'male',
                column: 'Singular',
            });
            expect(config.fields.find((f) => f.name === 'femalePlural')?.layout).toEqual({
                row: 'female',
                column: 'Plural',
            });
            expect(config.fields.find((f) => f.name === 'gender')?.layout).toBeUndefined();
        });
    });

    describe('French (language-french.md, slice 4)', () => {
        const fields = () => getFormConfig(PartOfSpeech.adjective, Lang.FR)!.fields;
        const named = (name: string) => fields().find((f) => f.name === name);

        it('maleSingular*, malePlural, femaleSingular*, femalePlural, comparative, "plus" box, vowel box, vowel form*, position', () => {
            expect(fields().map((f) => f.name)).toEqual([
                'maleSingular', 'malePlural', 'femaleSingular', 'femalePlural', 'comparative', 'periphrastic', 'hasVowelForm', 'vowelForm', 'position',
            ]);
            // Only the singulars are required, like the Spanish M/F branch; the vowel form is required only while it shows.
            expect(fields().filter((f) => f.required).map((f) => f.name)).toEqual(['maleSingular', 'femaleSingular', 'vowelForm']);
        });

        it('has no separate superlative: French builds it from the comparative', () => {
            expect(fields().some((f) => (f.caseName ?? '').toLowerCase().startsWith('superlative'))).toBe(false);
        });

        it('layout pairs singular/plural on one row, one row per gender', () => {
            expect(named('maleSingular')?.layout).toEqual({ row: 'male', column: 'Singular' });
            expect(named('malePlural')?.layout).toEqual({ row: 'male', column: 'Plural' });
            expect(named('femaleSingular')?.layout).toEqual({ row: 'female', column: 'Singular' });
            expect(named('femalePlural')?.layout).toEqual({ row: 'female', column: 'Plural' });
        });

        it('comparative: with the "plus" box on it shows and saves "plus " + the masculine singular', () => {
            const comparative = named('comparative');
            expect(comparative?.kind === 'text' && comparative.derivedWhen).toEqual({
                when: { field: 'periphrastic', equals: true },
                prefix: 'plus ',
                fromField: 'maleSingular',
                store: true,
            });
            const flag = named('periphrastic');
            expect(flag).toMatchObject({ kind: 'checkbox', caseName: AdjectiveCases.periphrasticFR });
            expect(flag && isStoredCheckbox(flag)).toBe(true);
            const comparativeField = comparative!;
            expect(isDerived(comparativeField, { periphrastic: true })).toBe(true);
            expect(isDerived(comparativeField, { periphrastic: false })).toBe(false);
            expect(derivedStoredWord(comparativeField, { periphrastic: true, maleSingular: 'grand' })).toBe('plus grand');
            expect(derivedStoredWord(comparativeField, { periphrastic: false, maleSingular: 'bon' })).toBeUndefined();
        });

        it('the vowel form shows only while its box is on', () => {
            expect(visibleNames(fields(), { hasVowelForm: false })).not.toContain('vowelForm');
            expect(visibleNames(fields(), { hasVowelForm: true })).toContain('vowelForm');
            expect(named('hasVowelForm')).toMatchObject({ kind: 'checkbox', caseName: AdjectiveCases.hasVowelFormFR });
        });

        it('the position is an optional radio with the three positions', () => {
            const position = named('position');
            expect(position).toMatchObject({ kind: 'radio', required: false, caseName: AdjectiveCases.positionFR });
            expect(position?.kind === 'radio' && position.options.map((o) => o.value)).toEqual([
                'Before the noun', 'After the noun', 'Before or after the noun',
            ]);
        });
    });

    it('every field.caseName is field.name + the language suffix, except persisted:false fields', () => {
        for (const lang of [Lang.EN, Lang.ES, Lang.DE, Lang.EE, Lang.FR]) {
            const config = getFormConfig(PartOfSpeech.adjective, lang)!;
            for (const field of config.fields) {
                if (field.persisted === false) continue;
                expect(field.caseName).toBe(`${field.name}${LANG_SUFFIX[lang]}`);
            }
        }
    });
});
