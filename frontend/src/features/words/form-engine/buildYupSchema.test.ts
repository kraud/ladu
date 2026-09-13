import { describe, expect, it } from 'vitest';
import { Lang, NounCases, PartOfSpeech } from '@/ts/enums';
import { buildYupSchema } from './buildYupSchema';
import { getFormConfig } from './configs';
import type { FieldConfig, TranslationFormConfig } from './configs/types';

/** Identity translate — messages assert on the key itself. */
const t = (key: string) => key;

/** A minimal one-field config for exercising a `FieldConfig` kind in isolation — Slice 1's new kinds have no real noun/verb config to borrow yet (that's Slice 2/3). */
function configOf(...fields: FieldConfig[]): TranslationFormConfig {
    return { pos: PartOfSpeech.verb, lang: Lang.DE, fields };
}

const CASE_NAME = NounCases.singularEN; // arbitrary — the schema never inspects it.

describe('buildYupSchema', () => {
    it('rejects a missing required field (EN singular)', async () => {
        const schema = buildYupSchema(getFormConfig(PartOfSpeech.noun, Lang.EN)!, t);
        await expect(schema.validate({ regularity: '', singular: '', plural: '' })).rejects.toMatchObject({
            message: 'wordRelated:wordForm.noun.errors.formEN.singularFormRequired',
        });
    });

    it('accepts a filled required field and empty optional ones (EN)', async () => {
        const schema = buildYupSchema(getFormConfig(PartOfSpeech.noun, Lang.EN)!, t);
        await expect(schema.validate({ regularity: '', singular: 'cat', plural: '' })).resolves.toBeTruthy();
    });

    it('rejects numbers in a text field (noNumbers)', async () => {
        const schema = buildYupSchema(getFormConfig(PartOfSpeech.noun, Lang.EN)!, t);
        await expect(schema.validate({ regularity: '', singular: 'cat3', plural: '' })).rejects.toMatchObject({
            message: 'wordRelated:wordForm.errors.noNumbers',
        });
    });

    it('rejects an out-of-range regularity value', async () => {
        const schema = buildYupSchema(getFormConfig(PartOfSpeech.noun, Lang.EN)!, t);
        await expect(schema.validate({ regularity: 'banana', singular: 'cat', plural: '' })).rejects.toMatchObject({
            message: 'wordRelated:wordForm.noun.errors.formEN.regularityRequired',
        });
    });

    it('accepts a valid regularity value', async () => {
        const schema = buildYupSchema(getFormConfig(PartOfSpeech.noun, Lang.EN)!, t);
        await expect(schema.validate({ regularity: 'irregular', singular: 'cat', plural: '' })).resolves.toBeTruthy();
    });

    it('requires and constrains gender (ES)', async () => {
        const schema = buildYupSchema(getFormConfig(PartOfSpeech.noun, Lang.ES)!, t);
        await expect(schema.validate({ gender: '', regularity: '', singular: 'gato', plural: '' })).rejects.toMatchObject({
            message: 'wordRelated:wordForm.noun.errors.formES.genderRequired',
        });
        await expect(schema.validate({ gender: 'nope', regularity: '', singular: 'gato', plural: '' })).rejects.toMatchObject(
            { message: 'wordRelated:wordForm.noun.errors.formES.genderRequired' }
        );
        await expect(
            schema.validate({ gender: 'la', regularity: '', singular: 'gato', plural: '' })
        ).resolves.toBeTruthy();
    });

    it('requires the German singularNominativ, leaves the rest optional', async () => {
        const schema = buildYupSchema(getFormConfig(PartOfSpeech.noun, Lang.DE)!, t);
        await expect(
            schema.validate({
                gender: 'der',
                regularity: '',
                singularNominativ: '',
                pluralNominativ: '',
                singularAkkusativ: '',
                pluralAkkusativ: '',
                singularGenitiv: '',
                pluralGenitiv: '',
                singularDativ: '',
                pluralDativ: '',
            })
        ).rejects.toMatchObject({ message: 'wordRelated:wordForm.noun.errors.formDE.singularFormRequired' });
    });

    describe('select field', () => {
        const field: FieldConfig = {
            kind: 'select',
            name: 'auxiliaryVerb',
            caseName: CASE_NAME,
            labelKey: 'auxiliaryVerb',
            required: true,
            requiredMessageKey: 'auxRequired',
            options: [
                { value: 'haben', label: 'haben' },
                { value: 'sein', label: 'sein' },
            ],
        };

        it('rejects a missing required value', async () => {
            const schema = buildYupSchema(configOf(field), t);
            await expect(schema.validate({ auxiliaryVerb: '' })).rejects.toMatchObject({ message: 'auxRequired' });
        });

        it('rejects a value outside the option list', async () => {
            const schema = buildYupSchema(configOf(field), t);
            await expect(schema.validate({ auxiliaryVerb: 'werden' })).rejects.toMatchObject({
                message: 'auxRequired',
            });
        });

        it('accepts a value from the option list', async () => {
            const schema = buildYupSchema(configOf(field), t);
            await expect(schema.validate({ auxiliaryVerb: 'sein' })).resolves.toBeTruthy();
        });

        it('an optional select accepts an empty value', async () => {
            const optional: FieldConfig = { ...field, required: false, requiredMessageKey: undefined };
            const schema = buildYupSchema(configOf(optional), t);
            await expect(schema.validate({ auxiliaryVerb: '' })).resolves.toBeTruthy();
        });
    });

    describe('multi-select field', () => {
        const field: FieldConfig = {
            kind: 'multi-select',
            name: 'verbCases',
            caseName: CASE_NAME,
            labelKey: 'verbCases',
            required: false,
            options: [
                { value: 'accusativeDE', label: 'Accusative' },
                { value: 'dativeDE', label: 'Dative' },
                { value: 'genitiveDE', label: 'Genitive' },
            ],
            encode: (selected) => selected.map((v) => v[0].toUpperCase()).join(''),
            decode: (word) =>
                word
                    .split('')
                    .map((letter) => ({ A: 'accusativeDE', D: 'dativeDE', G: 'genitiveDE' })[letter])
                    .filter((v): v is string => !!v),
        };

        it('accepts an empty selection', async () => {
            const schema = buildYupSchema(configOf(field), t);
            await expect(schema.validate({ verbCases: [] })).resolves.toBeTruthy();
        });

        it('accepts several selected options', async () => {
            const schema = buildYupSchema(configOf(field), t);
            await expect(schema.validate({ verbCases: ['accusativeDE', 'dativeDE'] })).resolves.toBeTruthy();
        });
    });

    describe('text field pattern', () => {
        const field: FieldConfig = {
            kind: 'text',
            name: 'infinitive',
            caseName: CASE_NAME,
            labelKey: 'infinitive',
            required: true,
            requiredMessageKey: 'infinitiveRequired',
            lowercase: true,
            pattern: { regex: /^(?!.*\d).*(ar|er|ir)$/, messageKey: 'infinitiveEnding' },
        };

        it('rejects a value that satisfies the base rules but not the extra pattern', async () => {
            const schema = buildYupSchema(configOf(field), t);
            await expect(schema.validate({ infinitive: 'hablando' })).rejects.toMatchObject({
                message: 'infinitiveEnding',
            });
        });

        it('accepts a value satisfying both the base rules and the pattern', async () => {
            const schema = buildYupSchema(configOf(field), t);
            await expect(schema.validate({ infinitive: 'hablar' })).resolves.toBeTruthy();
        });
    });

    describe('visibleWhen', () => {
        const gender: FieldConfig = {
            kind: 'radio',
            name: 'gender',
            caseName: CASE_NAME,
            labelKey: 'gender',
            required: true,
            requiredMessageKey: 'genderRequired',
            persisted: false,
            options: [
                { value: 'Neutral', label: 'Neutral' },
                { value: 'M/F', label: 'M/F' },
            ],
        };
        const neutralSingular: FieldConfig = {
            kind: 'text',
            name: 'neutralSingular',
            caseName: CASE_NAME,
            labelKey: 'neutralSingular',
            required: true,
            requiredMessageKey: 'neutralSingularRequired',
            lowercase: true,
            visibleWhen: { field: 'gender', equals: 'Neutral' },
        };

        it('enforces the required rule while the controlling field matches', async () => {
            const schema = buildYupSchema(configOf(gender, neutralSingular), t);
            await expect(
                schema.validate({ gender: 'Neutral', neutralSingular: '' }),
            ).rejects.toMatchObject({ message: 'neutralSingularRequired' });
        });

        it('drops the required rule (accepts empty) once the controlling field no longer matches', async () => {
            const schema = buildYupSchema(configOf(gender, neutralSingular), t);
            await expect(
                schema.validate({ gender: 'M/F', neutralSingular: '' }),
            ).resolves.toBeTruthy();
        });

        it('still accepts a filled value while hidden', async () => {
            const schema = buildYupSchema(configOf(gender, neutralSingular), t);
            await expect(
                schema.validate({ gender: 'M/F', neutralSingular: 'leftover' }),
            ).resolves.toBeTruthy();
        });
    });
});
