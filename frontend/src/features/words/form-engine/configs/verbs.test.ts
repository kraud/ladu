/**
 * Regression test: the config-driven field lists must equal the old
 * `VerbForm{EN,ES,DE,EE}` field lists transcribed verbatim in
 * `.context/.frontend/snapshot/forms-verbs.md`.
 */
import { describe, expect, it } from 'vitest';
import { Lang, PartOfSpeech } from '@/ts/enums';
import { getFormConfig } from './index';

/** `auxiliaryVerb`/`caseTypeDE->verbCases` don't derive their `name` from `caseName` mechanically — old-app naming quirks the manifest reproduces on purpose. */
const NAME_SUFFIX_EXCEPTIONS = new Set(['auxiliaryVerb', 'verbCases']);

describe('getFormConfig(Verb, lang) — old field-list parity', () => {
    it('English: regularity, 4 simple tenses x 5 pronoun slots', () => {
        const config = getFormConfig(PartOfSpeech.verb, Lang.EN)!;
        expect(config.fields.map((f) => f.name)).toEqual([
            'regularity',
            'simplePresent1s',
            'simplePresent2s',
            'simplePresent3s',
            'simplePresent1pl',
            'simplePresent3pl',
            'simplePast1s',
            'simplePast2s',
            'simplePast3s',
            'simplePast1pl',
            'simplePast3pl',
            'simpleFuture1s',
            'simpleFuture2s',
            'simpleFuture3s',
            'simpleFuture1pl',
            'simpleFuture3pl',
            'simpleConditional1s',
            'simpleConditional2s',
            'simpleConditional3s',
            'simpleConditional1pl',
            'simpleConditional3pl',
        ]);
        expect(config.fields.find((f) => f.name === 'simplePresent1s')?.required).toBe(true);
        expect(config.fields.filter((f) => f.name !== 'simplePresent1s').every((f) => !f.required)).toBe(true);
    });

    it('Spanish: 3 non-finites, regularity, 4 indicative simple tenses x 6 pronoun slots — no conditional/imperative', () => {
        const config = getFormConfig(PartOfSpeech.verb, Lang.ES)!;
        expect(config.fields.map((f) => f.name)).toEqual([
            'infinitiveNonFiniteSimple',
            'gerundNonFiniteSimple',
            'participleNonFiniteSimple',
            'regularity',
            'indicativePresent1s',
            'indicativePresent2s',
            'indicativePresent3s',
            'indicativePresent1pl',
            'indicativePresent2pl',
            'indicativePresent3pl',
            'indicativeImperfectPast1s',
            'indicativeImperfectPast2s',
            'indicativeImperfectPast3s',
            'indicativeImperfectPast1pl',
            'indicativeImperfectPast2pl',
            'indicativeImperfectPast3pl',
            'indicativePerfectSimplePast1s',
            'indicativePerfectSimplePast2s',
            'indicativePerfectSimplePast3s',
            'indicativePerfectSimplePast1pl',
            'indicativePerfectSimplePast2pl',
            'indicativePerfectSimplePast3pl',
            'indicativeFuture1s',
            'indicativeFuture2s',
            'indicativeFuture3s',
            'indicativeFuture1pl',
            'indicativeFuture2pl',
            'indicativeFuture3pl',
        ]);
        const requiredNames = ['infinitiveNonFiniteSimple', 'gerundNonFiniteSimple', 'participleNonFiniteSimple'];
        for (const name of requiredNames) {
            expect(config.fields.find((f) => f.name === name)?.required).toBe(true);
        }
        expect(config.fields.filter((f) => !requiredNames.includes(f.name)).every((f) => !f.required)).toBe(true);
    });

    it('German: infinitive, regularity, auxiliaryVerb, prefix, verbCases, 4 tenses x 6 pronoun slots', () => {
        const config = getFormConfig(PartOfSpeech.verb, Lang.DE)!;
        expect(config.fields.map((f) => f.name)).toEqual([
            'infinitive',
            'regularity',
            'auxiliaryVerb',
            'prefix',
            'verbCases',
            'indicativePresent1s',
            'indicativePresent2s',
            'indicativePresent3s',
            'indicativePresent1pl',
            'indicativePresent2pl',
            'indicativePresent3pl',
            'indicativePerfect1s',
            'indicativePerfect2s',
            'indicativePerfect3s',
            'indicativePerfect1pl',
            'indicativePerfect2pl',
            'indicativePerfect3pl',
            'indicativeSimpleFuture1s',
            'indicativeSimpleFuture2s',
            'indicativeSimpleFuture3s',
            'indicativeSimpleFuture1pl',
            'indicativeSimpleFuture2pl',
            'indicativeSimpleFuture3pl',
            'indicativeSimplePast1s',
            'indicativeSimplePast2s',
            'indicativeSimplePast3s',
            'indicativeSimplePast1pl',
            'indicativeSimplePast2pl',
            'indicativeSimplePast3pl',
        ]);
        expect(config.fields.find((f) => f.name === 'infinitive')?.required).toBe(true);
        expect(config.fields.filter((f) => f.name !== 'infinitive').every((f) => !f.required)).toBe(true);
    });

    it('Estonian: searchInEnglish, -ma/-da infinitives, regularity, 3 tenses x 6 pronoun slots', () => {
        const config = getFormConfig(PartOfSpeech.verb, Lang.EE)!;
        expect(config.fields.map((f) => f.name)).toEqual([
            'searchInEnglish',
            'infinitiveMa',
            'infinitiveDa',
            'regularity',
            'kindelPresent1s',
            'kindelPresent2s',
            'kindelPresent3s',
            'kindelPresent1pl',
            'kindelPresent2pl',
            'kindelPresent3pl',
            'kindelSimplePast1s',
            'kindelSimplePast2s',
            'kindelSimplePast3s',
            'kindelSimplePast1pl',
            'kindelSimplePast2pl',
            'kindelSimplePast3pl',
            'kindelPastPerfect1s',
            'kindelPastPerfect2s',
            'kindelPastPerfect3s',
            'kindelPastPerfect1pl',
            'kindelPastPerfect2pl',
            'kindelPastPerfect3pl',
        ]);
        const requiredNames = ['infinitiveMa', 'infinitiveDa'];
        for (const name of requiredNames) {
            expect(config.fields.find((f) => f.name === name)?.required).toBe(true);
        }
        expect(config.fields.filter((f) => !requiredNames.includes(f.name)).every((f) => !f.required)).toBe(true);
    });

    it('every field.caseName is field.name + the language suffix, except old-app naming quirks and persisted:false fields', () => {
        const suffixes: Record<Lang, string> = { [Lang.EN]: 'EN', [Lang.ES]: 'ES', [Lang.DE]: 'DE', [Lang.EE]: 'EE' };
        for (const lang of [Lang.EN, Lang.ES, Lang.DE, Lang.EE]) {
            const config = getFormConfig(PartOfSpeech.verb, lang)!;
            for (const field of config.fields) {
                if (field.persisted === false) continue;
                if (NAME_SUFFIX_EXCEPTIONS.has(field.name)) continue;
                expect(field.caseName).toBe(`${field.name}${suffixes[lang]}`);
            }
        }
    });

    it('searchInEnglish (EE) has no backing case and is dropped from persistence', () => {
        const config = getFormConfig(PartOfSpeech.verb, Lang.EE)!;
        const field = config.fields.find((f) => f.name === 'searchInEnglish')!;
        expect(field.persisted).toBe(false);
        expect(field.caseName).toBeUndefined();
    });

    it('every conjugation field carries a non-empty pronoun label', () => {
        for (const lang of [Lang.EN, Lang.ES, Lang.DE, Lang.EE]) {
            const config = getFormConfig(PartOfSpeech.verb, lang)!;
            const conjugationFields = config.fields.filter((f) => f.group !== undefined);
            expect(conjugationFields.length).toBeGreaterThan(0);
            for (const field of conjugationFields) {
                expect(field.label).toBeTruthy();
            }
        }
    });
});
