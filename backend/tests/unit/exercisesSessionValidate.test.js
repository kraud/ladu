// Pure request validation and summary for saved practice sessions (no database).
const { validateSessionRequest, summarizeSnapshot, MAX_SNAPSHOT_BYTES } = require('../../services/exercises/validateSession');

const exercise = (over = {}) => ({
    key: 'k',
    type: 'Text-Input',
    multiLang: true,
    partOfSpeech: 'Noun',
    wordId: 'w',
    translationId: 't',
    prompt: { language: 'English', caseName: 'singularEN', value: 'house' },
    answer: { language: 'Spanish', caseName: 'singularES', value: 'casa' },
    performance: null,
    ...over,
});

const snapshot = (over = {}) => ({
    userId: 'u1',
    params: { languages: ['Spanish', 'English', 'German'], amount: 3 },
    wordIds: null,
    preselected: null,
    requested: 3,
    exercises: [exercise(), exercise({ type: 'Multiple-Choice', partOfSpeech: 'Verb' }), exercise()],
    answers: [{ result: 'correct', given: 'casa', saveStatus: 'saved' }, { result: 'wrong', given: 'x', saveStatus: 'saved' }, null],
    current: 2,
    view: 'exercises',
    returnToResults: false,
    ...over,
});

describe('validateSessionRequest', () => {
    it('accepts a valid snapshot and keeps it as sent', () => {
        const s = snapshot();
        const result = validateSessionRequest({ snapshot: s });
        expect(result.ok).toBe(true);
        expect(result.value.snapshot).toEqual(s);
    });

    it('builds the summary itself and ignores one sent by the client', () => {
        const result = validateSessionRequest({ snapshot: snapshot(), summary: { answered: 99 } });
        expect(result.value.summary).toEqual({
            answered: 2,
            correct: 1,
            total: 3,
            languages: ['Spanish', 'English'],
            partsOfSpeech: ['Noun', 'Verb'],
            cardTypes: ['Text-Input', 'Multiple-Choice'],
        });
    });

    it.each([
        ['a body that is not an object', null, 'invalid_body'],
        ['a missing snapshot', {}, 'invalid_snapshot'],
        ['a snapshot that is an array', { snapshot: [] }, 'invalid_snapshot'],
        ['no exercises', { snapshot: snapshot({ exercises: [], answers: [] }) }, 'invalid_snapshot'],
        [
            'more than 100 exercises',
            { snapshot: snapshot({ exercises: Array(101).fill(exercise()), answers: Array(101).fill(null) }) },
            'invalid_snapshot',
        ],
        ['an exercise with an unknown card type', { snapshot: snapshot({ exercises: [exercise({ type: 'X' })], answers: [null], current: 0 }) }, 'invalid_snapshot'],
        ['an exercise with an unknown language', { snapshot: snapshot({ exercises: [exercise({ prompt: { language: 'French' } })], answers: [null], current: 0 }) }, 'invalid_snapshot'],
        ['an exercise that is not an object', { snapshot: snapshot({ exercises: ['x'], answers: [null], current: 0 }) }, 'invalid_snapshot'],
        ['answers of another length', { snapshot: snapshot({ answers: [null] }) }, 'invalid_snapshot'],
        ['an answer with an unknown result', { snapshot: snapshot({ answers: [{ result: 'maybe' }, null, null] }) }, 'invalid_snapshot'],
        ['a current index out of range', { snapshot: snapshot({ current: 3 }) }, 'invalid_snapshot'],
        ['a fractional current index', { snapshot: snapshot({ current: 1.5 }) }, 'invalid_snapshot'],
        ['an unknown view', { snapshot: snapshot({ view: 'other' }) }, 'invalid_snapshot'],
        ['params that are not an object', { snapshot: snapshot({ params: 'x' }) }, 'invalid_snapshot'],
    ])('rejects %s', (_label, body, code) => {
        expect(validateSessionRequest(body)).toMatchObject({ ok: false, code });
    });

    it('rejects a snapshot over the size limit', () => {
        const big = snapshot({ preselected: [{ label: 'x'.repeat(MAX_SNAPSHOT_BYTES) }] });
        expect(validateSessionRequest({ snapshot: big })).toMatchObject({ ok: false, code: 'snapshot_too_large' });
    });
});

describe('summarizeSnapshot', () => {
    it('lists languages that appear in the exercises: settings order first, then the others', () => {
        const s = snapshot({
            params: { languages: ['German', 'English'] },
            exercises: [exercise({ answer: { language: 'Estonian' } })],
            answers: [null],
            current: 0,
        });
        expect(summarizeSnapshot(s).languages).toEqual(['English', 'Estonian']);
    });

    it('counts partial as correct', () => {
        const s = snapshot({ answers: [{ result: 'partial' }, { result: 'wrong' }, { result: 'correct' }] });
        expect(summarizeSnapshot(s)).toMatchObject({ answered: 3, correct: 2 });
    });
});
