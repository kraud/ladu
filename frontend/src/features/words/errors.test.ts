import { describe, expect, it } from 'vitest';
import { GENERIC_ERROR_KEY, wordErrorKey } from './errors';

/** Shape an axios-style error carrying the backend's `{ message }` body. */
const apiError = (message: string) => ({ response: { status: 400, data: { message } } });

describe('wordErrorKey', () => {
    it.each([
        ['Word not found', 'wordRelated:apiErrors.wordNotFound'],
        ['User not authorized', 'wordRelated:apiErrors.notAuthorized'],
        ['Please add part of speech', 'wordRelated:apiErrors.missingPartOfSpeech'],
        ['Please add 2 or more translations', 'wordRelated:apiErrors.notEnoughTranslations'],
    ])('maps %j → %j', (message, key) => {
        expect(wordErrorKey(apiError(message))).toBe(key);
    });

    it('falls back to the generic key for an unrecognised message', () => {
        expect(wordErrorKey(apiError('some brand new backend message'))).toBe(GENERIC_ERROR_KEY);
    });

    it('falls back to the generic key when there is no api error body', () => {
        expect(wordErrorKey(new Error('network down'))).toBe(GENERIC_ERROR_KEY);
        expect(wordErrorKey(undefined)).toBe(GENERIC_ERROR_KEY);
    });
});
