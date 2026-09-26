/**
 * One language slot in the word editor: a tinted-bg header (flag + native
 * name, the completion ring, the collapse toggle), a config-driven body via
 * `FieldRenderer`, and a tinted-bg footer (autocomplete on the left,
 * Clear/Remove on the right) — mirrors `MOCKUPS/word-editor.html`'s
 * `.tcard-head`/`.tcard-foot` bars. Owns its own RHF instance + yup resolver
 * — each card validates independently and pushes its own
 * `{ cases, completionState, isDirty }` up to the parent (`useWordFormState`)
 * on every change, mirroring the old app's per-language forms pushing up
 * independently rather than one shared giant form.
 *
 * Completion is computed from the yup schema directly (`schema.isValidSync`),
 * not RHF's own `formState.isValid` — the latter only reflects reality once a
 * validation pass has run (a submit, or an explicit `trigger()`), and forcing
 * that on mount would also flip on the *visible* field-level error messages
 * for a freshly-added, still-empty card. Field-level errors stay driven by
 * `mode: 'onBlur'`, decoupled from the word-level completion signal.
 *
 * The header/body/footer bars all live inside the single CSS-hidden wrapper
 * `collapsed` toggles — never a conditional `{!collapsed && …}` — so RHF's
 * watchers (and `AutocompleteRow`'s own debounce/fetch state) keep running
 * while the card is collapsed, matching the completion ring/summary this
 * card still reports upward. `AutocompleteRow` renders itself out for every
 * `(lang, pos)` pair with no lookup endpoint — this card never branches on
 * that beyond gating the footer's own layout.
 */
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from 'react-i18next';
import { CaretDownIcon, CaretUpIcon } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { CompletionRing } from '@/components/common/CompletionRing';
import { FlagIcon } from '@/components/common/FlagIcon';
import { langTint, languageByLabel } from '@/lib/language';
import { primaryCaseWord } from '@/lib/words';
import { Lang, PartOfSpeech } from '@/ts/enums';
import type { WordItem } from '@/ts/interfaces';
import { getAutocompleteEndpoint } from '@/features/autocomplete/transforms';
import { AutocompleteRow } from './AutocompleteRow';
import { buildYupSchema } from './buildYupSchema';
import { matchesVisibility, type FieldConfig, type FieldGroup } from './configs/types';
import { getFormConfig } from './configs';
import { FieldRenderer } from './FieldRenderer';
import { buildLayoutItems, isHiddenInDisplayOnly, isPersistedCaseField } from './fieldLayout';

export interface TranslationCardChange {
    cases: WordItem[];
    completionState: boolean;
    isDirty: boolean;
}

/**
 * The class for the container arranging multiple `TranslationCard`s (the
 * compose form, the word detail page, both edit and read-only). Verb cards
 * need the full row for their tense-column grid; every other part of speech
 * keeps the compact 2-up layout. `pos` is omitted where it isn't known yet
 * (a loading skeleton) — defaults to the 2-up layout, the common case.
 */
export function translationGridClass(pos?: PartOfSpeech): string {
    return pos === PartOfSpeech.verb
        ? 'grid grid-cols-1 items-start gap-4'
        : 'grid grid-cols-1 items-start gap-4 sm:grid-cols-2';
}

export interface TranslationCardProps {
    lang: Lang;
    /** Defaults to Noun — the only part of speech the engine ships in Phase 2. */
    pos?: PartOfSpeech;
    initialCases?: WordItem[];
    displayOnly?: boolean;
    onRemove?: () => void;
    onClear?: () => void;
    removeDisabled?: boolean;
    /** Fires on every value change (never in `displayOnly` mode). */
    onChange?: (next: TranslationCardChange) => void;
    /**
     * Bump this (e.g. from `useWordFormState`'s `resetTokens`) to force the
     * card back to `initialCases` — an explicit "resync now" signal, since the
     * card otherwise never re-reads `initialCases` after mount (see the
     * `useForm` comment below for why). Change detection is by value, not by
     * presence, so the very first render never fires a spurious reset.
     */
    resetKey?: number;
}

/**
 * `FieldConfig[]` + current RHF values -> the persisted `WordItem[]`.
 * Dropped, in order: a field hidden by its own `visibleWhen` (the sibling it
 * depends on doesn't currently equal the configured value); a field marked
 * `persisted: false` (form-only, e.g. Estonian `searchInEnglish`, Spanish
 * adjective `gender`); a `checkbox` field (no PoS backs a case with one
 * today); and finally, any field whose resulting word is blank.
 *
 * Exported for direct unit testing against hand-built configs — the encode
 * round-trip (multi-select) and the two drop rules above don't need a real
 * noun/verb/adjective config to exercise.
 */
export function fieldsToCases(fields: FieldConfig[], values: Record<string, unknown>): WordItem[] {
    const cases: WordItem[] = [];
    for (const field of fields) {
        if (field.persisted === false) continue;
        if (field.visibleWhen && !matchesVisibility(field.visibleWhen, values[field.visibleWhen.field])) continue;
        if (field.kind === 'checkbox') continue;
        if (!field.caseName) continue; // a case-less radio (Spanish adjective's `gender`) — always `persisted: false` in practice, guarded again here for the type checker.

        const raw = values[field.name];
        let word: string;
        if (field.kind === 'multi-select') {
            word = field.encode(Array.isArray(raw) ? (raw as string[]) : []);
        } else {
            word = typeof raw === 'string' ? raw : '';
            if (field.kind === 'text' && field.lowercase) word = word.toLowerCase();
        }
        if (word !== '') cases.push({ caseName: field.caseName, word });
    }
    return cases;
}

/**
 * The inverse hydration step: stored `WordItem[]` -> one RHF default value
 * per field. A `multi-select` field's stored word is a single encoded string
 * (e.g. the German verb-case acronym) — `field.decode` expands it back into
 * the selected option values the checkbox group needs. Exported alongside
 * `fieldsToCases` for the same reason.
 */
export function casesToFieldValues(fields: FieldConfig[], cases: WordItem[] | undefined): Record<string, unknown> {
    const byCaseName = new Map((cases ?? []).map((item) => [item.caseName, item.word]));
    return Object.fromEntries(
        fields.map((field) => {
            if (field.kind === 'checkbox') return [field.name, false];
            if (!field.caseName) return [field.name, '']; // a case-less radio has nothing to hydrate from
            if (field.kind === 'multi-select') return [field.name, field.decode(byCaseName.get(field.caseName) ?? '')];
            return [field.name, byCaseName.get(field.caseName) ?? ''];
        })
    );
}

/**
 * The heading lines to print before `fields[index]`: the tail of its `group`
 * stack starting at the first entry that differs from the previous field's
 * (by `heading`) — empty if nothing changed. A field whose `group` is
 * entirely new (the previous field has no group, or a shorter one) prints
 * its whole stack; one that only changes its innermost tense prints just
 * that entry, leaving an already-visible outer heading (a verb's mood) in
 * place. Exported for direct testing; `TranslationCard`'s render loop is the
 * only real caller.
 */
export function groupHeadingsToPrint(fields: FieldConfig[], index: number): FieldGroup[] {
    const group = fields[index].group;
    if (!group || group.length === 0) return [];
    const previousGroup = index > 0 ? (fields[index - 1].group ?? []) : [];
    const firstDiff = group.findIndex((entry, i) => entry.heading !== previousGroup[i]?.heading);
    return firstDiff === -1 ? [] : group.slice(firstDiff);
}

export function TranslationCard({
    lang,
    pos = PartOfSpeech.noun,
    initialCases,
    displayOnly = false,
    onRemove,
    onClear,
    removeDisabled = false,
    onChange,
    resetKey,
}: TranslationCardProps) {
    const { t } = useTranslation();
    const [collapsed, setCollapsed] = useState(false);
    const config = getFormConfig(pos, lang);
    const schema = useMemo(() => (config ? buildYupSchema(config, t) : undefined), [config, t]);

    const defaultValues = useMemo(
        () => (config ? casesToFieldValues(config.fields, initialCases) : {}),
        [config, initialCases]
    );

    // Plain `defaultValues` (mount-time only), NOT the reactive `values` option:
    // this card's own `onChange` echoes its cases back up into `useWordFormState`,
    // which is exactly what `initialCases` is computed from on the next parent
    // render. A `values`-controlled form would resync from that echo on every
    // keystroke, snapping `formState.isDirty` back to `false` right after RHF
    // set it `true` — since after the resync, "current" once again equals the
    // (echoed) "default". Each card owns its state for its whole lifetime once
    // mounted; a genuine external reset (Clear, and future edit-mode Cancel)
    // instead calls `form.reset()` explicitly via `resetKey` below.
    const form = useForm({
        resolver: schema ? yupResolver(schema) : undefined,
        defaultValues,
        mode: 'onBlur',
    });

    // The explicit resync path `values` would otherwise have provided: fires
    // only when `resetKey` itself changes value (not on every `defaultValues`
    // recompute, which happens on every keystroke via the echo above) — that's
    // what tells apart "the parent is just echoing what I told it" (ignored)
    // from "something wants a real reset" (acted on). Guards against firing on
    // mount, where `defaultValues` is already the form's initial state.
    const lastResetKey = useRef(resetKey);
    useEffect(() => {
        if (resetKey === undefined || resetKey === lastResetKey.current) return;
        lastResetKey.current = resetKey;
        form.reset(defaultValues);
    }, [resetKey, defaultValues, form]);

    const watched = useWatch({ control: form.control }) as Record<string, unknown>;
    const { isDirty } = form.formState;

    const cases = useMemo(
        () => (config ? fieldsToCases(config.fields, watched) : []),
        [config, watched],
    );

    // Fields the current form state would actually render, split in two
    // steps so the collapsed-card case count (below) can use the first
    // without the second: `branchFields` drops a `visibleWhen` mismatch only
    // (i.e. what a COMPLETE translation would persist for the branch this
    // form is currently on); `visibleFields` additionally drops an empty
    // non-required field in `displayOnly` — the pre-`buildLayoutItems` filter
    // `fieldLayout.ts`'s file header describes, so a hidden branch (Spanish
    // adjective gender, German adverb non-gradable) never leaves a blank cell
    // behind.
    const branchFields = useMemo(() => {
        if (!config) return [];
        return config.fields.filter(
            (field) => !field.visibleWhen || matchesVisibility(field.visibleWhen, watched[field.visibleWhen.field]),
        );
    }, [config, watched]);
    const visibleFields = useMemo(
        () => branchFields.filter((field) => !isHiddenInDisplayOnly(field, watched[field.name], displayOnly)),
        [branchFields, watched, displayOnly],
    );

    const layoutItems = useMemo(() => buildLayoutItems(visibleFields), [visibleFields]);
    // The collapsed-card summary's denominator: how many cases a COMPLETE
    // translation on this branch would persist — mirrors `fieldsToCases`'
    // drop rules via the shared `isPersistedCaseField` (also used by
    // `review/completion.ts`'s ring, over the same field list shape).
    const expectedCaseCount = useMemo(
        () => branchFields.filter(isPersistedCaseField).length,
        [branchFields],
    );
    const completionState = useMemo(() => {
        if (!schema) return false;
        try {
            return schema.isValidSync(watched);
        } catch {
            return false;
        }
    }, [schema, watched]);

    useEffect(() => {
        if (displayOnly) return;
        onChange?.({ cases, completionState, isDirty });
        // `onChange` intentionally excluded: the parent always passes an
        // equivalent closure (bound to this card's stable index), so
        // including it would re-fire this effect — and re-set the identical
        // parent state — on every parent render, without changing behaviour.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cases, completionState, isDirty, displayOnly]);

    if (!config) {
        return (
            <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                {t('wordRelated:wordFormSelector.languageNotAvailable')}
            </div>
        );
    }

    const autocompleteEndpoint = getAutocompleteEndpoint(lang, pos);
    const hasAutocomplete = autocompleteEndpoint !== undefined;

    const langEntry = languageByLabel(lang);
    const headline = primaryCaseWord(pos, { language: lang, cases });
    const caseCountText = t('wordRelated:translationFormGeneric.caseCount', {
        value: cases.length,
        total: expectedCaseCount,
    });
    const summary = headline ? `${headline} · ${caseCountText}` : t('wordRelated:translationFormGeneric.emptyCard');

    return (
        <div
            className="flex flex-col overflow-hidden rounded-lg border bg-card"
            style={{ borderTopColor: langTint(lang), borderTopWidth: 2 }}
        >
            <div className="flex items-center justify-between gap-2 border-b border-border bg-background px-4 py-3">
                <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
                    <FlagIcon lang={lang} title={langEntry?.native ?? lang} />
                    <span className="shrink-0">{langEntry?.native ?? lang}</span>
                    {collapsed && <span className="hint truncate">{summary}</span>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {!displayOnly && !collapsed && (
                        <CompletionRing value={cases.length} total={expectedCaseCount} detail={caseCountText} />
                    )}
                    <button
                        type="button"
                        className="icon-btn"
                        aria-label={t(
                            collapsed
                                ? 'wordRelated:translationFormGeneric.expand'
                                : 'wordRelated:translationFormGeneric.collapse',
                        )}
                        title={t(
                            collapsed
                                ? 'wordRelated:translationFormGeneric.expand'
                                : 'wordRelated:translationFormGeneric.collapse',
                        )}
                        onClick={() => setCollapsed((prev) => !prev)}
                    >
                        {collapsed ? <CaretDownIcon size={16} /> : <CaretUpIcon size={16} />}
                    </button>
                </div>
            </div>

            <Form {...form}>
                <div className={collapsed ? 'hidden' : 'flex flex-col'}>
                    <div className="flex flex-col gap-3 p-4">
                        {layoutItems.map((item) => (
                            <Fragment
                                key={
                                    item.kind === 'field' ? item.field.name : item.fields.map((field) => field.name).join('|')
                                }
                            >
                                {groupHeadingsToPrint(visibleFields, item.index).map((heading) => (
                                    <p
                                        key={heading.heading}
                                        className={
                                            heading.level === 1
                                                ? 'mt-2 text-sm font-semibold text-foreground underline'
                                                : 'text-xs font-medium uppercase tracking-wide text-muted-foreground'
                                        }
                                    >
                                        {heading.heading}
                                    </p>
                                ))}
                                {item.kind === 'field' ? (
                                    <FieldRenderer
                                        field={item.field}
                                        displayOnly={displayOnly}
                                        autocompleteFieldName={autocompleteEndpoint?.queryFieldName}
                                        reserveMessageSpace={item.field.required}
                                    />
                                ) : (
                                    // `items-end`: the autocomplete trigger's bold label and 2px border make
                                    // its cell taller than its neighbours', so cells bottom-align — inputs
                                    // then share one bottom edge instead of drifting by the difference.
                                    // Only rows with a mandatory field use it (every autocomplete trigger is
                                    // mandatory); an optional row's cells are `self-start`, so a message
                                    // that takes its own line there cannot push a neighbour's input down.
                                    <div
                                        className="grid items-end gap-x-4 gap-y-3"
                                        style={{ gridTemplateColumns: `repeat(${item.columns.length}, minmax(0, 1fr))` }}
                                    >
                                        {item.columnHeadings?.map((heading, columnIndex) => (
                                            <p
                                                key={`heading-${columnIndex}`}
                                                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                                            >
                                                {heading ?? ''}
                                            </p>
                                        ))}
                                        {item.cells.map((rowFields, rowIndex) => {
                                            // The whole row reserves message room when any field in it is mandatory.
                                            const reserveMessageSpace = rowFields.some((field) => field?.required);
                                            return rowFields.map((field, columnIndex) => (
                                                <div
                                                    key={`${rowIndex}-${columnIndex}`}
                                                    className={reserveMessageSpace ? 'self-end' : 'self-start'}
                                                >
                                                    {field && (
                                                        <FieldRenderer
                                                            field={field}
                                                            displayOnly={displayOnly}
                                                            autocompleteFieldName={autocompleteEndpoint?.queryFieldName}
                                                            reserveMessageSpace={reserveMessageSpace}
                                                        />
                                                    )}
                                                </div>
                                            ));
                                        })}
                                    </div>
                                )}
                            </Fragment>
                        ))}
                    </div>
                    {!displayOnly && (hasAutocomplete || onClear || onRemove) && (
                        <div className="flex items-center justify-between gap-2 border-t border-border bg-background px-4 py-2.5">
                            <div className="min-w-0">
                                {hasAutocomplete && <AutocompleteRow lang={lang} pos={pos} fields={config.fields} />}
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                {onClear && (
                                    <Button type="button" variant="ghost" size="sm" onClick={onClear}>
                                        {t('common:buttons.clear')}
                                    </Button>
                                )}
                                {onRemove && (
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        size="sm"
                                        onClick={onRemove}
                                        disabled={removeDisabled}
                                    >
                                        {t('common:buttons.remove')}
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </Form>
        </div>
    );
}
