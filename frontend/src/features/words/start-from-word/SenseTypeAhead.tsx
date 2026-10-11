/**
 * The text field of the "Start from a word" section (Slice G, step G4): free text with a list of
 * senses under it. Same pattern as `TypeAheadInput` (Base UI Autocomplete: the text stays free, the
 * list only suggests; `mode="none"` because the server already filtered), but it is not tied to the
 * form engine: the section keeps its own text, and a pick calls `onPick`.
 *
 * From 2 characters, after a short pause, the list shows one line per sense of the words that start
 * with the text, in the language the section's language select names (the server matches only that
 * language). A line: the word (with its article), the part of speech when the section's part of
 * speech select says "Any", and the meaning ("bank — financial institution"). The list closes on a
 * pick, Escape, Tab and a click outside.
 */
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Autocomplete } from '@base-ui/react/autocomplete';
import { Input } from '@/components/ui/input';
import { MIN_PREFIX_LENGTH, useSenseSuggestions } from '@/features/autocomplete/hooks';
import type { SenseSuggestion } from '@/features/autocomplete/types';
import { useDebouncedCallback } from '@/lib/useDebouncedCallback';
import { partOfSpeechLabelKey } from '@/lib/words';
import type { Lang, PartOfSpeech } from '@/ts/enums';

const SUGGEST_DEBOUNCE_MS = 150;

/** One line's identity: the same word can appear once per sense and part of speech. */
const itemId = (item: SenseSuggestion) =>
    [item.partOfSpeech, item.word, item.key.englishLemma, item.key.entryOrder, item.key.senseOrder].join('|');

/** "bank — financial institution"; for an English start the word is the English word, so only the meaning. */
function meaningOf(item: SenseSuggestion, fromLanguage: Lang): string {
    if (fromLanguage === 'English') return item.sense;
    return item.sense ? `${item.english} — ${item.sense}` : item.english;
}

export function SenseTypeAhead({
    language,
    partOfSpeech,
    value,
    onValueChange,
    onPick,
    label,
}: {
    language: Lang;
    partOfSpeech: PartOfSpeech | 'Any';
    value: string;
    onValueChange: (value: string) => void;
    onPick: (suggestion: SenseSuggestion) => void;
    label: string;
}) {
    const { t } = useTranslation();
    const inputId = useId();
    const [open, setOpen] = useState(false);

    const prefix = useDebouncedCallback(value, SUGGEST_DEBOUNCE_MS);
    const enabled = prefix.trim().length >= MIN_PREFIX_LENGTH;
    const { data } = useSenseSuggestions({ language, pos: partOfSpeech, prefix, enabled });
    // `keepPreviousData` would keep an old list after the text got too short.
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
            }}
            itemToStringValue={(item: SenseSuggestion) => item.word}
            open={open && items.length > 0}
            onOpenChange={setOpen}
        >
            <Autocomplete.Input
                id={inputId}
                render={<Input />}
                autoComplete="off"
                aria-label={label}
                placeholder={t('wordRelated:startFromWord.wordPlaceholder')}
                data-testid="start-word-input"
            />
            <Autocomplete.Portal>
                <Autocomplete.Positioner side="bottom" align="start" sideOffset={4} className="isolate z-50">
                    <Autocomplete.Popup
                        data-testid="sense-list"
                        aria-label={t('wordRelated:startFromWord.listLabel')}
                        className="max-h-80 w-(--anchor-width) min-w-64 overflow-y-auto rounded-lg border border-(--border) bg-popover p-1 text-popover-foreground shadow-md"
                    >
                        <Autocomplete.List className="flex flex-col gap-0.5">
                            {(item: SenseSuggestion) => (
                                <Autocomplete.Item
                                    key={itemId(item)}
                                    value={item}
                                    onClick={() => {
                                        setOpen(false);
                                        onPick(item);
                                    }}
                                    className="flex cursor-default flex-col gap-0.5 rounded-md px-2.5 py-1.5 text-sm outline-hidden select-none data-highlighted:bg-(--hover)"
                                >
                                    <span className="flex items-baseline gap-1.5">
                                        {item.gender && (
                                            <>
                                                <span className="text-muted-foreground">{item.gender}</span>{' '}
                                            </>
                                        )}
                                        <span className="font-medium">{item.word}</span>
                                        {partOfSpeech === 'Any' && (
                                            <span className="text-xs text-muted-foreground">
                                                {t(partOfSpeechLabelKey(item.partOfSpeech as PartOfSpeech))}
                                            </span>
                                        )}
                                    </span>
                                    {meaningOf(item, language) && (
                                        <span className="text-xs text-muted-foreground">{meaningOf(item, language)}</span>
                                    )}
                                </Autocomplete.Item>
                            )}
                        </Autocomplete.List>
                    </Autocomplete.Popup>
                </Autocomplete.Positioner>
            </Autocomplete.Portal>
        </Autocomplete.Root>
    );
}
