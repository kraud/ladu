import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { sessionScore, shortfall, type Session } from '../session';

/**
 * Always-visible progress (Part C §C.4): position, answered, correct, the
 * shortfall note, and a confirmed way out. Answers already given stay saved.
 */
export function ProgressHeader({ session, onLeave }: { session: Session; onLeave: () => void }) {
    const { t } = useTranslation();
    const [confirming, setConfirming] = useState(false);
    const score = sessionScore(session);
    const missing = shortfall(session);

    return (
        <header className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h1 className="h1">
                    {t('practice:session.progress', { current: session.current + 1, total: session.exercises.length })}
                </h1>
                <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(true)}>
                    {t('practice:session.leave')}
                </Button>
            </div>
            <p className="text-sm text-muted-foreground">
                {t('practice:session.answered', { count: score.answered })} ·{' '}
                {t('practice:session.correct', { count: score.correct })}
            </p>
            {missing > 0 && (
                <p className="hint">
                    {t('practice:setup.shortfall', { created: session.exercises.length, requested: session.requested })}
                </p>
            )}
            <ConfirmDialog
                open={confirming}
                onOpenChange={setConfirming}
                title={t('practice:session.leaveDialog.title')}
                description={t('practice:session.leaveDialog.body')}
                confirmLabel={t('practice:session.leaveDialog.confirm')}
                cancelLabel={t('practice:session.leaveDialog.cancel')}
                destructive={false}
                onConfirm={onLeave}
            />
        </header>
    );
}
