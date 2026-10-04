/**
 * Request validation for saved practice configurations (pure, no Express, no DB).
 * Spec: .context/plans/phase-5-5-saved-practice.md §4–§5.
 *
 * The settings go through `validateGenerateRequest`, so a saved configuration can
 * always start a session. `strictnessTI` is client-only but is stored with them.
 */

import { isUuid, validateGenerateRequest, type GenerateRequest, type Validation } from './validate';

export const MAX_CONFIG_NAME = 60;
export const MAX_CONFIG_DESCRIPTION = 200;
export const MAX_CONFIG_TAGS = 20;
export const DEFAULT_STRICTNESS_TI = 2;

/** The settings as stored: the generate settings without words, plus the typed-answer strictness. */
export type ConfigParams = Omit<GenerateRequest, 'wordIds'> & { strictnessTI: number };

export interface ConfigRequest {
    name: string;
    description: string | null;
    params: ConfigParams;
    /** `null` = no pre-selected words. */
    wordIds: string[] | null;
    /**
     * The tags the words were chosen by (Practice's tag picker), or `null`. The words stay in
     * `wordIds` (the words at the time of saving); the tags let the client choose them again live.
     */
    tagIds: string[] | null;
}

const fail = (code: string, message: string): { ok: false; code: string; message: string } => ({
    ok: false,
    code,
    message,
});

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

export function validateConfigRequest(body: unknown): Validation<ConfigRequest> {
    if (!isPlainObject(body)) return fail('invalid_body', 'Request body must be an object.');

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name.length === 0 || name.length > MAX_CONFIG_NAME) {
        return fail('invalid_name', `Name is required and can have at most ${MAX_CONFIG_NAME} characters.`);
    }

    let description: string | null = null;
    if (body.description !== undefined && body.description !== null) {
        if (typeof body.description !== 'string' || body.description.trim().length > MAX_CONFIG_DESCRIPTION) {
            return fail('invalid_description', `Description can have at most ${MAX_CONFIG_DESCRIPTION} characters.`);
        }
        description = body.description.trim() || null;
    }

    if (!isPlainObject(body.params)) return fail('invalid_params', 'params must be an object.');
    const { strictnessTI = DEFAULT_STRICTNESS_TI, ...generateParams } = body.params;
    if (typeof strictnessTI !== 'number' || !Number.isInteger(strictnessTI) || strictnessTI < 1 || strictnessTI > 3) {
        return fail('invalid_strictness', 'strictnessTI must be 1, 2 or 3.');
    }
    // Word ids are a separate field, so a copy inside `params` is not accepted.
    if ('wordIds' in generateParams) return fail('invalid_params', 'params cannot contain wordIds.');

    // `null` (what the client sends for "no words") and a missing field both mean no pre-selection.
    const settings = validateGenerateRequest({ ...generateParams, wordIds: body.wordIds ?? undefined });
    if (!settings.ok) return settings;
    const { wordIds, ...params } = settings.value;

    // Same rule as `wordIds`: a missing field, `null` and `[]` all mean none.
    let tagIds: string[] | null = null;
    if (body.tagIds !== undefined && body.tagIds !== null) {
        const ids = body.tagIds;
        if (!Array.isArray(ids) || ids.length > MAX_CONFIG_TAGS || !ids.every(isUuid)) {
            return fail('invalid_tag_ids', `tagIds must be a list of at most ${MAX_CONFIG_TAGS} valid ids.`);
        }
        if (ids.length > 0) tagIds = [...new Set(ids as string[])];
    }

    return {
        ok: true,
        value: { name, description, params: { ...params, strictnessTI }, wordIds: wordIds ?? null, tagIds },
    };
}
