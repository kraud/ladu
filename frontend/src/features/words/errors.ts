/**
 * Backend error -> i18n key, mirroring `features/auth/errors.ts`. Every
 * message below is a verbatim `throw new Error(...)` from
 * `wordController.ts` (`getWordById` / `createWord` / `updateWord`). The
 * client already gates PoS + >= 2 translations before submit, so the last two
 * are defence-in-depth, not the expected path.
 */
import { getApiErrorMessage } from '@/api/types';

export const GENERIC_ERROR_KEY = 'common:errors.somethingWrong';

const MESSAGE_TO_KEY: Record<string, string> = {
    'Word not found': 'wordRelated:apiErrors.wordNotFound',
    'User not authorized': 'wordRelated:apiErrors.notAuthorized',
    'Please add part of speech': 'wordRelated:apiErrors.missingPartOfSpeech',
    'Please add 2 or more translations': 'wordRelated:apiErrors.notEnoughTranslations',
};

/** The i18n key for whatever the backend threw. Never throws; always returns a key. */
export function wordErrorKey(error: unknown): string {
    const message = getApiErrorMessage(error);
    if (message && message in MESSAGE_TO_KEY) return MESSAGE_TO_KEY[message];
    return GENERIC_ERROR_KEY;
}
