/**
 * Saved configurations, pure side (Phase 5.5): turning a stored configuration
 * back into settings for the form. No React, no storage, no network.
 * Spec: phase-5-5-saved-practice.md §6–§7.
 */
import { availablePartsOfSpeech, type PreselectedWord } from './preselection';
import { defaultParams, narrowPartsOfSpeech, PARTS_OF_SPEECH_WITH_EXERCISES, SELECTABLE_PARTS_OF_SPEECH } from './params';
import { paramsToSearch, searchToParams, validatePracticeSearch } from './search';
import type { PracticeParams } from './types';

/**
 * Only word types with exercises can be picked, and with a pre-selection only
 * the types its words have. A URL, a remembered setting or a saved configuration
 * cannot bring in the others.
 */
export function narrowToPickable(params: PracticeParams, preselected: readonly PreselectedWord[] | null): PracticeParams {
    const pickable = (availablePartsOfSpeech(preselected) ?? SELECTABLE_PARTS_OF_SPEECH).filter((pos) =>
        PARTS_OF_SPEECH_WITH_EXERCISES.includes(pos),
    );
    return { ...params, partsOfSpeech: narrowPartsOfSpeech(params.partsOfSpeech, pickable) };
}

/**
 * The settings of a stored configuration, made safe for the form. The stored blob
 * goes through the same `search` round-trip as the URL, so an old or hand-edited
 * value falls back to the default for that field, and a language the account no
 * longer has is dropped.
 */
export function configToParams(
    stored: PracticeParams,
    userLanguages: readonly string[],
    preselected: readonly PreselectedWord[] | null,
): PracticeParams {
    const search = validatePracticeSearch({ ...paramsToSearch(stored) });
    const safe = searchToParams(search, defaultParams(userLanguages), userLanguages);
    return narrowToPickable(safe, preselected);
}
