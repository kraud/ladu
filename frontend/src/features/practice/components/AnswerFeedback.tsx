import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { GivenAnswer } from '../session';

const ICON = { correct: '✓', partial: '≈', wrong: '✕' } as const;

/**
 * What happened to the answer: the result (icon + text, never colour alone), the
 * exact expected form when it differs, and the state of the background save.
 * The region is always in the page and polite, so a screen reader announces the
 * result when it appears.
 */
export function AnswerFeedback({
    answer,
    expected,
    showGiven,
    onRetry,
}: {
    answer: GivenAnswer | null;
    expected: string;
    /** Typed answers show what the user typed; a chosen option is already marked. */
    showGiven: boolean;
    onRetry: () => void;
}) {
    const { t } = useTranslation();
    if (!answer) return <div role="status" aria-live="polite" />;

    const { result, given, saveStatus } = answer;
    return (
        <div role="status" aria-live="polite" className="flex flex-col gap-2">
            <div
                className="flex flex-col gap-1 rounded-md px-3 py-2 text-sm"
                style={{
                    background: result === 'wrong' ? 'var(--danger-soft)' : result === 'partial' ? 'var(--warning-soft)' : 'var(--success-soft)',
                }}
            >
                <b>
                    <span aria-hidden>{ICON[result]} </span>
                    {t(`practice:feedback.${result}`)}
                </b>
                {result === 'partial' && <span>{t('practice:feedback.partialHint')}</span>}
                {result !== 'correct' && <span>{t('practice:feedback.expected', { answer: expected })}</span>}
                {result === 'wrong' && showGiven && <span>{t('practice:feedback.yourAnswer', { answer: given })}</span>}
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {saveStatus === 'saving' && <span>{t('practice:save.saving')}</span>}
                {saveStatus === 'saved' && <span>{t('practice:save.saved')}</span>}
                {saveStatus === 'unsaved' && (
                    <>
                        <span className="font-semibold text-(--danger)">{t('practice:save.notSaved')}</span>
                        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                            {t('practice:save.retry')}
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}
