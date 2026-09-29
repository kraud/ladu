import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { sessionScore, type Session } from '../session';

/**
 * The session bar (mockup `.sess-bar`): position, answered, correct, a meter
 * and a confirmed way out. It sticks under the app header (52 px). The position
 * is the page's `<h1>`. Answers already given stay saved.
 */
export function ProgressHeader({ session, onLeave }: { session: Session; onLeave: () => void }) {
    const { t } = useTranslation();
    const [confirming, setConfirming] = useState(false);
    const score = sessionScore(session);
    const percent = score.total === 0 ? 0 : Math.round((score.answered / score.total) * 100);

    return (
        <header className="sticky top-13 z-10 flex flex-wrap items-center gap-x-3.5 gap-y-2 rounded-lg border border-border bg-[color-mix(in_oklch,var(--bg)_92%,transparent)] px-3.5 py-2 backdrop-blur-md">
            <h1
                className="text-[17px] font-semibold whitespace-nowrap"
                style={{ fontFamily: 'var(--font-display)' }}
            >
                {t('practice:session.progress', { current: session.current + 1, total: session.exercises.length })}
            </h1>
            <span aria-hidden className="text-(--fg-soft2)">
                ·
            </span>
            <span className="meta [&_b]:font-bold [&_b]:text-foreground">
                <Trans i18nKey="practice:session.answered" count={score.answered} components={{ b: <b /> }} />
            </span>
            <span aria-hidden className="text-(--fg-soft2)">
                ·
            </span>
            <span className="meta [&_b]:font-bold [&_b]:text-foreground">
                <Trans i18nKey="practice:session.correct" count={score.correct} components={{ b: <b /> }} />
            </span>
            <span
                aria-hidden
                data-testid="meter"
                className="h-1 min-w-20 flex-[1_1_120px] overflow-hidden rounded-sm bg-(--fg-soft2)"
            >
                <span
                    className="block h-full rounded-sm bg-(--accent) transition-[width] duration-200"
                    style={{ width: `${percent}%` }}
                />
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(true)}>
                {t('practice:session.leave')}
            </Button>
            <ConfirmDialog
                open={confirming}
                onOpenChange={setConfirming}
                title={t('practice:session.leaveDialog.title')}
                description={t('practice:session.leaveDialog.body')}
                confirmLabel={t('practice:session.leaveDialog.confirm')}
                cancelLabel={t('practice:session.leaveDialog.cancel')}
                onConfirm={onLeave}
            />
        </header>
    );
}
