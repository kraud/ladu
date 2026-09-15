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
        ['Invalid cursor', 'wordRelated:apiErrors.invalidCursor'],
        ['No word IDs provided', 'wordRelated:apiErrors.noWordIdsProvided'],
        ['Some words are missing', 'wordRelated:apiErrors.someWordsMissing'],
        [
            'User not authorized to delete at least one of the words',
            'wordRelated:apiErrors.notAuthorizedToDeleteSome',
        ],
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
