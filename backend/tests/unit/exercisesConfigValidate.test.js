// Pure request validation for saved practice configurations (no database).
const { validateConfigRequest } = require('../../services/exercises/validateConfig');

const UUID = '11111111-1111-4111-8111-111111111111';
const body = (over = {}) => ({
    name: 'Morning drill',
    params: {
        languages: ['English', 'Spanish'],
        partsOfSpeech: ['Noun'],
        amount: 10,
        type: 'Text-Input',
        multiLang: 'Random',
        strictnessTI: 3,
    },
    ...over,
});

describe('validateConfigRequest', () => {
    it('accepts a valid body and applies defaults', () => {
        const result = validateConfigRequest(body());
        expect(result.ok).toBe(true);
        expect(result.value).toMatchObject({ name: 'Morning drill', description: null, wordIds: null });
        expect(result.value.params).toMatchObject({
            wordSelection: 'Exercise-Performance',
            excludeNative: false,
            difficultyMC: 1,
            strictnessTI: 3,
        });
        expect(result.value.params).not.toHaveProperty('wordIds');
    });

    it('defaults strictnessTI to 2', () => {
        const b = body();
        delete b.params.strictnessTI;
        expect(validateConfigRequest(b).value.params.strictnessTI).toBe(2);
    });

    it('trims the name and the description; an empty description becomes null', () => {
        const a = validateConfigRequest(body({ name: '  Drill  ', description: '  Nouns only ' }));
        expect(a.value).toMatchObject({ name: 'Drill', description: 'Nouns only' });
        expect(validateConfigRequest(body({ description: '   ' })).value.description).toBeNull();
    });

    it.each([
        ['missing name', { name: undefined }],
        ['blank name', { name: '   ' }],
        ['name too long', { name: 'x'.repeat(61) }],
        ['non-string name', { name: 5 }],
    ])('rejects %s', (_label, over) => {
        expect(validateConfigRequest(body(over))).toMatchObject({ ok: false, code: 'invalid_name' });
    });

    it('rejects a description that is too long', () => {
        expect(validateConfigRequest(body({ description: 'x'.repeat(201) }))).toMatchObject({
            ok: false,
            code: 'invalid_description',
        });
    });

    it('rejects a body or params that is not an object', () => {
        expect(validateConfigRequest(null)).toMatchObject({ ok: false, code: 'invalid_body' });
        expect(validateConfigRequest(body({ params: [] }))).toMatchObject({ ok: false, code: 'invalid_params' });
    });

    it('rejects a strictnessTI outside 1–3', () => {
        const b = body();
        b.params.strictnessTI = 4;
        expect(validateConfigRequest(b)).toMatchObject({ ok: false, code: 'invalid_strictness' });
    });

    it('reuses the generate rules for the settings', () => {
        const b = body();
        b.params.amount = 0;
        expect(validateConfigRequest(b)).toMatchObject({ ok: false, code: 'invalid_amount' });
        const c = body();
        c.params.languages = ['English'];
        c.params.multiLang = 'Multi-Language';
        expect(validateConfigRequest(c)).toMatchObject({ ok: false, code: 'invalid_languages' });
    });

    it('takes word ids from the top level: de-duplicated, empty list = none', () => {
        expect(validateConfigRequest(body({ wordIds: [UUID, UUID] })).value.wordIds).toEqual([UUID]);
        expect(validateConfigRequest(body({ wordIds: [] })).value.wordIds).toBeNull();
        // The client sends null for "no words".
        expect(validateConfigRequest(body({ wordIds: null })).value.wordIds).toBeNull();
        expect(validateConfigRequest(body({ wordIds: ['nope'] }))).toMatchObject({
            ok: false,
            code: 'invalid_word_ids',
        });
    });

    it('rejects word ids hidden inside params', () => {
        const b = body();
        b.params.wordIds = [UUID];
        expect(validateConfigRequest(b)).toMatchObject({ ok: false, code: 'invalid_params' });
    });
});
