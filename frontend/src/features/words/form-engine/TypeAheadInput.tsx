/**
 * The autocomplete query field with its type-ahead list (Slice E,
 * `.context/plans/autocomplete-data-source-strategy.md`, decision D21).
 *
 * Typing works as before: the text goes into the form, and the lookup in the card footer
 * (`AutocompleteRow`) runs as before. In addition, from 2 characters on, a list under the field
 * shows dictionary words that start with the text (`GET /api/dictionary/:lang/:pos?prefix=`),
 * the most frequent first; a homograph shows once per meaning, with its article ("der See",
 * "die See"). A pick — click, or arrow keys + Enter — calls `onPick`, which fills the card with
 * that exact entry (`TranslationCard`'s `pickSuggestion`). Typing without a pick changes nothing.
 *
 * Built on Base UI's Autocomplete (an input whose text stays free-form; the list only suggests),
 * not its Combobox (which keeps a selected value): the field must also accept words that are not
 * in the list. `mode="none"`: the server already filtered the list, and arrow keys move the
 * highlight without rewriting the text. The list stays closed while it has nothing to show.
 *
 * Getting out of the way (D21, changed in Slice H): an open list covers the card footer, where "Use
 * autocomplete values" appears, and hides the rest of the page from assistive technology (the
 * combobox pattern). So the list closes on a pick, Escape, Tab and a click outside. It does NOT
 * close by itself when the user has typed a whole word that is in the list (even when it is the
 * only match): the user can still click it, and a pick fills the card with that exact entry, the
 * same as the button. A word that is not in the list shows no list, so the button is free.
 *
 * Not slower to type in (design commandment 1): the text reaches the form on every key press as
 * before; only the list request waits for a short pause (`SUGGEST_DEBOUNCE_MS`).
 */
import { forwardRef, useState, type ComponentProps } from 'react';
import { useWatch, useFormContext } from 'react-hook-form';
import { Autocomplete } from '@base-ui/react/autocomplete';
import { Input } from '@/components/ui/input';
import { MIN_PREFIX_LENGTH, useDictionarySuggestions } from '@/features/autocomplete/hooks';
import type { Suggestion } from '@/features/autocomplete/types';
import { useDebouncedCallback } from '@/lib/useDebouncedCallback';
import type { Lang, PartOfSpeech } from '@/ts/enums';

const SUGGEST_DEBOUNCE_MS = 150;
/** Never a real RHF field; watching it is a harmless no-op (same trick as `AutocompleteRow`). */
const NO_FIELD = '__type_ahead_none__';

/** What `FieldRenderer` needs to turn the autocomplete query field into this component. */
export interface TypeAheadConfig {
    lang: Lang;
    pos: PartOfSpeech;
    /** A checkbox that turns the list off while checked (Estonian "Search verb in English", D21). */
    offWhenField?: string;
    onPick: (suggestion: Suggestion) => void;
    /** The user typed (not a pick): any earlier pick no longer applies. */
    onType: () => void;
}

export interface TypeAheadInputProps
    extends Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'defaultValue'> {
    config: TypeAheadConfig;
    value: string;
    onValueChange: (value: string) => void;
}

export const TypeAheadInput = forwardRef<HTMLInputElement, TypeAheadInputProps>(function TypeAheadInput(
    { config, value, onValueChange, ...inputProps },
    ref
) {
    const { control } = useFormContext();
    const listOff = useWatch({ control, name: config.offWhenField ?? NO_FIELD }) === true;
    const [open, setOpen] = useState(false);

    const prefix = useDebouncedCallback(value, SUGGEST_DEBOUNCE_MS);
    const enabled = !listOff && prefix.trim().length >= MIN_PREFIX_LENGTH;
    const { data } = useDictionarySuggestions({ language: config.lang, pos: config.pos, prefix, enabled });
    // `keepPreviousData` would keep an old list after the text got too short, or the list was turned off.
    const items = enabled && value.trim().length >= MIN_PREFIX_LENGTH ? (data ?? []) : [];

    return (
        <Autocomplete.Root
            items={items}
            mode="none"
            value={value}
            onValueChange={(next, details) => {
                // A pick sets the text itself, in `onPick`.
                if (details.reason === 'item-press') return;
                onValueChange(next);
                config.onType();
            }}
            itemToStringValue={(item: Suggestion) => item.lemma}
            open={open && items.length > 0}
            onOpenChange={setOpen}
        >
            <Autocomplete.Input ref={ref} render={<Input />} autoComplete="off" {...inputProps} />
            <Autocomplete.Portal>
                <Autocomplete.Positioner side="bottom" align="start" sideOffset={4} className="isolate z-50">
                    <Autocomplete.Popup
                        data-testid="type-ahead-list"
                        className="max-h-72 w-(--anchor-width) min-w-48 overflow-y-auto rounded-lg border border-(--border) bg-popover p-1 text-popover-foreground shadow-md"
                    >
                        <Autocomplete.List className="flex flex-col gap-0.5">
                            {(item: Suggestion) => (
                                <Autocomplete.Item
                                    key={item.entryId}
                                    value={item}
                                    onClick={() => config.onPick(item)}
                                    className="flex cursor-default items-baseline gap-1.5 rounded-md px-2.5 py-1.5 text-sm outline-hidden select-none data-highlighted:bg-(--hover)"
                                >
                                    {item.hint && <span className="text-muted-foreground">{item.hint}</span>}
                                    <span>{item.lemma}</span>
                                </Autocomplete.Item>
                            )}
                        </Autocomplete.List>
                    </Autocomplete.Popup>
                </Autocomplete.Positioner>
            </Autocomplete.Portal>
        </Autocomplete.Root>
    );
});
