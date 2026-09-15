/**
 * Automatic, debounced dictionary lookup for the `(language, PoS)` pairs the
 * backend actually supports (`AUTOCOMPLETE_REGISTRY` in
 * `features/autocomplete/transforms.ts`) — renders `null` for every other
 * combination (e.g. English nouns, every adverb). Watches the registry's
 * query field, and — Estonian verbs only — the `searchInEnglish` checkbox
 * next to it, fires the lookup once the debounced value settles, and shows a
 * status line. Filling the empty case fields from a result is a separate,
 * manual "Fill in" click: never automatic, and it only ever writes into
 * fields that are currently empty, never overwriting a typed value.
 */
import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useAutocompleteTranslation } from '@/features/autocomplete/hooks';
import { getAutocompleteEndpoint } from '@/features/autocomplete/transforms';
import { useDebouncedCallback } from '@/lib/useDebouncedCallback';
import type { Lang, PartOfSpeech } from '@/ts/enums';
import type { FieldConfig } from './configs/types';

export interface AutocompleteRowProps {
    lang: Lang;
    pos: PartOfSpeech;
    fields: FieldConfig[];
}

const DEBOUNCE_MS = 500;
/** Neither field name is ever a real RHF field; `useWatch` on an unregistered name is a harmless no-op (same precedent as `FieldRenderer`'s own dummy-watch fallback). */
const NO_FIELD = '__autocomplete_none__';

function isEmpty(value: unknown): boolean {
    return value === undefined || value === null || value === '';
}

export function AutocompleteRow({ lang, pos, fields }: AutocompleteRowProps) {
    const { t } = useTranslation();
    const { control, getValues, setValue } = useFormContext();
    const endpoint = getAutocompleteEndpoint(lang, pos);

    const queryValue = useWatch({ control, name: endpoint?.queryFieldName ?? NO_FIELD }) as string | undefined;
    const extraValue = useWatch({ control, name: endpoint?.extraFieldName ?? NO_FIELD }) as boolean | undefined;
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

    const handleFill = () => {
        if (!data) return;
        for (const field of fields) {
            if (!field.caseName) continue;
            const looked = data.cases.get(field.caseName);
            if (looked === undefined) continue;
            if (!isEmpty(getValues(field.name))) continue;
            setValue(field.name, looked, { shouldDirty: true, shouldValidate: true });
        }
    };

    return (
        <div className="flex items-center gap-2 rounded-md border border-dashed p-2 text-sm">
            {statusKey && (
                <span className="text-muted-foreground" data-testid="autocomplete-status">
                    {t(`wordRelated:wordForm.autocompleteTranslationButton.${statusKey}`)}
                </span>
            )}
            <Button type="button" variant="outline" size="sm" disabled={!canFill} onClick={handleFill}>
                {t('wordRelated:wordForm.autocompleteTranslationButton.fillButton')}
            </Button>
        </div>
    );
}
