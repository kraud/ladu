import { useMemo, useState, type ReactNode } from 'react';
import { ClockCounterClockwiseIcon, TrashIcon } from '@phosphor-icons/react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/common/EmptyState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { htmlLangByI18nCode } from '@/lib/language';
import { useAuthStore } from '@/stores/authStore';
import { getApiErrorCode, practiceErrorKey } from '../errors';
import { useDeleteSavedSession, useLoadSavedSession, useSavedSessions } from '../hooks';
import { fromSavedSession, MAX_SAVED_SESSIONS } from '../savedSessions';
import { usePracticeSessionStore } from '../sessionStore';
import type { SavedSessionItem } from '../types';
import { ListToolbar } from './ListToolbar';
import { SetupFacts } from './SetupFacts';

type SessionSort = 'recent' | 'oldest';

/**
 * The user's saved sessions: the "Ongoing sessions" list on the set-up screen. One tap on a row resumes it: the
 * session opens where it was left, and stays linked to its saved copy (saving again updates it).
 * A session that is running or parked in this tab would be lost by that, so it asks first.
 * Delete asks first too. A saved session that the server no longer has (expired, replaced,
 * deleted elsewhere) says so and the list refreshes.
 */
export function SavedSessions({
    hasUnfinished,
    onResumed,
    rail,
    onNew,
}: {
    /** A session is parked in this tab: resuming a saved one replaces it. */
    hasUnfinished: boolean;
    /** After the saved session was opened: the page drops what it held for the set-up. */
    onResumed: () => void;
    /** The scope badges of the set-up (they sit in the toolbar of this list). */
    rail: ReactNode;
    /** Open the New configuration view (the call to action of the empty list). */
    onNew: () => void;
}) {
    const { t, i18n } = useTranslation();
    const user = useAuthStore((s) => s.user);
    const loadSession = usePracticeSessionStore((s) => s.load);
    const sessions = useSavedSessions();
    const download = useLoadSavedSession();
    const deleteSaved = useDeleteSavedSession();
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const [replacing, setReplacing] = useState<SavedSessionItem | null>(null);
    const [deleting, setDeleting] = useState<SavedSessionItem | null>(null);
    const [gone, setGone] = useState(false);
    const [sort, setSort] = useState<SessionSort>('recent');
    const items = useMemo(() => {
        const list = [...(sessions.data ?? [])];
        return sort === 'recent'
            ? list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            : list.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
    }, [sessions.data, sort]);

    function open(item: SavedSessionItem) {
        if (loadingId || !user) return;
        setGone(false);
        setLoadingId(item.id);
        download.mutate(item.id, {
            onSuccess: (saved) => {
                const session = fromSavedSession(saved, user.id);
                if (!session) {
                    setGone(true);
                    return;
                }
                loadSession(session);
                onResumed();
            },
            onError: (error) => {
                if (getApiErrorCode(error) === 'not_found') {
                    setGone(true);
                    void sessions.refetch();
                }
            },
            onSettled: () => setLoadingId(null),
        });
    }

    function confirmDelete() {
        if (!deleting) return;
        deleteSaved.mutate(deleting.id, { onSuccess: () => toast.success(t('practice:sessions.toast.deleted')) });
        setDeleting(null);
    }

    const dateFormat = new Intl.DateTimeFormat(htmlLangByI18nCode(i18n.language), { dateStyle: 'medium' });

    return (
        <div className="flex flex-col gap-2">
            <ListToolbar
                rail={rail}
                count={sessions.isSuccess ? t('practice:sessions.count', { count: items.length, max: MAX_SAVED_SESSIONS }) : null}
                sort={sort}
                sortOptions={[
                    { value: 'recent', label: t('practice:sessions.sort.recent') },
                    { value: 'oldest', label: t('practice:sessions.sort.oldest') },
                ]}
                onSortChange={setSort}
            />

            {sessions.isPending && <p className="hint">{t('practice:sessions.loading')}</p>}

            {sessions.isError && (
                <div className="banner warning items-start" role="alert">
                    <span className="grow">{t('practice:sessions.listError')}</span>
                    <Button type="button" variant="outline" size="sm" onClick={() => void sessions.refetch()}>
                        {t('practice:setup.error.retry')}
                    </Button>
                </div>
            )}

            {sessions.isSuccess && sessions.data.length === 0 && (
                <div className="card">
                    <EmptyState
                        icon={<ClockCounterClockwiseIcon aria-hidden size={20} />}
                        title={t('practice:sessions.empty')}
                        action={
                            <Button size="sm" onClick={onNew}>
                                {t('practice:sessions.emptyCta')}
                            </Button>
                        }
                    />
                </div>
            )}

            {gone && (
                <p className="err show" role="alert">
                    {t('practice:sessions.gone')}
                </p>
            )}
            {download.isError && !gone && (
                <p className="err show" role="alert">
                    {t(practiceErrorKey(download.error))}
                </p>
            )}
            {deleteSaved.isError && (
                <p className="err show" role="alert">
                    {t(practiceErrorKey(deleteSaved.error))}
                </p>
            )}

            {sessions.isSuccess && sessions.data.length > 0 && (
                <ul className="flex flex-col gap-2">
                    {items.map((item) => {
                        const { summary } = item;
                        return (
                            <li key={item.id} className="relative">
                                <button
                                    type="button"
                                    className="flex w-full cursor-pointer flex-col gap-3 rounded-(--radius) border border-border bg-card px-4 py-3.5 text-left transition-colors hover:border-(--accent) hover:bg-(--accent-soft) focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-(--accent-soft) disabled:cursor-wait disabled:opacity-60"
                                    aria-label={t('practice:sessions.resumeAria', {
                                        answered: summary.answered,
                                        total: summary.total,
                                    })}
                                    disabled={loadingId !== null}
                                    aria-busy={loadingId === item.id || undefined}
                                    onClick={() => (hasUnfinished ? setReplacing(item) : open(item))}
                                >
                                    <span className="meta flex items-center gap-2 pr-9">
                                        <ClockCounterClockwiseIcon aria-hidden size={15} className="shrink-0" />
                                        {t('practice:sessions.expires', { date: dateFormat.format(new Date(item.expiresAt)) })}
                                    </span>
                                    <SetupFacts
                                        figure={t('practice:results.scoreCount', {
                                            correct: summary.answered,
                                            total: summary.total,
                                        })}
                                        hint={
                                            summary.answered > 0
                                                ? t('practice:setup.resume.correctHint', { count: summary.correct })
                                                : undefined
                                        }
                                        cardTypes={summary.cardTypes}
                                        languages={summary.languages}
                                        partsOfSpeech={summary.partsOfSpeech}
                                    />
                                </button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    className="absolute top-2 right-2"
                                    aria-label={t('practice:sessions.deleteAria', {
                                        answered: summary.answered,
                                        total: summary.total,
                                    })}
                                    onClick={() => setDeleting(item)}
                                >
                                    <TrashIcon aria-hidden size={16} />
                                </Button>
                            </li>
                        );
                    })}
                </ul>
            )}

            <ConfirmDialog
                open={replacing !== null}
                onOpenChange={(next) => !next && setReplacing(null)}
                title={t('practice:sessions.replaceDialog.title')}
                description={t('practice:sessions.replaceDialog.body')}
                confirmLabel={t('practice:sessions.replaceDialog.confirm')}
                cancelLabel={t('practice:sessions.replaceDialog.cancel')}
                destructive={false}
                onConfirm={() => {
                    if (replacing) open(replacing);
                    setReplacing(null);
                }}
            />
            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(next) => !next && setDeleting(null)}
                title={t('practice:sessions.deleteDialog.title')}
                description={t('practice:sessions.deleteDialog.body')}
                confirmLabel={t('practice:sessions.deleteDialog.confirm')}
                onConfirm={confirmDelete}
            />
        </div>
    );
}
