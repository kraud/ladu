/**
 * Automatic, debounced dictionary lookup for the `(language, PoS)` pairs the
 * backend actually supports (`AUTOCOMPLETE_REGISTRY` in
 * `features/autocomplete/transforms.ts`) — renders `null` for every other
 * combination (e.g. English nouns, every adverb). Watches the registry's
 * query field, and — Estonian verbs only — the `searchInEnglish` checkbox
 * next to it, fires the lookup once the debounced value settles. Writing the
 * result's case values into the form is a separate, manual click on the
 * "Use autocomplete values" button: never automatic, and — deliberately —
 * it overwrites every field the lookup has an answer for, including one that
 * already holds something else. The button only ever appears when at least
 * one such field disagrees with the lookup in the first place (`valuesMatch`
 * below), so by the time it's visible there's always a real, potentially
 * wrong, value it's offering to replace.
 *
 * Lives in `TranslationCard`'s footer, left of Clear/Remove. Before the query
 * field has a value, or once a lookup comes back with nothing usable to fill
 * (loading/not-found), it's just the magnifying-glass icon plus a one-line
 * status — no button, since there's nothing yet to act on
 * (`data-testid="autocomplete-status"` on that status text).
 *
 * Once a lookup finds something fillable (`found`/`partial`), `valuesMatch`
 * decides between two more states, both watching *every* field in `fields`
 * (not just the query field) so either one reacts to any edit, anywhere in
 * the card:
 *  - Some field the lookup has a value for currently holds something else
 *    (most commonly: it's still blank) -> the "Use autocomplete values"
 *    button (pencil icon).
 *  - Every field the lookup has a value for already holds exactly that value
 *    -> a plain "Autocomplete values applied" indicator (check icon, no
 *    button) — reached either by clicking the button above (which, in the
 *    common case, fills every blank the lookup can and so flips this true
 *    right after), or, with no click at all, by opening a translation that
 *    was originally saved from this same autocomplete suggestion (D#: the
 *    query field is already hydrated from `initialCases`, so the lookup
 *    fires on mount same as if it had just been typed).
 * Editing the query field itself re-fires the lookup (existing debounce);
 * editing any other field just re-runs this comparison against the lookup
 * result already in hand — no new request.
 */
import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { CheckIcon, MagnifyingGlassIcon, PencilSimpleLineIcon } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useAutocompleteTranslation } from '@/features/autocomplete/hooks';
import { getAutocompleteEndpoint } from '@/features/autocomplete/transforms';
import { useDebouncedCallback } from '@/lib/useDebouncedCallback';
import type { Lang, PartOfSpeech } from '@/ts/enums';
import { matchesVisibility, type FieldConfig } from './configs/types';
import type { AutocompleteResult } from '@/features/autocomplete/types';

export interface AutocompleteRowProps {
    lang: Lang;
    pos: PartOfSpeech;
    fields: FieldConfig[];
}

const DEBOUNCE_MS = 500;
/** Neither field name is ever a real RHF field; `useWatch` on an unregistered name is a harmless no-op (same precedent as `FieldRenderer`'s own dummy-watch fallback). */
const NO_FIELD = '__autocomplete_none__';

/**
 * A looked-up case word -> the RHF value to write for `field`. Only
 * `multi-select` needs a real conversion: the lookup's value is the encoded
 * acronym (e.g. German verb cases' `"AG"`), never the selected-options array
 * the field itself stores, so it has to go through `field.decode` first —
 * setting the raw string directly would silently clear the checkboxes
 * instead of checking them.
 */
function valueToApply(field: FieldConfig, looked: string): unknown {
    return field.kind === 'multi-select' ? field.decode(looked) : looked;
}

/**
 * Whether `field`'s current (raw RHF) value already equals what the lookup
 * would write there — the same comparison `valuesMatch` runs per field.
 * Multi-select re-encodes the current selection first (the lookup's value is
 * the encoded acronym, e.g. German verb cases' `"AG"`, never the selected-
 * options array); a `lowercase` text field compares case-insensitively,
 * since that's exactly the normalisation `fieldsToCases` applies before
 * anything is persisted — without it, a field hydrated from a previously
 * *saved* (already-lowercased) translation would never register as matching
 * a freshly-fetched (properly-cased) dictionary word.
 */
function caseWordMatches(field: FieldConfig, currentRaw: unknown, available: string): boolean {
    if (field.kind === 'multi-select') {
        const current = Array.isArray(currentRaw) ? (currentRaw as string[]) : [];
        return field.encode(current) === available;
    }
    const current = typeof currentRaw === 'string' ? currentRaw : '';
    if (field.kind === 'text' && field.lowercase) {
        return current.toLowerCase() === available.toLowerCase();
    }
    return current === available;
}

/**
 * True once every case the lookup found is already sitting in the form —
 * i.e. clicking the fill button would change nothing. A field the lookup has
 * no opinion on, or one currently hidden by its own `visibleWhen` (the other
 * branch of a Spanish adjective/German adverb split), never counts against
 * the match — there's nothing to compare it to either way.
 */
function valuesMatchLookup(
    fields: FieldConfig[],
    data: AutocompleteResult | undefined,
    values: Record<string, unknown>
): boolean {
    if (!data) return false;
    return fields.every((field) => {
        if (!field.caseName) return true;
        const available = data.cases.get(field.caseName);
        if (available === undefined) return true;
        if (field.visibleWhen && !matchesVisibility(field.visibleWhen, values[field.visibleWhen.field])) return true;
        return caseWordMatches(field, values[field.name], available);
    });
}

export function AutocompleteRow({ lang, pos, fields }: AutocompleteRowProps) {
    const { t } = useTranslation();
    const { control, setValue } = useFormContext();
    const endpoint = getAutocompleteEndpoint(lang, pos);

    const queryValue = useWatch({ control, name: endpoint?.queryFieldName ?? NO_FIELD }) as string | undefined;
    const extraValue = useWatch({ control, name: endpoint?.extraFieldName ?? NO_FIELD }) as boolean | undefined;
    // Every other field, so `valuesMatchLookup` reruns on any edit in the
    // card — cheap: `TranslationCard` already re-renders on every keystroke
    // via this exact same unfiltered `useWatch`, so this adds no new render.
    const allValues = useWatch({ control }) as Record<string, unknown>;
    const debouncedQuery = useDebouncedCallback(queryValue ?? '', DEBOUNCE_MS);

    const hasQuery = endpoint !== undefined && debouncedQuery.trim() !== '';
    const { data, isFetching } = useAutocompleteTranslation({
        language: lang,
        pos,
        query: hasQuery ? debouncedQuery : '',
        extra: endpoint?.extraFieldName ? Boolean(extraValue) : undefined,
    });

    if (!endpoint) return null;

    const statusKey = !hasQuery
        ? undefined
        : isFetching
          ? 'loading'
          : data?.status === 'found'
            ? 'foundMatch'
            : data?.status === 'partial'
              ? 'partialMatch'
              : data?.status === 'not-found'
                ? 'noMatch'
                : undefined;

    const canFill = hasQuery && !isFetching && (data?.status === 'found' || data?.status === 'partial');

    // Overwrites unconditionally — see the file header on why that's the
    // right call once the button (`valuesMatch` below) has already decided
    // there's a real disagreement to resolve.
    const handleApply = () => {
        if (!data) return;
        for (const field of fields) {
            if (!field.caseName) continue;
            const looked = data.cases.get(field.caseName);
            if (looked === undefined) continue;
            if (field.visibleWhen && !matchesVisibility(field.visibleWhen, allValues[field.visibleWhen.field])) continue;
            setValue(field.name, valueToApply(field, looked), { shouldDirty: true, shouldValidate: true });
        }
    };

    if (canFill) {
        if (valuesMatchLookup(fields, data, allValues)) {
            return (
                <span className="flex items-center gap-1.5 text-xs text-(--success)">
                    <CheckIcon size={14} weight="bold" />
                    {t('wordRelated:wordForm.autocompleteTranslationButton.valuesApplied')}
                </span>
            );
        }
        return (
            <Button type="button" variant="outline" size="sm" onClick={handleApply} className="gap-1.5">
                <PencilSimpleLineIcon size={14} />
                {t('wordRelated:wordForm.autocompleteTranslationButton.autocompleteButton')}
            </Button>
        );
    }

    return (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="autocomplete-status">
            <MagnifyingGlassIcon size={14} />
            {statusKey
                ? t(`wordRelated:wordForm.autocompleteTranslationButton.${statusKey}`)
                : t('wordRelated:wordForm.autocompleteTranslationButton.supportLabel')}
        </span>
    );
}
