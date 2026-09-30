/**
 * Request validation for saved practice configurations (pure, no Express, no DB).
 * Spec: .context/plans/phase-5-5-saved-practice.md §4–§5.
 *
 * The settings go through `validateGenerateRequest`, so a saved configuration can
 * always start a session. `strictnessTI` is client-only but is stored with them.
 */

import { validateGenerateRequest, type GenerateRequest, type Validation } from './validate';

export const MAX_CONFIG_NAME = 60;
export const MAX_CONFIG_DESCRIPTION = 200;
export const DEFAULT_STRICTNESS_TI = 2;

/** The settings as stored: the generate settings without words, plus the typed-answer strictness. */
export type ConfigParams = Omit<GenerateRequest, 'wordIds'> & { strictnessTI: number };

export interface ConfigRequest {
    name: string;
    description: string | null;
    params: ConfigParams;
    /** `null` = no pre-selected words. */
    wordIds: string[] | null;
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

    const settings = validateGenerateRequest({ ...generateParams, wordIds: body.wordIds });
    if (!settings.ok) return settings;
    const { wordIds, ...params } = settings.value;

    return {
        ok: true,
        value: { name, description, params: { ...params, strictnessTI }, wordIds: wordIds ?? null },
    };
}
