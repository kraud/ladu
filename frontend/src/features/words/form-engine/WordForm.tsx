/**
 * The word compose/edit orchestrator: PoS gate -> translation grid -> "+ Add
 * language" -> clue textarea -> sticky save bar. Shared by `AddWordPage`
 * (create) and, from Slice 5, `WordPage` (edit/view) — this slice only wires
 * the create path; `initialWord`/`onDelete` exist so Slice 5 doesn't need to
 * change this component's signature.
 *
 * All state lives in `useWordFormState`; this component only renders it and
 * forwards events. No toasts, no navigation — those are call-site concerns
 * (`AddWordPage`'s `onSubmit`).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FlagIcon } from '@/components/common/FlagIcon';
import { PartOfSpeechSelector } from '@/components/common/PartOfSpeechSelector';
import type { Lang, PartOfSpeech } from '@/ts/enums';
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
}

export function WordForm({ mode, initialWord, defaultPartOfSpeech, onSubmit, onDelete, submitting }: WordFormProps) {
    const { t } = useTranslation();
    const state = useWordFormState({ initialWord, defaultPartOfSpeech });
    const [addLangOpen, setAddLangOpen] = useState(false);

    // Create-mode PoS gate: nothing else renders until a part of speech is picked.
    if (mode === 'create' && !state.partOfSpeech) {
        return <PartOfSpeechSelector value={state.partOfSpeech} onChange={state.setPartOfSpeech} />;
    }
    // Unreachable in practice: create is gated above, edit always hydrates
    // `partOfSpeech` from `initialWord` (a required field on `WordBE`).
    if (!state.partOfSpeech) return null;
    const partOfSpeech = state.partOfSpeech;

    function pickLanguage(lang: Lang) {
        state.addTranslation(lang);
        setAddLangOpen(false);
    }

    function handleSave() {
        const payload = state.buildPayload();
        onSubmit(mode === 'edit' && initialWord ? { ...payload, id: initialWord.id } : payload);
    }

    return (
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
                        // case is surfaced instead as a hint next to the Save button below.
                        removeDisabled={false}
                    />
                ))}
            </div>

            <Button
                type="button"
                variant="outline"
                className="self-start"
                disabled={!state.canAddMore}
                onClick={() => setAddLangOpen(true)}
            >
                {t('common:buttons.addAnotherTranslation')}
            </Button>

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

            <div className="field">
                <label className="label" htmlFor="word-clue">
                    {t('wordRelated:formComponentLabel.clue')}
                </label>
                <Textarea id="word-clue" value={state.clue} onChange={(e) => state.setClue(e.target.value)} />
            </div>

            <div className="sticky bottom-0 flex flex-col gap-2 border-t border-border bg-background py-3">
                {state.belowMinTranslations && (
                    <p className="hint">{t('wordRelated:wordForm.hints.minTranslations')}</p>
                )}
                <div className="flex gap-2">
                    <Button type="button" disabled={!state.canSave || submitting} onClick={handleSave}>
                        {submitting ? (
                            <>
                                <span className="spinner" />
                                {t('common:status.saving')}
                            </>
                        ) : (
                            t('common:buttons.saveChanges')
                        )}
                    </Button>
                    {mode === 'edit' && onDelete && (
                        <Button type="button" variant="destructive" onClick={onDelete}>
                            {t('common:buttons.delete')}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
