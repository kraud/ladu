/**
 * The word compose/edit orchestrator: PoS gate -> `WordEditorLayout` (a
 * collapsible left sidebar of clue/tags, the translation grid and a sticky
 * bottom bar with the actions and the reason Save is disabled; the grid ends in the "+ Add translation" tile — one chip per
 * still-free language, so a click adds it with no dialog; the tile is not
 * rendered once nothing more can be added). Shared by `AddWordPage`
 * (create) and `WordPage` (edit); `initialWord`/`onDelete`/`extraActions`
 * exist so each call site can add its own actions (Cancel, Delete) without
 * this component learning about navigation.
 *
 * All state lives in `useWordFormState`; this component only renders it and
 * forwards events. No toasts, no navigation — those are call-site concerns
 * (`AddWordPage`'s `onSubmit`).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { FlagIcon } from '@/components/common/FlagIcon';
import { PartOfSpeechSelector } from '@/components/common/PartOfSpeechSelector';
import { ArrowsClockwiseIcon, FloppyDiskIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import type { Lang, PartOfSpeech } from '@/ts/enums';
import { SidebarFields } from '../layout/SidebarFields';
import type { EditorAction } from '../layout/WordEditorBar';
import { WordEditorLayout } from '../layout/WordEditorLayout';
import { TranslationCard, translationGridClass } from './TranslationCard';
import { useWordFormState } from './useWordFormState';
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
    /**
     * Edit mode only: lets `WordPage` inject its own Cancel action into the
     * bottom bar's action group, without this component learning anything
     * about navigation.
     */
    extraActions?: EditorAction[];
}

export function WordForm({
    mode,
    initialWord,
    defaultPartOfSpeech,
    onSubmit,
    onDelete,
    onChangePartOfSpeech,
    onPartOfSpeechChange,
    submitting,
    extraActions,
}: WordFormProps) {
    const { t } = useTranslation();
    const state = useWordFormState({ initialWord, defaultPartOfSpeech });
    const [confirmChangeTypeOpen, setConfirmChangeTypeOpen] = useState(false);

    function pickPartOfSpeech(pos: PartOfSpeech) {
        state.setPartOfSpeech(pos);
        onPartOfSpeechChange?.(pos);
    }

    // Create-mode PoS gate: nothing else renders until a part of speech is picked.
    if (mode === 'create' && !state.partOfSpeech) {
        return <PartOfSpeechSelector value={state.partOfSpeech} onChange={pickPartOfSpeech} />;
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

    function handleSave() {
        const payload = state.buildPayload();
        onSubmit(mode === 'edit' && initialWord ? { ...payload, id: initialWord.id } : payload);
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
        ...(mode === 'edit' ? (extraActions ?? []) : []),
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

    // Save's "why not" message; nothing is shown once Save is enabled.
    const statusText =
        submitting || !state.saveBlockReason
            ? undefined
            : t(`wordRelated:wordForm.hints.${state.saveBlockReason}`);

    return (
        <WordEditorLayout
            sidebar={<SidebarFields clue={state.clue} onClueChange={state.setClue} />}
            actions={actions}
            primary={{
                label: submitting ? t('common:status.saving') : t('wordRelated:wordForm.buttons.saveWord'),
                icon: submitting ? <span className="spinner" /> : <FloppyDiskIcon size={18} />,
                onClick: handleSave,
                disabled: !state.canSave || submitting,
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
                            onRemove={() => state.removeTranslation(index)}
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
