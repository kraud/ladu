import { describe, expect, it } from 'vitest';
import { Lang, PartOfSpeech } from '@/ts/enums';
import { buildYupSchema } from './buildYupSchema';
import { getFormConfig } from './configs';

/** Identity translate — messages assert on the key itself. */
const t = (key: string) => key;

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
});
