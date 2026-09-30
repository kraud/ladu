import { useState } from 'react';
import { TrashIcon } from '@phosphor-icons/react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { htmlLangByI18nCode } from '@/lib/language';
import { partOfSpeechLabelKey } from '@/lib/words';
import { useAuthStore } from '@/stores/authStore';
import { getApiErrorCode, practiceErrorKey } from '../errors';
import { useDeleteSavedSession, useLoadSavedSession, useSavedSessions } from '../hooks';
import { fromSavedSession, MAX_SAVED_SESSIONS, SESSION_TTL_DAYS } from '../savedSessions';
import { usePracticeSessionStore } from '../sessionStore';
import type { SavedSessionItem } from '../types';
import { FlagGrid } from './FlagGrid';

/**
 * The user's saved sessions, under the saved configurations. One tap on a row resumes it: the
 * session opens where it was left, and stays linked to its saved copy (saving again updates it).
 * A session that is running or parked in this tab would be lost by that, so it asks first.
 * Delete asks first too. A saved session that the server no longer has (expired, replaced,
 * deleted elsewhere) says so and the list refreshes.
 */
export function SavedSessions({
    hasUnfinished,
    onResumed,
}: {
    /** A session is parked in this tab: resuming a saved one replaces it. */
    hasUnfinished: boolean;
    /** After the saved session was opened: the page drops what it held for the set-up. */
    onResumed: () => void;
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

    const title = t('practice:sessions.title');
    const dateFormat = new Intl.DateTimeFormat(htmlLangByI18nCode(i18n.language), { dateStyle: 'medium' });

    return (
        <section className="card card-pad flex flex-col gap-2" aria-label={title}>
            <b>{title}</b>
            <p className="hint">{t('practice:sessions.note', { max: MAX_SAVED_SESSIONS, days: SESSION_TTL_DAYS })}</p>

            {sessions.isPending && <p className="hint">{t('practice:sessions.loading')}</p>}

            {sessions.isError && (
                <div className="banner warning items-start" role="alert">
                    <span className="grow">{t('practice:sessions.listError')}</span>
                    <Button type="button" variant="outline" size="sm" onClick={() => void sessions.refetch()}>
                        {t('practice:setup.error.retry')}
                    </Button>
                </div>
            )}

            {sessions.isSuccess && sessions.data.length === 0 && <p className="hint">{t('practice:sessions.empty')}</p>}

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
                <ul className="flex flex-col">
                    {sessions.data.map((item) => {
                        const { summary } = item;
                        return (
                            <li key={item.id} className="flex items-center gap-2 border-b border-border py-2 last:border-b-0">
                                <button
                                    type="button"
                                    className="flex min-w-0 grow cursor-pointer flex-col gap-0.5 text-left"
                                    aria-label={t('practice:sessions.resumeAria', {
                                        answered: summary.answered,
                                        total: summary.total,
                                    })}
                                    disabled={loadingId !== null}
                                    aria-busy={loadingId === item.id || undefined}
                                    onClick={() => (hasUnfinished ? setReplacing(item) : open(item))}
                                >
                                    <span className="font-medium">
                                        {t('practice:sessions.progress', { answered: summary.answered, total: summary.total })}
                                        {summary.answered > 0 && (
                                            <span className="hint">
                                                {' · '}
                                                {t('practice:sessions.correct', { count: summary.correct })}
                                            </span>
                                        )}
                                    </span>
                                    <span className="meta flex flex-wrap items-center gap-x-2 gap-y-1">
                                        <FlagGrid languages={summary.languages} />
                                        <span>{summary.partsOfSpeech.map((pos) => t(partOfSpeechLabelKey(pos))).join(', ')}</span>
                                        <span>
                                            {t('practice:sessions.expires', {
                                                date: dateFormat.format(new Date(item.expiresAt)),
                                            })}
                                        </span>
                                    </span>
                                </button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
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
        </section>
    );
}
