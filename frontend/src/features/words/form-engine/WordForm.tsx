/**
 * The word compose/edit orchestrator: PoS gate -> `WordEditorLayout` (a
 * collapsible left sidebar of clue/tags, the translation grid and a sticky
 * bottom bar with the actions and the reason Save is disabled; the grid ends in the "+ Add translation" tile — one chip per
 * still-free language, so a click adds it with no dialog; the tile is not
 * rendered once nothing more can be added). Shared by `AddWordPage`
 * (create) and `WordPage` (edit); `initialWord`/`onDelete`/`cancelAction`
 * exist so each call site can add its own actions (Cancel, Delete) without
 * this component learning about navigation.
 *
 * All state lives in `useWordFormState`; this component only renders it and
 * forwards events. No toasts, no navigation — those are call-site concerns
 * (`AddWordPage`'s `onSubmit`).
 *
 * Tags (D4, revised 2026-09-28): picks are always staged locally, in *both*
 * modes — never applied until Save, and Cancel (unmounting this component)
 * discards them for free, same as an abandoned translation edit. Create mode
 * has no word yet, so its picks ride along as `tagIds` on the create request;
 * edit mode's picks are diffed against `initialWord.tags` at Save time into
 * one `linkTagsToWords`/`unlinkTagsFromWords` call each (not one call per
 * pick — the user may add and remove several before ever pressing Save).
 * Picking or un-picking a tag alone is enough to enable Save, even with
 * nothing else changed (`tagsChanged` below, alongside `useWordFormState`'s
 * own `hasChanges`).
 */
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { FlagIcon } from '@/components/common/FlagIcon';
import { languageByLabel } from '@/lib/language';
import { PartOfSpeechSelector } from '@/components/common/PartOfSpeechSelector';
import { ArrowsClockwiseIcon, FloppyDiskIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { resolveLoadingToastSuccess, startLoadingToast } from '@/lib/toast';
import { useLinkTagsToWords, useUnlinkTagsFromWords } from '@/features/tags/hooks';
import { tagErrorKey } from '@/features/tags/errors';
import type { TagComboboxItem } from '@/features/tags/components/TagCombobox';
import type { Lang, PartOfSpeech } from '@/ts/enums';
import { PageColumn } from '@/components/layout/PageColumn';
import { useWordSidebarSections } from '../layout/SidebarFields';
import type { EditorAction } from '../layout/WordEditorBar';
import { WordEditorLayout } from '../layout/WordEditorLayout';
import { TranslationCard, translationGridClass } from './TranslationCard';
import { translationHasData, useWordFormState } from './useWordFormState';
import type { CreateWordBody, UpdateWordBody, WordBE } from '../types';

export interface WordFormProps {
    mode: 'create' | 'edit';
    /** Edit mode: the word being edited. */
    initialWord?: WordBE;
    /** Create mode: pre-seeds the PoS gate from the route param. */
    defaultPartOfSpeech?: PartOfSpeech;
    onSubmit: (body: CreateWordBody | UpdateWordBody) => void;
    onDelete?: () => void;
    submitting?: boolean;
    /**
     * Create mode only: lets the user pick a different part of speech before
     * the first save, discarding whatever is in the form. Absent in edit mode
     * — `partOfSpeech` is immutable after creation.
     */
    onChangePartOfSpeech?: () => void;
    /**
     * Create mode only: fires the moment a part of speech is picked on the
     * gate, so `AddWordPage`'s title (D38) can react live — the pick itself
     * lives in `useWordFormState`'s own state, not a prop this component
     * receives back.
     */
    onPartOfSpeechChange?: (pos: PartOfSpeech) => void;
    /** The page title block: first in the content column (or above the PoS gate). */
    header?: ReactNode;
    /**
     * Edit mode only: lets `WordPage` inject its own Cancel action, rendered
     * next to (left of) the primary Save button on desktop, without this
     * component learning anything about navigation.
     */
    cancelAction?: EditorAction;
}

export function WordForm({
    mode,
    initialWord,
    defaultPartOfSpeech,
    onSubmit,
    onDelete,
    onChangePartOfSpeech,
    onPartOfSpeechChange,
    header,
    submitting,
    cancelAction,
}: WordFormProps) {
    const { t } = useTranslation();
    const state = useWordFormState({ initialWord, defaultPartOfSpeech });
    const [confirmChangeTypeOpen, setConfirmChangeTypeOpen] = useState(false);
    // The language whose Remove is waiting for a confirmation (by language, not index, so it stays right if the list changes).
    const [removeCandidate, setRemoveCandidate] = useState<Lang | null>(null);

    // Tags: staged locally in both modes, never applied until Save (see the
    // file header comment) — seeded once from `initialWord.tags` in edit
    // mode, same "hydrate once at mount" convention `useWordFormState` uses
    // for translations/clue (a remount via `key`, not a live re-hydrate, is
    // how `WordPage` reflects a save back into a fresh edit session).
    const [selectedTags, setSelectedTags] = useState<TagComboboxItem[]>(() =>
        mode === 'edit' && initialWord ? initialWord.tags : [],
    );
    const initialTagIds = useState(() => new Set(selectedTags.map((tag) => tag.id)))[0];
    const linkTagsToWords = useLinkTagsToWords();
    const unlinkTagsFromWords = useUnlinkTagsFromWords();

    const tagsChanged =
        selectedTags.length !== initialTagIds.size || selectedTags.some((tag) => !initialTagIds.has(tag.id));

    function handleTagsChange(next: TagComboboxItem[]) {
        const previousIds = new Set(selectedTags.map((tag) => tag.id));
        const addedCount = next.filter((tag) => !previousIds.has(tag.id)).length;
        setSelectedTags(next);
        // Only additions get a toast (matches the old create-mode-only staging
        // toast) — a removal is visible immediately as the chip disappearing.
        if (addedCount > 0) {
            resolveLoadingToastSuccess(
                startLoadingToast(t('common:status.saving')),
                t('wordRelated:wordForm.sidebar.tagsStagedToast', { count: addedCount }),
            );
        }
    }

    function pickPartOfSpeech(pos: PartOfSpeech) {
        state.setPartOfSpeech(pos);
        onPartOfSpeechChange?.(pos);
    }

    // Called before the gate's early return below: hooks must run on every render.
    const sidebarSections = useWordSidebarSections({
        clue: state.clue,
        onClueChange: state.setClue,
        tagPicker: { selected: selectedTags, onSelectedChange: handleTagsChange },
    });

    // Create-mode PoS gate: nothing else renders until a part of speech is picked.
    // No sidebar yet, so the gate brings its own centered column.
    if (mode === 'create' && !state.partOfSpeech) {
        return (
            <PageColumn wide>
                <div className="flex flex-col gap-4">
                    {header}
                    <PartOfSpeechSelector value={state.partOfSpeech} onChange={pickPartOfSpeech} />
                </div>
            </PageColumn>
        );
    }
    // Unreachable in practice: create is gated above, edit always hydrates
    // `partOfSpeech` from `initialWord` (a required field on `WordBE`).
    if (!state.partOfSpeech) return null;
    const partOfSpeech = state.partOfSpeech;

    function handleChangePartOfSpeechClick() {
        if (state.hasContent) {
            setConfirmChangeTypeOpen(true);
        } else {
            onChangePartOfSpeech?.();
        }
    }

    // An empty card goes at once; one holding anything (saved or not) asks first.
    function handleRemove(index: number) {
        const translation = state.translations[index];
        if (!translation) return;
        if (translationHasData(translation)) setRemoveCandidate(translation.language);
        else state.removeTranslation(index);
    }

    function confirmRemove() {
        const index = state.translations.findIndex((translation) => translation.language === removeCandidate);
        if (index !== -1) state.removeTranslation(index);
        setRemoveCandidate(null);
    }

    function handleSave() {
        const payload = state.buildPayload();
        if (mode === 'edit' && initialWord) {
            const word = initialWord;
            const nextIds = new Set(selectedTags.map((tag) => tag.id));
            const addedIds = selectedTags.filter((tag) => !initialTagIds.has(tag.id)).map((tag) => tag.id);
            const removedIds = word.tags.filter((tag) => !nextIds.has(tag.id)).map((tag) => tag.id);
            // Fired alongside the word update below, not gated on its result —
            // tag membership has always been independent of the word's own PUT
            // (Slice 8's Risks note); only a failure here gets its own toast,
            // to avoid piling a success toast on top of the save's own.
            if (addedIds.length > 0) {
                linkTagsToWords.mutate(
                    { tagIds: addedIds, wordIds: [word.id] },
                    { onError: (error) => toast.error(t(tagErrorKey(error))) },
                );
            }
            if (removedIds.length > 0) {
                unlinkTagsFromWords.mutate(
                    { tagIds: removedIds, wordIds: [word.id] },
                    { onError: (error) => toast.error(t(tagErrorKey(error))) },
                );
            }
            onSubmit({ ...payload, id: word.id });
            return;
        }
        // D4: tags picked before the word exists ride along on the create request.
        onSubmit(selectedTags.length > 0 ? { ...payload, tagIds: selectedTags.map((tag) => tag.id) } : payload);
    }

    const actions: EditorAction[] = [
        ...(mode === 'create' && onChangePartOfSpeech
            ? [
                  {
                      key: 'change-word-type',
                      label: t('wordRelated:wordForm.buttons.changeWordType'),
                      icon: <ArrowsClockwiseIcon size={18} />,
                      onClick: handleChangePartOfSpeechClick,
                  },
              ]
            : []),
        ...(mode === 'edit' && onDelete
            ? [
                  {
                      key: 'delete',
                      label: t('common:buttons.delete'),
                      icon: <TrashIcon size={18} />,
                      variant: 'destructive' as const,
                      onClick: onDelete,
                  },
              ]
            : []),
    ];

    // Picking/removing a tag alone is enough to enable Save (as long as the
    // word is otherwise valid) — `useWordFormState` only knows about
    // translations/clue, so its own gates (too few translations, a field
    // still incomplete) still take priority over `tagsChanged` widening
    // `hasChanges`.
    const blockedByContent = state.saveBlockReason === 'minTranslations' || state.saveBlockReason === 'incomplete';
    const canSave = !blockedByContent && (state.canSave || tagsChanged);
    const saveBlockReason = canSave ? null : state.saveBlockReason;

    // Save's "why not" message; nothing is shown once Save is enabled.
    const statusText =
        submitting || !saveBlockReason ? undefined : t(`wordRelated:wordForm.hints.${saveBlockReason}`);

    return (
        <WordEditorLayout
            sections={sidebarSections}
            header={header}
            actions={actions}
            cancelAction={mode === 'edit' ? cancelAction : undefined}
            primary={{
                label: submitting ? t('common:status.saving') : t('wordRelated:wordForm.buttons.saveWord'),
                shortLabel: submitting ? t('common:status.saving') : t('wordRelated:wordForm.buttons.saveShort'),
                icon: submitting ? <span className="spinner" /> : <FloppyDiskIcon size={18} />,
                onClick: handleSave,
                disabled: !canSave || submitting,
            }}
            statusText={statusText}
            showRequiredHint
        >
            <div className="flex flex-col gap-5">
                <div className={translationGridClass(partOfSpeech)}>
                    {state.translations.map((translation, index) => (
                        <TranslationCard
                            key={translation.language}
                            lang={translation.language}
                            pos={partOfSpeech}
                            initialCases={translation.cases}
                            onChange={(next) => state.updateTranslation(index, next)}
                            onRemove={() => handleRemove(index)}
                            onClear={() => state.clearTranslation(index)}
                            resetKey={state.resetTokens[translation.language] ?? 0}
                            // Never disabled — Remove is always available; the < 2 translations
                            // case is surfaced instead as the reason in the bottom bar.
                            removeDisabled={false}
                        />
                    ))}
                    {state.canAddMore && (
                        <div
                            role="group"
                            aria-label={t('common:buttons.addAnotherTranslation')}
                            className="flex min-h-28 flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-card/60 p-5 text-sm font-medium text-muted-foreground transition-colors hover:border-(--accent) hover:bg-(--accent-soft) hover:text-(--accent-strong)"
                        >
                            <span className="flex items-center gap-2" aria-hidden="true">
                                <PlusIcon size={16} />
                                {t('common:buttons.addAnotherTranslation')}
                            </span>
                            <div className="flex flex-wrap justify-center gap-3">
                                {state.availableLanguages.map((lang) => (
                                    <button
                                        key={lang.key}
                                        type="button"
                                        className="chip"
                                        onClick={() => state.addTranslation(lang.label as Lang)}
                                    >
                                        <FlagIcon lang={lang.key} />
                                        {lang.native}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <ConfirmDialog
                    open={removeCandidate !== null}
                    onOpenChange={(open) => {
                        if (!open) setRemoveCandidate(null);
                    }}
                    title={t('wordRelated:wordForm.confirmRemoveTranslation.title')}
                    description={t('wordRelated:wordForm.confirmRemoveTranslation.description', {
                        language: languageByLabel(removeCandidate)?.native ?? removeCandidate ?? '',
                    })}
                    confirmLabel={t('common:buttons.remove')}
                    onConfirm={confirmRemove}
                />

                <ConfirmDialog
                    open={confirmChangeTypeOpen}
                    onOpenChange={setConfirmChangeTypeOpen}
                    title={t('wordRelated:wordForm.confirmChangeType.title')}
                    description={t('wordRelated:wordForm.confirmChangeType.description')}
                    confirmLabel={t('wordRelated:wordForm.buttons.changeWordType')}
                    onConfirm={() => {
                        setConfirmChangeTypeOpen(false);
                        onChangePartOfSpeech?.();
                    }}
                />
            </div>
        </WordEditorLayout>
    );
}
