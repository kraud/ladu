// Pure request validation + response shaping (no database).
const V = require('../../services/exercises/validate');
const P = require('../../services/exercises/present');
const { seededRng } = require('../../services/exercises/rng');
const { NOW } = require('./exercisesFixtures');

const UUID = '11111111-1111-4111-8111-111111111111';
const validBody = () => ({
    languages: ['English', 'Spanish'],
    partsOfSpeech: ['Noun'],
    amount: 10,
    type: 'Text-Input',
    multiLang: 'Random',
});

describe('validateGenerateRequest', () => {
    it('applies defaults and de-duplicates lists', () => {
        const result = V.validateGenerateRequest({ ...validBody(), languages: ['English', 'English', 'German'] });
        expect(result).toEqual({
            ok: true,
            value: {
                languages: ['English', 'German'],
                partsOfSpeech: ['Noun'],
                amount: 10,
                type: 'Text-Input',
                multiLang: 'Random',
                difficultyMC: 1,
                wordSelection: 'Exercise-Performance',
                excludeNative: false,
                wordIds: undefined,
            },
        });
    });

    it('treats an empty wordIds list as "no pre-selection"', () => {
        expect(V.validateGenerateRequest({ ...validBody(), wordIds: [] }).value.wordIds).toBeUndefined();
        expect(V.validateGenerateRequest({ ...validBody(), wordIds: [UUID, UUID] }).value.wordIds).toEqual([UUID]);
    });

    it('accepts difficulty 0 (falsy but valid)', () => {
        expect(V.validateGenerateRequest({ ...validBody(), difficultyMC: 0 }).value.difficultyMC).toBe(0);
    });

    it.each([null, 'text', [], 5])('rejects a non-object body: %p', (body) => {
        expect(V.validateGenerateRequest(body)).toMatchObject({ ok: false, code: 'invalid_body' });
    });

    it('rejects NaN and Infinity amounts', () => {
        expect(V.validateGenerateRequest({ ...validBody(), amount: NaN }).code).toBe('invalid_amount');
        expect(V.validateGenerateRequest({ ...validBody(), amount: Infinity }).code).toBe('invalid_amount');
    });

    it('needs two languages only for Multi-Language', () => {
        expect(V.validateGenerateRequest({ ...validBody(), languages: ['German'], multiLang: 'Multi-Language' }).code)
            .toBe('invalid_languages');
        expect(V.validateGenerateRequest({ ...validBody(), languages: ['German'], multiLang: 'Single-Language' }).ok).toBe(true);
        expect(V.validateGenerateRequest({ ...validBody(), languages: ['German'], multiLang: 'Random' }).ok).toBe(true);
    });
});

describe('validateAnswerRequest / resultToRecord', () => {
    it('accepts the three results and maps partial to true (A.7)', () => {
        for (const result of ['correct', 'partial', 'wrong']) {
            expect(V.validateAnswerRequest({ translationId: UUID, caseName: 'singularEN', result }).ok).toBe(true);
        }
        expect(V.resultToRecord('correct')).toBe(true);
        expect(V.resultToRecord('partial')).toBe(true);
        expect(V.resultToRecord('wrong')).toBe(false);
    });

    it('drops unknown fields (a client-sent performanceId never reaches the service)', () => {
        const result = V.validateAnswerRequest({ translationId: UUID, caseName: 'x', result: 'correct', performanceId: UUID });
        expect(result.value).toEqual({ translationId: UUID, caseName: 'x', result: 'correct' });
    });
});

describe('validateModifierRequest', () => {
    it('accepts Mastered, Revise and null only', () => {
        expect(V.validateModifierRequest({ modifier: 'Mastered' }).ok).toBe(true);
        expect(V.validateModifierRequest({ modifier: 'Revise' }).ok).toBe(true);
        expect(V.validateModifierRequest({ modifier: null }).value).toEqual({ modifier: null });
        expect(V.validateModifierRequest({ modifier: 'master' }).ok).toBe(false);
        expect(V.validateModifierRequest({}).ok).toBe(false);
    });
});

describe('uniqueOptions / buildOptions', () => {
    const exercise = (multiLang, value, otherValues) => ({
        multiLang,
        matchingTranslations: {
            itemA: { language: 'English', case: 'a', value: 'x' },
            itemB: { language: 'Spanish', case: 'b', value, otherValues },
        },
    });

    it('removes duplicates without regard to case and keeps the answer', () => {
        expect(P.uniqueOptions('Casa', ['casa', 'perro', 'PERRO', 'gato'])).toEqual(['Casa', 'perro', 'gato']);
    });

    it('shuffles multi-language options but always contains the same set', () => {
        const options = P.buildOptions(exercise(true, 'casa', ['perro', 'gato']), seededRng(1));
        expect([...options].sort()).toEqual(['casa', 'gato', 'perro']);
    });

    it('keeps the catalogue order for single-language options', () => {
        expect(P.buildOptions(exercise(false, 'la', ['el', 'la', 'el/la']), seededRng(1))).toEqual(['el', 'la', 'el/la']);
        expect(P.buildOptions(exercise(false, 'die', ['der', 'die', 'das']), seededRng(9))).toEqual(['der', 'die', 'das']);
    });

    it('adds the answer when the fixed list does not contain it', () => {
        expect(P.buildOptions(exercise(false, 'neutral', ['el', 'la']), seededRng(1))).toEqual(['neutral', 'el', 'la']);
    });
});

describe('toPerformanceSummary', () => {
    it('serialises dates, drops cases without a date and never leaks internals', () => {
        const summary = P.toPerformanceSummary({
            translationId: 't1',
            translationLanguage: 'Spanish',
            performanceModifier: 'Revise',
            reviseCounter: null,
            averageTranslationKnowledge: 50,
            lastDateModifiedTranslation: NOW,
            statsByCase: [
                { caseName: 'a', record: [true], knowledge: 25, lastDate: NOW },
                { caseName: 'b', record: [], knowledge: null, lastDate: null },
            ],
        });
        expect(summary).toEqual({
            translationId: 't1',
            modifier: 'Revise',
            reviseCounter: 0,
            cases: [{ caseName: 'a', record: [true], knowledge: 25, lastDate: NOW.toISOString() }],
        });
    });
});
