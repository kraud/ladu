/**
 * Backend error -> i18n key for the practice endpoints. The exercise API
 * answers `{ message, code }` (other controllers only send `message`), so this
 * feature maps on the stable `code` instead of the English text.
 */
export const GENERIC_ERROR_KEY = 'common:errors.somethingWrong';

const CODE_TO_KEY: Record<string, string> = {
    invalid_languages: 'practice:apiErrors.invalidLanguages',
    invalid_parts_of_speech: 'practice:apiErrors.invalidPartsOfSpeech',
    invalid_amount: 'practice:apiErrors.invalidAmount',
    invalid_type: 'practice:apiErrors.invalidSettings',
    invalid_language_mode: 'practice:apiErrors.invalidSettings',
    invalid_difficulty: 'practice:apiErrors.invalidSettings',
    invalid_word_selection: 'practice:apiErrors.invalidSettings',
    invalid_exclude_native: 'practice:apiErrors.invalidSettings',
    invalid_word_ids: 'practice:apiErrors.invalidWordIds',
    not_found: 'practice:apiErrors.notFound',
};

/** The `code` the exercise API sent, or `null`. */
export function getApiErrorCode(error: unknown): string | null {
    if (typeof error === 'object' && error !== null && 'response' in error) {
        const data = (error as { response?: { data?: unknown } }).response?.data;
        if (typeof data === 'object' && data !== null && 'code' in data) {
            const code = (data as { code?: unknown }).code;
            if (typeof code === 'string') return code;
        }
    }
    return null;
}

/** The i18n key for whatever the backend threw. Never throws; always returns a key. */
export function practiceErrorKey(error: unknown): string {
    const code = getApiErrorCode(error);
    return code && code in CODE_TO_KEY ? CODE_TO_KEY[code] : GENERIC_ERROR_KEY;
}
