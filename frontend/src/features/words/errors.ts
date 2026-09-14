/**
 * Backend error -> i18n key, mirroring `features/auth/errors.ts`. Every
 * message below is a verbatim `throw new Error(...)` from
 * `wordController.ts` (`getWordById` / `createWord` / `updateWord` /
 * `getWordsSimplified` / `deleteManyWords`). The client already gates PoS +
 * >= 2 translations before submit, and Slice 6's `enableRowSelection` keeps
 * a non-owned row out of the bulk-delete selection, so most of these are
 * defence-in-depth, not the expected path.
 */
import { getApiErrorMessage } from '@/api/types';

export const GENERIC_ERROR_KEY = 'common:errors.somethingWrong';

const MESSAGE_TO_KEY: Record<string, string> = {
    'Word not found': 'wordRelated:apiErrors.wordNotFound',
    'User not authorized': 'wordRelated:apiErrors.notAuthorized',
    'Please add part of speech': 'wordRelated:apiErrors.missingPartOfSpeech',
    'Please add 2 or more translations': 'wordRelated:apiErrors.notEnoughTranslations',
    'Invalid cursor': 'wordRelated:apiErrors.invalidCursor',
    'No word IDs provided': 'wordRelated:apiErrors.noWordIdsProvided',
    'Some words are missing': 'wordRelated:apiErrors.someWordsMissing',
    'User not authorized to delete at least one of the words':
        'wordRelated:apiErrors.notAuthorizedToDeleteSome',
};

/** The i18n key for whatever the backend threw. Never throws; always returns a key. */
export function wordErrorKey(error: unknown): string {
    const message = getApiErrorMessage(error);
    if (message && message in MESSAGE_TO_KEY) return MESSAGE_TO_KEY[message];
    return GENERIC_ERROR_KEY;
}
