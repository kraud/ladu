import { describe, expect, it } from 'vitest';
import { GENERIC_ERROR_KEY, getApiErrorCode, practiceErrorKey } from './errors';

const httpError = (data: unknown) => ({ response: { data } });

describe('getApiErrorCode', () => {
    it('reads the code from the response body', () => {
        expect(getApiErrorCode(httpError({ message: 'x', code: 'invalid_amount' }))).toBe('invalid_amount');
    });

    it.each([null, undefined, 'text', {}, { response: {} }, httpError('plain'), httpError({ code: 5 }), httpError(null)])(
        'is null for %p',
        (value) => {
            expect(getApiErrorCode(value)).toBeNull();
        },
    );
});

describe('practiceErrorKey', () => {
    it.each([
        ['invalid_languages', 'practice:apiErrors.invalidLanguages'],
        ['invalid_parts_of_speech', 'practice:apiErrors.invalidPartsOfSpeech'],
        ['invalid_amount', 'practice:apiErrors.invalidAmount'],
        ['invalid_type', 'practice:apiErrors.invalidSettings'],
        ['invalid_word_ids', 'practice:apiErrors.invalidWordIds'],
        ['not_found', 'practice:apiErrors.notFound'],
    ])('%s -> %s', (code, key) => {
        expect(practiceErrorKey(httpError({ message: 'x', code }))).toBe(key);
    });

    it('falls back to the generic key for unknown codes and non-API errors', () => {
        expect(practiceErrorKey(httpError({ message: 'x', code: 'brand_new' }))).toBe(GENERIC_ERROR_KEY);
        expect(practiceErrorKey(new Error('network'))).toBe(GENERIC_ERROR_KEY);
        expect(practiceErrorKey(undefined)).toBe(GENERIC_ERROR_KEY);
    });
});
