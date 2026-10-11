/**
 * Saved configurations, pure side (Phase 5.5): turning a stored configuration
 * back into settings for the form. No React, no storage, no network.
 * Spec: phase-5-5-saved-practice.md §6–§7.
 */
import { availablePartsOfSpeech, type PreselectedWord } from './preselection';
import { defaultParams, narrowPartsOfSpeech, PARTS_OF_SPEECH_WITH_EXERCISES, SELECTABLE_PARTS_OF_SPEECH } from './params';
import { paramsToSearch, searchToParams, validatePracticeSearch } from './search';
import type { ConfigDraft } from './components/SaveConfigDialog';
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

/** The settings as a comparable string: keys in a fixed order, lists sorted. */
function settingsKey(params: PracticeParams): string {
    const entries = Object.entries(params)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => [key, Array.isArray(value) ? [...value].sort() : value]);
    return JSON.stringify(entries);
}

/** The ids as a comparable string: sorted, and `null` the same as none. */
const idsKey = (ids: readonly string[] | null | undefined) => JSON.stringify([...(ids ?? [])].sort());

/**
 * Whether what is on screen differs from a saved configuration's loaded state (`baseline`): any setting, or
 * the words. Words chosen by tag are compared by their tags, not by the words they give (those load later
 * and change by themselves).
 */
export function configChanged(current: ConfigDraft, baseline: ConfigDraft): boolean {
    if (settingsKey(current.params) !== settingsKey(baseline.params)) return true;
    const byTags = (current.tagIds?.length ?? 0) > 0 || (baseline.tagIds?.length ?? 0) > 0;
    return byTags ? idsKey(current.tagIds) !== idsKey(baseline.tagIds) : idsKey(current.wordIds) !== idsKey(baseline.wordIds);
}
