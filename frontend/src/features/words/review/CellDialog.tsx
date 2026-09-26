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
 * D41: a cell with an existing translation opens read-only (`TranslationCard
 * displayOnly`) with an Edit button — the common case is "let me look at
 * this", not straight into editing. An empty cell (`isAdd`) skips that step
 * and opens directly in edit mode, with no Edit button since there is
 * nothing to view yet.
 *
 * The title is the word's main case beside the language's flag, with no
 * language name: this language's own main case when viewing/editing, the
 * native-language one (else the first account language the word has) when
 * creating — see `cellTitle.ts`.
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
import { languageByKey } from '@/lib/language';
import { cellDialogHeadword } from './cellTitle';
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
    /** `users.native_language` — picks the title's language when creating a translation (`cellTitle.ts`). */
    nativeLanguage?: string | null;
    /** The account's selected languages, in account order — the title's fallback when creating. */
    userLanguages?: readonly string[];
}

export function CellDialog({ wordId, langKey, onClose, nativeLanguage, userLanguages }: CellDialogProps) {
    const { t } = useTranslation();
    const wordQuery = useWord(wordId);
    const updateWord = useUpdateWord();
    const [draft, setDraft] = useState<TranslationCardChange | null>(null);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [editing, setEditing] = useState(false);
    // Bumped on every mode switch so `TranslationCard` remounts and
    // rehydrates from `initialCases` — it only ever reads that prop at mount
    // (see `TranslationCard.tsx`'s own `useForm` comment), so this is what
    // makes Cancel genuinely discard a typed edit rather than leaving it in
    // the card's RHF state. Same mechanism as `WordPage.tsx`'s `editKey`.
    const [cardKey, setCardKey] = useState(0);

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
    // An add always edits straight away — there's nothing to view yet (D41).
    const isEditing = editing || isAdd;

    // The title is the word alone (the flag beside it names the language): this
    // language's own main case when viewing/editing, the user's native-language
    // one (or the first account language the word has) when creating.
    const title =
        cellDialogHeadword(word.partOfSpeech, word.translations, lang, { isAdd, nativeLanguage, userLanguages }) ||
        t('wordRelated:displayWord.titleSimple');
    // No `useMemo` here (this branch is reached after the loading/error
    // returns above, so an unconditional hook can't live here) — a fresh
    // array on every render is harmless anyway, since `TranslationCard`
    // (remounted via `cardKey` on every mode switch) only reads this prop
    // once, at mount.
    const initialCases = (existing?.cases as WordItem[] | undefined) ?? [];

    function startEdit() {
        setDraft(null);
        setCardKey((key) => key + 1);
        setEditing(true);
    }

    // Only reachable for an existing translation (`isAdd`'s Cancel is
    // `onClose` directly) — remounts the card so a typed-but-unsaved edit is
    // discarded, not merely hidden.
    function cancelEdit() {
        setDraft(null);
        setCardKey((key) => key + 1);
        setEditing(false);
    }

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
                        key={cardKey}
                        lang={lang}
                        pos={word.partOfSpeech}
                        initialCases={initialCases}
                        displayOnly={!isEditing}
                        // The dialog's own title already shows the language: no second header or frame.
                        bare
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
                    {isEditing ? (
                        <>
                            <Button type="button" variant="outline" onClick={isAdd ? onClose : cancelEdit}>
                                {t('common:buttons.cancel')}
                            </Button>
                            <Button
                                type="button"
                                disabled={atMax || !draft?.isDirty || !draft.completionState || updateWord.isPending}
                                onClick={save}
                            >
                                {t('common:buttons.saveChanges')}
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button type="button" variant="outline" onClick={onClose}>
                                {t('common:buttons.close')}
                            </Button>
                            <Button type="button" onClick={startEdit}>
                                {t('common:buttons.edit')}
                            </Button>
                        </>
                    )}
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
