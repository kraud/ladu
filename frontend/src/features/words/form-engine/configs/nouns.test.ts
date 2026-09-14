/**
 * Regression test: the config-driven field lists must equal the old
 * `NounForm{EN,ES,DE,EE}` field lists transcribed verbatim in
 * `.context/.frontend/snapshot/forms-nouns.md`. This is the one place old
 * and new are diffed mechanically — it stays as the engine's guard when
 * Phase 3 adds Verb / Adjective / Adverb configs.
 */
import { describe, expect, it } from 'vitest';
import { Lang, PartOfSpeech } from '@/ts/enums';
import { getFormConfig } from './index';

describe('getFormConfig(Noun, lang) — old field-list parity', () => {
    it('English: regularity, singular*, plural', () => {
        const config = getFormConfig(PartOfSpeech.noun, Lang.EN)!;
        expect(config.fields.map((f) => f.name)).toEqual(['regularity', 'singular', 'plural']);
        expect(config.fields.find((f) => f.name === 'singular')?.required).toBe(true);
        expect(config.fields.find((f) => f.name === 'plural')?.required).toBe(false);
        expect(config.fields.find((f) => f.name === 'regularity')?.required).toBe(false);
    });

    it('Spanish: gender, regularity, singular*, plural', () => {
        const config = getFormConfig(PartOfSpeech.noun, Lang.ES)!;
        expect(config.fields.map((f) => f.name)).toEqual(['gender', 'regularity', 'singular', 'plural']);
        expect(config.fields.find((f) => f.name === 'gender')?.required).toBe(true);
        expect(config.fields.find((f) => f.name === 'singular')?.required).toBe(true);
        expect(config.fields.find((f) => f.name === 'plural')?.required).toBe(false);
    });

    it('German: gender, regularity, 4 declensions x singular/plural', () => {
        const config = getFormConfig(PartOfSpeech.noun, Lang.DE)!;
        expect(config.fields.map((f) => f.name)).toEqual([
            'gender',
            'regularity',
            'singularNominativ',
            'pluralNominativ',
            'singularAkkusativ',
            'pluralAkkusativ',
            'singularGenitiv',
            'pluralGenitiv',
            'singularDativ',
            'pluralDativ',
        ]);
        expect(config.fields.find((f) => f.name === 'gender')?.required).toBe(true);
        expect(config.fields.find((f) => f.name === 'singularNominativ')?.required).toBe(true);
        expect(config.fields.filter((f) => f.name !== 'gender' && f.name !== 'singularNominativ').every((f) => !f.required)).toBe(
            true
        );
    });

    it('Estonian: regularity, 3 declensions x singular/plural, shortForm', () => {
        const config = getFormConfig(PartOfSpeech.noun, Lang.EE)!;
        expect(config.fields.map((f) => f.name)).toEqual([
            'regularity',
            'singularNimetav',
            'pluralNimetav',
            'singularOmastav',
            'pluralOmastav',
            'singularOsastav',
            'pluralOsastav',
            'shortForm',
        ]);
        expect(config.fields.find((f) => f.name === 'singularNimetav')?.required).toBe(true);
        expect(config.fields.filter((f) => f.name !== 'singularNimetav').every((f) => !f.required)).toBe(true);
    });

    it('every field.caseName is field.name + the language suffix', () => {
        const suffixes: Record<Lang, string> = { [Lang.EN]: 'EN', [Lang.ES]: 'ES', [Lang.DE]: 'DE', [Lang.EE]: 'EE' };
        for (const lang of [Lang.EN, Lang.ES, Lang.DE, Lang.EE]) {
            const config = getFormConfig(PartOfSpeech.noun, lang)!;
            for (const field of config.fields) {
                expect(field.caseName).toBe(`${field.name}${suffixes[lang]}`);
            }
        }
    });

    describe('layout — singular/plural pair onto the same row', () => {
        it('German: each declension pairs its singular and plural under one row key, columns are Singular/Plural', () => {
            const config = getFormConfig(PartOfSpeech.noun, Lang.DE)!;
            expect(config.fields.find((f) => f.name === 'singularNominativ')?.layout).toEqual({
                row: 'Nominative',
                column: 'Singular',
            });
            expect(config.fields.find((f) => f.name === 'pluralNominativ')?.layout).toEqual({
                row: 'Nominative',
                column: 'Plural',
            });
            expect(config.fields.find((f) => f.name === 'singularDativ')?.layout).toEqual({
                row: 'Dative',
                column: 'Singular',
            });
        });

        it('gender and regularity are not paired', () => {
            const config = getFormConfig(PartOfSpeech.noun, Lang.DE)!;
            expect(config.fields.find((f) => f.name === 'gender')?.layout).toBeUndefined();
            expect(config.fields.find((f) => f.name === 'regularity')?.layout).toBeUndefined();
        });

        it('Estonian: the shortForm property field is not paired', () => {
            const config = getFormConfig(PartOfSpeech.noun, Lang.EE)!;
            expect(config.fields.find((f) => f.name === 'shortForm')?.layout).toBeUndefined();
            expect(config.fields.find((f) => f.name === 'singularNimetav')?.layout).toEqual({
                row: 'Nominative',
                column: 'Singular',
            });
        });
    });
});
