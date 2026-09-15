/**
 * The word compose/edit orchestrator: PoS gate -> `WordEditorLayout` (a
 * collapsible left sidebar of actions/clue/tags-placeholder, next to the
 * translation grid) -> "+ Add language" dialog. Shared by `AddWordPage`
 * (create) and `WordPage` (edit); `initialWord`/`onDelete`/`extraActions`
 * exist so each call site can add its own actions (Cancel, Delete) without
 * this component learning about navigation.
 *
 * All state lives in `useWordFormState`; this component only renders it and
 * forwards events. No toasts, no navigation — those are call-site concerns
 * (`AddWordPage`'s `onSubmit`).
 */
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { FlagIcon } from '@/components/common/FlagIcon';
import { PartOfSpeechSelector } from '@/components/common/PartOfSpeechSelector';
import { ArrowsClockwiseIcon, FloppyDiskIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import type { Lang, PartOfSpeech } from '@/ts/enums';
import { useUiStore } from '@/stores/uiStore';
import { SidebarAction } from '../layout/SidebarAction';
import { SidebarFields } from '../layout/SidebarFields';
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
     * sidebar's action group, without this component learning anything about
     * navigation.
     */
    extraActions?: ReactNode;
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
    const [addLangOpen, setAddLangOpen] = useState(false);
    const [confirmChangeTypeOpen, setConfirmChangeTypeOpen] = useState(false);
    const collapsed = useUiStore((s) => s.wordSidebarCollapsed);

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

    function pickLanguage(lang: Lang) {
        state.addTranslation(lang);
        setAddLangOpen(false);
    }

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

    const sidebar = (
        <div className="flex h-full flex-col gap-4">
            <div className="flex flex-col gap-2">
                <SidebarAction
                    icon={<PlusIcon size={18} />}
                    disabled={!state.canAddMore}
                    onClick={() => setAddLangOpen(true)}
                    collapsed={collapsed}
                >
                    {t('common:buttons.addAnotherTranslation')}
                </SidebarAction>
                {mode === 'create' && onChangePartOfSpeech && (
                    <SidebarAction
                        icon={<ArrowsClockwiseIcon size={18} />}
                        onClick={handleChangePartOfSpeechClick}
                        collapsed={collapsed}
                    >
                        {t('wordRelated:wordForm.buttons.changeWordType')}
                    </SidebarAction>
                )}
                {extraActions}
                {mode === 'edit' && onDelete && (
                    <SidebarAction icon={<TrashIcon size={18} />} variant="destructive" onClick={onDelete} collapsed={collapsed}>
                        {t('common:buttons.delete')}
                    </SidebarAction>
                )}
            </div>

            <SidebarFields clue={state.clue} onClueChange={state.setClue} collapsed={collapsed} />

            <div className="mt-auto sticky bottom-0 flex flex-col gap-2 border-t border-border bg-background pt-3">
                {!collapsed && state.belowMinTranslations && (
                    <p className="hint">{t('wordRelated:wordForm.hints.minTranslations')}</p>
                )}
                <SidebarAction
                    variant="default"
                    icon={submitting ? <span className="spinner" /> : <FloppyDiskIcon size={18} />}
                    disabled={!state.canSave || submitting}
                    onClick={handleSave}
                    collapsed={collapsed}
                    hint={state.belowMinTranslations ? t('wordRelated:wordForm.hints.minTranslations') : undefined}
                >
                    {submitting ? t('common:status.saving') : t('common:buttons.saveChanges')}
                </SidebarAction>
            </div>
        </div>
    );

    return (
        <WordEditorLayout sidebar={sidebar}>
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
                            // case is surfaced instead as a hint next to the Save action in the sidebar.
                            removeDisabled={false}
                        />
                    ))}
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

                <Dialog open={addLangOpen} onOpenChange={setAddLangOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{t('wordRelated:translationFormGeneric.selectLanguage')}</DialogTitle>
                        </DialogHeader>
                        <div className="flex flex-wrap gap-2">
                            {state.availableLanguages.map((lang) => (
                                <button
                                    key={lang.key}
                                    type="button"
                                    className="chip"
                                    onClick={() => pickLanguage(lang.label as Lang)}
                                >
                                    <FlagIcon lang={lang.key} />
                                    {lang.native}
                                </button>
                            ))}
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </WordEditorLayout>
    );
}
