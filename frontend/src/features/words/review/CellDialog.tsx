/**
 * The Review table's cell editor (Slice 8) — clicking a filled or empty cell
 * (`WordCell.tsx`'s `onOpenCell`) opens this dialog with that language's full
 * translation, fed by the existing `useWord` detail query and rendered
 * through the same `TranslationCard` the word-compose/edit forms already use.
 * Save writes the word's COMPLETE translation set with only the edited
 * language changed — the backend deletes by omission (`diffTranslations` in
 * `wordController.ts`), so a partial payload would drop every other stored
 * language. Delete translation is author-only (own words only reach this
 * dialog at all — see `WordCell.tsx`'s `isOwn` guard) and only offered once
 * the word has at least 3 translations, so the result never drops below the
 * create-time minimum of 2.
 *
 * Router- and store-free like every other file in `review/` — every input is
 * a prop, so `renderWithProviders` can mount it with no router context.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { FlagIcon } from '@/components/common/FlagIcon';
import { TranslationCard, type TranslationCardChange } from '../form-engine/TranslationCard';
import { useUpdateWord, useWord } from '../hooks';
import { wordErrorKey } from '../errors';
import { primaryCaseWord } from '@/lib/words';
import { languageByKey } from '@/lib/language';
import { Lang, PartOfSpeech } from '@/ts/enums';
import type { WordItem } from '@/ts/interfaces';
import type { LangKey, TranslationInput } from '../types';
import { resolveLoadingToastError, resolveLoadingToastSuccess, startLoadingToast } from '@/lib/toast';

// Mirrors `useWordFormState.ts`'s own cap — a fifth translation is reachable
// here only when one of the word's four already-stored languages is one the
// account no longer lists (so it can't be seen/edited elsewhere), which is
// an edge case worth guarding rather than a routine limit to surface loudly.
const MAX_TRANSLATIONS = 4;
const MIN_TRANSLATIONS_TO_ALLOW_DELETE = 3;

// A verb's tense-column grid needs more than the dialog's default width; the
// loading skeleton (PoS not fetched yet) and every other part of speech keep
// the narrower one.
function dialogMaxWidthClass(pos?: PartOfSpeech): string {
    return pos === PartOfSpeech.verb ? 'max-w-[960px]' : 'max-w-[640px]';
}

export interface CellDialogProps {
    wordId: string;
    langKey: LangKey;
    onClose: () => void;
}

export function CellDialog({ wordId, langKey, onClose }: CellDialogProps) {
    const { t } = useTranslation();
    const wordQuery = useWord(wordId);
    const updateWord = useUpdateWord();
    const [draft, setDraft] = useState<TranslationCardChange | null>(null);
    const [confirmingDelete, setConfirmingDelete] = useState(false);

    // Same "nothing useful to show inline" reasoning as `WordPage`'s own
    // query-error effect — close and toast rather than growing a dedicated
    // error state for a dialog. A `useEffect`, not an inline call during
    // render, for the same reason `WordPage` uses one.
    useEffect(() => {
        if (!wordQuery.isError) return;
        toast.error(t(wordErrorKey(wordQuery.error)));
        onClose();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wordQuery.isError, wordQuery.error]);

    if (wordQuery.isError) {
        return null;
    }

    if (wordQuery.isPending) {
        return (
            <Dialog open onOpenChange={(open) => !open && onClose()}>
                <DialogContent className={dialogMaxWidthClass()}>
                    <DialogHeader>
                        <Skeleton className="h-5 w-40" />
                    </DialogHeader>
                    <div className="flex flex-col gap-3">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    const word = wordQuery.data;
    // `LangKey` (`'EN'|'ES'|'DE'|'EE'`) and `keyof typeof Lang` are the same
    // literal union, so this reverse-lookup needs no cast — `lang` is a real
    // `Lang` value straight away, not an optional one to narrow later.
    const lang: Lang = Lang[langKey];
    const native = languageByKey(langKey)?.native ?? langKey;

    const existingIndex = word.translations.findIndex((tr) => tr.language === lang);
    const existing = existingIndex >= 0 ? word.translations[existingIndex] : undefined;
    const isAdd = !existing;
    const atMax = isAdd && word.translations.length >= MAX_TRANSLATIONS;
    const canDelete = !isAdd && word.translations.length >= MIN_TRANSLATIONS_TO_ALLOW_DELETE;

    const headline = word.translations[0] ? primaryCaseWord(word.partOfSpeech, word.translations[0]) : '';
    const title = t('review:cellDialog.title', { word: headline || t('wordRelated:displayWord.titleSimple'), language: native });

    function buildTranslations(cases: WordItem[]): TranslationInput[] {
        const next: TranslationInput[] = word.translations.map((tr) => ({
            language: tr.language,
            cases: tr.cases as WordItem[],
        }));
        if (existingIndex >= 0) {
            next[existingIndex] = { language: lang, cases };
        } else {
            next.push({ language: lang, cases });
        }
        return next;
    }

    function save() {
        if (!draft) return;
        const toastId = startLoadingToast(t('common:status.saving'));
        updateWord.mutate(
            {
                id: word.id,
                partOfSpeech: word.partOfSpeech,
                clue: word.clue ?? undefined,
                translations: buildTranslations(draft.cases),
            },
            {
                onSuccess: () => {
                    resolveLoadingToastSuccess(toastId, t('review:cellDialog.savedToast', { language: native }));
                    onClose();
                },
                onError: (error) => {
                    resolveLoadingToastError(toastId, t(wordErrorKey(error)));
                },
            },
        );
    }

    function deleteTranslation() {
        const toastId = startLoadingToast(t('common:status.saving'));
        const next: TranslationInput[] = word.translations
            .filter((tr) => tr.language !== lang)
            .map((tr) => ({ language: tr.language, cases: tr.cases as WordItem[] }));
        updateWord.mutate(
            { id: word.id, partOfSpeech: word.partOfSpeech, clue: word.clue ?? undefined, translations: next },
            {
                onSuccess: () => {
                    resolveLoadingToastSuccess(toastId, t('review:cellDialog.removedToast', { language: native }));
                    onClose();
                },
                onError: (error) => {
                    resolveLoadingToastError(toastId, t(wordErrorKey(error)));
                },
            },
        );
    }

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className={dialogMaxWidthClass(word.partOfSpeech)}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FlagIcon lang={langKey} title={native} />
                        {title}
                    </DialogTitle>
                </DialogHeader>

                {atMax ? (
                    <p className="hint">{t('review:cellDialog.maxTranslations')}</p>
                ) : (
                    <TranslationCard
                        lang={lang}
                        pos={word.partOfSpeech}
                        initialCases={(existing?.cases as WordItem[] | undefined) ?? []}
                        onChange={setDraft}
                    />
                )}

                <DialogFooter>
                    {canDelete && (
                        <Button
                            type="button"
                            variant="destructive"
                            className="mr-auto"
                            onClick={() => setConfirmingDelete(true)}
                        >
                            {t('review:cellDialog.deleteTranslation')}
                        </Button>
                    )}
                    <Button type="button" variant="outline" onClick={onClose}>
                        {t('common:buttons.cancel')}
                    </Button>
                    <Button
                        type="button"
                        disabled={atMax || !draft?.isDirty || !draft.completionState || updateWord.isPending}
                        onClick={save}
                    >
                        {t('common:buttons.saveChanges')}
                    </Button>
                </DialogFooter>
            </DialogContent>

            <ConfirmDialog
                open={confirmingDelete}
                onOpenChange={setConfirmingDelete}
                title={t('review:cellDialog.confirmDeleteTitle', { language: native })}
                description={t('review:cellDialog.confirmDeleteDescription')}
                confirmLabel={t('review:cellDialog.deleteTranslation')}
                onConfirm={() => {
                    setConfirmingDelete(false);
                    deleteTranslation();
                }}
            />
        </Dialog>
    );
}
