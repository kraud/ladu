import { useEffect } from 'react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { practiceErrorKey } from '../errors';
import { useDeleteSavedSession, useSaveSession } from '../hooks';
import { MAX_SAVED_SESSIONS, SESSION_TTL_DAYS } from '../savedSessions';
import type { Session } from '../session';
import { usePracticeSessionStore } from '../sessionStore';

/**
 * The way out of a running session (Phase 5.5): save it to continue later, or leave and
 * delete it. Answers already given are saved either way.
 *
 * A failed save keeps the user in the session with the reason shown — the session is never
 * lost silently. A failed delete of the saved copy does not: the user still leaves, and the
 * copy expires by itself.
 */
export function LeaveSessionDialog({
    open,
    onOpenChange,
    session,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    session: Session;
}) {
    const { t } = useTranslation();
    const clear = usePracticeSessionStore((s) => s.clear);
    const save = useSaveSession();
    const deleteSaved = useDeleteSavedSession();

    useEffect(() => {
        if (open) save.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    function saveAndLeave() {
        if (save.isPending) return;
        save.mutate(session, {
            onSuccess: () => {
                toast.success(t('practice:session.leaveDialog.savedToast'));
                clear();
            },
        });
    }

    function leaveAndDelete() {
        if (save.isPending) return;
        if (session.savedId) deleteSaved.mutate(session.savedId);
        clear();
    }

    return (
        <Dialog open={open} onOpenChange={(next) => !save.isPending && onOpenChange(next)}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{t('practice:session.leaveDialog.title')}</DialogTitle>
                    <DialogDescription>{t('practice:session.leaveDialog.body')}</DialogDescription>
                </DialogHeader>

                <p className="hint">
                    {t('practice:session.leaveDialog.limitNote', { max: MAX_SAVED_SESSIONS, days: SESSION_TTL_DAYS })}
                </p>

                {save.isError && (
                    <p className="err show" role="alert">
                        {t(practiceErrorKey(save.error))}
                    </p>
                )}

                {/* Long labels do not wrap inside a button, so the buttons wrap onto a second row instead of leaving the dialog. */}
                <DialogFooter className="sm:flex-wrap">
                    <Button type="button" variant="outline" disabled={save.isPending} onClick={() => onOpenChange(false)}>
                        {t('practice:session.leaveDialog.cancel')}
                    </Button>
                    <Button type="button" variant="destructive" disabled={save.isPending} onClick={leaveAndDelete}>
                        {t('practice:session.leaveDialog.deleteAndLeave')}
                    </Button>
                    <Button type="button" disabled={save.isPending} onClick={saveAndLeave}>
                        {save.isPending
                            ? t('practice:session.leaveDialog.saving')
                            : t('practice:session.leaveDialog.saveAndLeave')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
