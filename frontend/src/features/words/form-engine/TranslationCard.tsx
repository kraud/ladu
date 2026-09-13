/**
 * One language slot in the word editor: header (flag + native name, tinted
 * top border), config-driven body via `FieldRenderer`, and Clear/Remove
 * footer actions. Owns its own RHF instance + yup resolver — each card
 * validates independently and pushes its own
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
 * The autocomplete row (EE/DE/ES noun autocomplete) is a Phase 3 concern —
 * only its mount point is reserved here.
 */
import { Fragment, useEffect, useMemo, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { FlagIcon } from '@/components/common/FlagIcon';
import { langTint, languageByLabel } from '@/lib/language';
import { Lang, PartOfSpeech } from '@/ts/enums';
import type { WordItem } from '@/ts/interfaces';
import { buildYupSchema } from './buildYupSchema';
import type { FieldConfig } from './configs/types';
import { getFormConfig } from './configs';
import { FieldRenderer } from './FieldRenderer';

export interface TranslationCardChange {
    cases: WordItem[];
    completionState: boolean;
    isDirty: boolean;
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
        if (field.visibleWhen && values[field.visibleWhen.field] !== field.visibleWhen.equals) continue;
        if (field.kind === 'checkbox') continue;

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
            if (field.kind === 'multi-select') return [field.name, field.decode(byCaseName.get(field.caseName) ?? '')];
            return [field.name, byCaseName.get(field.caseName) ?? ''];
        })
    );
}

/**
 * True when `fields[index]` opens a new visual group — it carries a `group`
 * whose heading differs from the previous field's (no `group` at all counts
 * as "no heading"). Exported for direct testing; `TranslationCard`'s render
 * loop is the only real caller.
 */
export function fieldStartsGroup(fields: FieldConfig[], index: number): boolean {
    const field = fields[index];
    if (!field.group) return false;
    const previous = index > 0 ? fields[index - 1] : undefined;
    return previous?.group?.headingKey !== field.group.headingKey;
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

    const langEntry = languageByLabel(lang);

    return (
        <div
            className="flex flex-col gap-4 rounded-lg border bg-card p-4"
            style={{ borderTopColor: langTint(lang), borderTopWidth: 2 }}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <FlagIcon lang={lang} title={langEntry?.native ?? lang} />
                    {langEntry?.native ?? lang}
                </div>
                {!displayOnly && (
                    <div className="flex gap-2">
                        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
                            {t('common:buttons.clear')}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={onRemove} disabled={removeDisabled}>
                            {t('common:buttons.remove')}
                        </Button>
                    </div>
                )}
            </div>

            <Form {...form}>
                <div className="flex flex-col gap-3">
                    {/* Autocomplete row (EE/DE/ES noun autocomplete) — Phase 3 mount point. */}
                    {config.fields.map((field, index) => (
                        <Fragment key={field.name}>
                            {fieldStartsGroup(config.fields, index) && field.group && (
                                <p
                                    className={
                                        field.group.level === 1
                                            ? 'mt-2 text-sm font-semibold text-foreground underline'
                                            : 'text-xs font-medium uppercase tracking-wide text-muted-foreground'
                                    }
                                >
                                    {t(field.group.headingKey)}
                                </p>
                            )}
                            <FieldRenderer field={field} displayOnly={displayOnly} />
                        </Fragment>
                    ))}
                </div>
            </Form>
        </div>
    );
}
