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
 *
 * A `partial` result is a guess, not a dictionary entry (decision D2 in
 * autocomplete-data-source-strategy.md). It fills like `found`, but both states
 * above carry the "not fully sure" notice next to them, before and after applying
 * (`data-testid="autocomplete-partial"`), so a guess never looks like a fact.
 *
 * Type-ahead (Slice E, decision D21): a pick from the query field's suggestion list fills the
 * card at once (`TypeAheadInput` → `TranslationCard`'s `pickSuggestion`, which runs the same
 * `applyLookup` as the button). The pick arrives here as `pickedEntry`: while the query field
 * still holds the picked lemma, the lookup asks for that exact entry (der See, not the main
 * sense der See/die See), without the debounce — the pick already fetched it, so this reads the
 * cache. Otherwise the button would offer to overwrite the pick with the main sense.
 */
import { useFormContext, useWatch, type FieldValues, type UseFormSetValue } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { CheckIcon, MagnifyingGlassIcon, PencilSimpleLineIcon, WarningIcon } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useAutocompleteTranslation } from '@/features/autocomplete/hooks';
import { activeQueryField, getAutocompleteEndpoint } from '@/features/autocomplete/transforms';
import { useDebouncedCallback } from '@/lib/useDebouncedCallback';
import type { Lang, PartOfSpeech } from '@/ts/enums';
import { matchesVisibility, type FieldConfig } from './configs/types';
import type { AutocompleteResult } from '@/features/autocomplete/types';

/** A type-ahead pick (see the file header). */
export interface PickedEntry {
    lemma: string;
    entryId: string;
}

export interface AutocompleteRowProps {
    lang: Lang;
    pos: PartOfSpeech;
    fields: FieldConfig[];
    pickedEntry?: PickedEntry | null;
}

/** The pause after typing before the lookup runs. `TypeAheadInput` closes an exactly matching list after the same pause. */
export const LOOKUP_DEBOUNCE_MS = 500;
/**
 * The ready-to-click "Use autocomplete values" button, in the brand colour so
 * it stands out from the neutral Clear/Remove beside it: a soft accent fill,
 * accent border and strong-accent text (the small-text tone, AA on both
 * themes). The `dark:` twins are needed because the outline variant sets its
 * own `dark:` fill and border, which would otherwise win in the dark theme.
 * Deliberately not the solid `default` variant — that stays the page's
 * one primary action (Save word).
 */
const APPLY_BUTTON_CLASS =
    'gap-1.5 border-(--accent) bg-(--accent-soft) font-semibold text-(--accent-strong) hover:bg-(--accent-soft2) hover:text-(--accent-strong) dark:border-(--accent) dark:bg-(--accent-soft) dark:hover:bg-(--accent-soft2)';
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
    // A stored checkbox (Estonian "kõige …" superlative, D20) arrives as "true" / "false".
    if (field.kind === 'checkbox') return looked === 'true';
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
    if (field.kind === 'checkbox') return (currentRaw === true) === (available === 'true');
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
 * The radios the lookup decides: one with its own `caseName` takes that case's word (German adverb
 * "Gradable"), one with `fromLookup` takes the option the result stands for (Spanish adjective
 * "Neutral" / "M/F"). Other fields' visibility depends on them, so they are read first: a field
 * that the lookup's own answer shows must be filled, one that it hides must not be.
 */
function lookedUpRadios(fields: FieldConfig[], data: AutocompleteResult): Record<string, string> {
    const radios: Record<string, string> = {};
    for (const field of fields) {
        if (field.kind !== 'radio') continue;
        const value = field.fromLookup?.(data.cases) ?? (field.caseName ? data.cases.get(field.caseName) : undefined);
        if (value !== undefined) radios[field.name] = value;
    }
    return radios;
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
    const radios = lookedUpRadios(fields, data);
    const afterFill = { ...values, ...radios };
    return fields.every((field) => {
        // A radio without a case (Spanish adjective gender) still has to show the branch the lookup stands for.
        if (!field.caseName) return field.kind !== 'radio' || radios[field.name] === undefined || values[field.name] === radios[field.name];
        const available = data.cases.get(field.caseName);
        if (available === undefined) return true;
        if (field.visibleWhen && !matchesVisibility(field.visibleWhen, afterFill[field.visibleWhen.field])) return true;
        return caseWordMatches(field, values[field.name], available);
    });
}

/**
 * Writes every case the lookup has a word for into its field — overwriting unconditionally (see the
 * file header on why). Skips a field hidden by its own `visibleWhen`. Shared by the "Use
 * autocomplete values" button and a type-ahead pick (D21: the same fill).
 */
export function applyLookup(
    fields: FieldConfig[],
    data: AutocompleteResult,
    values: Record<string, unknown>,
    setValue: UseFormSetValue<FieldValues>
): void {
    // The branch radios first, so the fields they show are filled in this same pass.
    const radios = lookedUpRadios(fields, data);
    for (const [name, value] of Object.entries(radios)) setValue(name, value, { shouldDirty: true, shouldValidate: true });
    const afterRadios = { ...values, ...radios };
    for (const field of fields) {
        if (!field.caseName || field.name in radios) continue;
        const looked = data.cases.get(field.caseName);
        if (looked === undefined) continue;
        if (field.visibleWhen && !matchesVisibility(field.visibleWhen, afterRadios[field.visibleWhen.field])) continue;
        setValue(field.name, valueToApply(field, looked), { shouldDirty: true, shouldValidate: true });
    }
}

export function AutocompleteRow({ lang, pos, fields, pickedEntry }: AutocompleteRowProps) {
    const { t } = useTranslation();
    const { control, setValue } = useFormContext();
    const endpoint = getAutocompleteEndpoint(lang, pos);

    const extraValue = useWatch({ control, name: endpoint?.extraFieldName ?? NO_FIELD }) as boolean | undefined;
    // Every field, so `valuesMatchLookup` reruns on any edit in the
    // card — cheap: `TranslationCard` already re-renders on every keystroke
    // via this exact same unfiltered `useWatch`, so this adds no new render.
    // The query comes from here too: which field holds it can change with the card's branch
    // (`activeQueryField`, Spanish adjective).
    const allValues = useWatch({ control }) as Record<string, unknown>;
    const queryValue = (endpoint ? allValues[activeQueryField(endpoint, fields, allValues)] : undefined) as string | undefined;
    const debouncedQuery = useDebouncedCallback(queryValue ?? '', LOOKUP_DEBOUNCE_MS);
    const entryId = pickedEntry && queryValue === pickedEntry.lemma ? pickedEntry.entryId : undefined;
    const query = entryId ? (queryValue ?? '') : debouncedQuery;

    const hasQuery = endpoint !== undefined && query.trim() !== '';
    const { data, isFetching } = useAutocompleteTranslation({
        language: lang,
        pos,
        query: hasQuery ? query : '',
        extra: endpoint?.extraFieldName ? Boolean(extraValue) : undefined,
        entryId,
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
        if (data) applyLookup(fields, data, allValues, setValue);
    };

    if (canFill) {
        const action = valuesMatchLookup(fields, data, allValues) ? (
            <span className="flex items-center gap-1.5 text-xs text-(--success)">
                <CheckIcon size={14} weight="bold" />
                {t('wordRelated:wordForm.autocompleteTranslationButton.valuesApplied')}
            </span>
        ) : (
            <Button type="button" variant="outline" size="sm" onClick={handleApply} className={APPLY_BUTTON_CLASS}>
                <PencilSimpleLineIcon size={14} />
                {t('wordRelated:wordForm.autocompleteTranslationButton.autocompleteButton')}
            </Button>
        );
        if (data?.status !== 'partial') return action;
        return (
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {action}
                <span className="flex items-center gap-1.5 text-xs text-(--warning)" data-testid="autocomplete-partial">
                    <WarningIcon aria-hidden size={14} className="shrink-0" />
                    {t('wordRelated:wordForm.autocompleteTranslationButton.partialMatch')}
                </span>
            </span>
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
