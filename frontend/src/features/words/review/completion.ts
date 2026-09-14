/**
 * The completion ring's denominator: how many persisted cases a COMPLETE
 * translation would have for a given (part of speech, language) — mirrored
 * against `TranslationCard.tsx`'s `fieldsToCases` drop rules, since
 * `WordSimpleBE.registeredCasesXX` is exactly `translation.cases.length`,
 * i.e. how `fieldsToCases` counts once a form is saved.
 *
 * NOT exact for two configs (Spanish adjective, German adverb) that branch
 * their whole field set on a `visibleWhen`-controlled sibling — a Neutral
 * Spanish adjective and an M/F one are indistinguishable from
 * `registeredCasesES` alone, since the row carries a bare count, not which
 * cases. See `expectedCaseCount`'s doc comment for how the branch is
 * resolved, and D12 for why the UI reads this as "N of M cases" rather than
 * a percentage claim.
 */
import { Lang, type PartOfSpeech } from '@/ts/enums';
import {
    getFormConfig,
    matchesVisibility,
    type FieldConfig,
    type FieldVisibility,
} from '@/features/words/form-engine/configs';
import type { LangKey } from '@/features/words/types';

const LANG_BY_KEY: Record<LangKey, Lang> = {
    EN: Lang.EN,
    ES: Lang.ES,
    DE: Lang.DE,
    EE: Lang.EE,
};

/** `fieldsToCases`' own drop rules, minus the "resulting word is blank" one (there's no value to read here). */
function isPersistedCaseField(field: FieldConfig): boolean {
    return field.persisted !== false && field.kind !== 'checkbox' && Boolean(field.caseName);
}

function hasVisibility(field: FieldConfig): field is FieldConfig & { visibleWhen: FieldVisibility } {
    return field.visibleWhen !== undefined;
}

/** A radio/select/multi-select field's own declared values — the domain `visibleWhen` branches over. */
function optionValues(field: FieldConfig | undefined): string[] {
    if (!field) return [];
    if (field.kind === 'radio' || field.kind === 'select' || field.kind === 'multi-select') {
        return field.options.map((option) => option.value);
    }
    return [];
}

/**
 * Sums unconditioned persisted fields, then for each sibling a `visibleWhen`
 * points at, evaluates every one of THAT sibling's own option values and
 * adds only the largest resulting count — a config can only ever be on one
 * branch at a time, so the branches must not simply be summed. Using the
 * controlling field's real options (rather than a fixed "true/false" guess)
 * is what makes this handle `invert` (German adverb's `gradable`) the same
 * way it handles a positive match (Spanish adjective's `gender`).
 */
function expectedCaseCountForConfig(fields: FieldConfig[]): number {
    const persisted = fields.filter(isPersistedCaseField);
    const unconditioned = persisted.filter((field) => !hasVisibility(field));
    const conditioned = persisted.filter(hasVisibility);

    const controllingFieldNames = new Set(conditioned.map((field) => field.visibleWhen.field));
    let total = unconditioned.length;

    for (const controllingName of controllingFieldNames) {
        const controllingField = fields.find((field) => field.name === controllingName);
        const domain = optionValues(controllingField);
        const branchFields = conditioned.filter((field) => field.visibleWhen.field === controllingName);

        if (domain.length === 0) {
            // No enumerable domain to branch over (shouldn't happen for any
            // current config) — best effort, count every branch field once.
            total += branchFields.length;
            continue;
        }

        let maxVisible = 0;
        for (const value of domain) {
            const visible = branchFields.filter((field) => matchesVisibility(field.visibleWhen, value)).length;
            maxVisible = Math.max(maxVisible, visible);
        }
        total += maxVisible;
    }

    return total;
}

const cache = new Map<string, number>();

/**
 * Memoised — a 50-row x 4-language table calls this up to 200 times per
 * render, over only 40 distinct (pos, language) pairs. Returns 0 when there
 * is no config at all (six unshipped parts of speech, plus Estonian adverb,
 * which has no config by design) — the caller renders no ring rather than a
 * misleading 0%.
 */
export function expectedCaseCount(pos: PartOfSpeech, key: LangKey): number {
    const cacheKey = `${pos}:${key}`;
    const cached = cache.get(cacheKey);
    if (cached !== undefined) return cached;

    const config = getFormConfig(pos, LANG_BY_KEY[key]);
    const value = config ? expectedCaseCountForConfig(config.fields) : 0;
    cache.set(cacheKey, value);
    return value;
}
