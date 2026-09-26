/**
 * View / edit / delete for a single word (`/word/$wordId`).
 *
 * `WordForm` has no read-only rendering mode of its own (Phase 2 Slice 4
 * outcome — it always renders the full editable grid). Rather than widen that
 * orchestrator's scope with a `displayOnly` prop, this page owns its two
 * render states directly: a read-only View built from `TranslationCard
 * displayOnly` (the same contract Slice 3 built for exactly this), and an
 * Edit state that mounts `WordForm mode="edit"` unchanged. Cancel just
 * unmounts the form — there is nothing to restore, since the read-only view
 * beneath it already reflects the persisted word.
 *
 * Both states share `WordEditorLayout` (clue/tags sidebar + sticky bottom
 * bar) — the view state passes Return/Delete + Edit as its bar actions,
 * while the edit state's bar is `WordForm`'s own, with Cancel injected via
 * `extraActions` — so toggling Edit never reshuffles the page.
 *
 * No non-owner branch: `GET /api/words/:id` already 403s a non-owner fetch
 * (decision D3), so a successful load here is always the caller's own word.
 */
import { useEffect, useState } from 'react';
import { getRouteApi, useCanGoBack, useNavigate, useRouter } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { ArrowLeftIcon, PencilSimpleIcon, TrashIcon, XIcon } from '@phosphor-icons/react';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { SidebarFields } from '../layout/SidebarFields';
import type { EditorAction } from '../layout/WordEditorBar';
import { WordEditorLayout } from '../layout/WordEditorLayout';
import { TranslationCard, translationGridClass } from '../form-engine/TranslationCard';
import { WordForm } from '../form-engine/WordForm';
import { useDeleteWord, useUpdateWord, useWord } from '../hooks';
import { wordErrorKey } from '../errors';
import type { CreateWordBody, UpdateWordBody } from '../types';
import type { WordItem } from '@/ts/interfaces';
import { partOfSpeechLabelKey, primaryCaseWord } from '@/lib/words';
import { resolveLoadingToastError, resolveLoadingToastSuccess, startLoadingToast } from '@/lib/toast';

const route = getRouteApi('/_protected/word/$wordId');

export function WordPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const router = useRouter();
    const { wordId } = route.useParams();

    const wordQuery = useWord(wordId);
    const updateWord = useUpdateWord();
    const deleteWord = useDeleteWord();
    const canGoBack = useCanGoBack();

    const [editing, setEditing] = useState(false);
    const [editKey, setEditKey] = useState(0);
    const [confirmingDelete, setConfirmingDelete] = useState(false);

    // A plain `router.history.back()` when there's no client-side history to
    // pop into (a bookmarked/shared `/word/:id` link, or any other direct
    // landing on this route) leaves the SPA runtime entirely — the browser
    // either no-ops or unloads the current document for whatever came before
    // this tab's session, taking the toast with it. `useCanGoBack` tells
    // those two cases apart; falling back to `navigate({ to: '/' })` is a
    // same-document client-side transition, so the toast survives it.
    function goBack() {
        if (canGoBack) router.history.back();
        else void navigate({ to: '/' });
    }

    // D3: the only reachable failures are "not found" and "not the owner" —
    // there is nothing useful to show inline, so bounce back where the user
    // came from rather than growing a dedicated error page for this slice.
    useEffect(() => {
        if (!wordQuery.isError) return;
        toast.error(t(wordErrorKey(wordQuery.error)));
        goBack();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wordQuery.isError, wordQuery.error, t]);

    if (wordQuery.isPending) {
        return (
            <div className="flex flex-col gap-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-64" />
                <div className={translationGridClass()}>
                    <Skeleton className="h-64" />
                    <Skeleton className="h-64" />
                </div>
            </div>
        );
    }

    if (wordQuery.isError) {
        // The effect above is already navigating away.
        return null;
    }

    const word = wordQuery.data;
    const headline = word.translations[0] ? primaryCaseWord(word.partOfSpeech, word.translations[0]) : '';

    function startEdit() {
        setEditKey((key) => key + 1);
        setEditing(true);
    }

    function handleUpdate(body: CreateWordBody | UpdateWordBody) {
        const toastId = startLoadingToast(t('common:status.saving'));
        updateWord.mutate(body as UpdateWordBody, {
            onSuccess: () => {
                resolveLoadingToastSuccess(toastId, t('wordRelated:displayWord.toastUpdateSuccess'));
                setEditing(false);
            },
            onError: (error) => {
                resolveLoadingToastError(toastId, t(wordErrorKey(error)));
            },
        });
    }

    function handleDelete() {
        const toastId = startLoadingToast(t('common:status.saving'));
        deleteWord.mutate(word.id, {
            onSuccess: () => {
                resolveLoadingToastSuccess(toastId, t('common:status.word.deletedSuccess'));
                void navigate({ to: '/' });
            },
            onError: (error) => {
                resolveLoadingToastError(toastId, t(wordErrorKey(error)));
            },
        });
    }

    const posLabel = t(partOfSpeechLabelKey(word.partOfSpeech));

    const viewActions: EditorAction[] = [
        { key: 'return', label: t('common:buttons.return'), icon: <ArrowLeftIcon size={18} />, onClick: goBack },
        {
            key: 'delete',
            label: t('common:buttons.delete'),
            icon: <TrashIcon size={18} />,
            variant: 'destructive',
            onClick: () => setConfirmingDelete(true),
        },
    ];

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
                <p className="meta">{t('wordRelated:displayWord.titlePos', { currentPoS: posLabel })}</p>
                <h1 className="h1">{headline || t('wordRelated:displayWord.titleSimple')}</h1>
                <p className="meta">{t('wordRelated:displayWord.subtitle')}</p>
            </div>

            {editing ? (
                <WordForm
                    key={editKey}
                    mode="edit"
                    initialWord={word}
                    onSubmit={handleUpdate}
                    onDelete={() => setConfirmingDelete(true)}
                    submitting={updateWord.isPending}
                    extraActions={[
                        {
                            key: 'cancel',
                            label: t('common:buttons.cancel'),
                            icon: <XIcon size={18} />,
                            onClick: () => setEditing(false),
                        },
                    ]}
                />
            ) : (
                <WordEditorLayout
                    sidebar={<SidebarFields clue={word.clue ?? ''} />}
                    actions={viewActions}
                    primary={{ label: t('common:buttons.edit'), icon: <PencilSimpleIcon size={18} />, onClick: startEdit }}
                >
                    <div className={translationGridClass(word.partOfSpeech)}>
                        {word.translations.map((translation) => (
                            <TranslationCard
                                key={translation.language}
                                lang={translation.language}
                                pos={word.partOfSpeech}
                                // `WordCaseBE.caseName` is `string` over the wire; the backend only
                                // ever persists real case-name strings, so this is a trusted
                                // narrowing (same as `filterTranslationsByUserLanguages`, `lib/words.ts`).
                                initialCases={translation.cases as WordItem[]}
                                displayOnly
                            />
                        ))}
                    </div>
                </WordEditorLayout>
            )}

            <ConfirmDialog
                open={confirmingDelete}
                onOpenChange={setConfirmingDelete}
                title={t('common:buttons.confirmDelete', { elementType: posLabel })}
                confirmLabel={t('common:buttons.delete')}
                onConfirm={() => {
                    setConfirmingDelete(false);
                    handleDelete();
                }}
            />
        </div>
    );
}
