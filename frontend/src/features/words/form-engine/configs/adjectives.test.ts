/**
 * Regression test: the config-driven field lists must equal the old
 * `AdjectiveForm{EN,ES,DE,EE}` field lists transcribed verbatim in
 * `.context/.frontend/snapshot/forms-adjectives-adverbs.md`.
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

    it('Estonian: algvorre*, keskvorre*, ulivorre*, 5 optional case fields', () => {
        const config = getFormConfig(PartOfSpeech.adjective, Lang.EE)!;
        expect(config.fields.map((f) => f.name)).toEqual([
            'algvorre',
            'keskvorre',
            'ulivorre',
            'pluralNimetav',
            'singularOmastav',
            'pluralOmastav',
            'singularOsastav',
            'pluralOsastav',
        ]);
        const required = ['algvorre', 'keskvorre', 'ulivorre'];
        for (const name of required) {
            expect(config.fields.find((f) => f.name === name)?.required).toBe(true);
        }
        expect(config.fields.filter((f) => !required.includes(f.name)).every((f) => !f.required)).toBe(true);
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

    it('every field.caseName is field.name + the language suffix, except persisted:false fields', () => {
        const suffixes: Record<Lang, string> = { [Lang.EN]: 'EN', [Lang.ES]: 'ES', [Lang.DE]: 'DE', [Lang.EE]: 'EE' };
        for (const lang of [Lang.EN, Lang.ES, Lang.DE, Lang.EE]) {
            const config = getFormConfig(PartOfSpeech.adjective, lang)!;
            for (const field of config.fields) {
                if (field.persisted === false) continue;
                expect(field.caseName).toBe(`${field.name}${suffixes[lang]}`);
            }
        }
    });
});
