import { useTranslation } from 'react-i18next';
import type { GivenAnswer } from '../session';
import type { AnswerResult } from '../types';
import { ResultIcon } from './ResultIcon';

const TONE: Record<AnswerResult, { background: string; ink: string }> = {
    correct: { background: 'var(--success-soft)', ink: 'color-mix(in oklch, var(--success) 82%, var(--fg))' },
    partial: { background: 'var(--warning-soft)', ink: 'color-mix(in oklch, var(--warning) 82%, var(--fg))' },
    wrong: { background: 'var(--danger-soft)', ink: 'color-mix(in oklch, var(--danger) 82%, var(--fg))' },
};

/**
 * The result of the answer.
 *  - Typed card: a tile with the icon and the bold result, and — when the answer
 *    was not exactly right — the expected form underneath. What the user typed is
 *    still visible in the locked field. The area keeps its height, so the card
 *    does not jump when the tile appears.
 *  - Choice card: the options already show right and wrong, so there is no tile;
 *    the result is only announced to screen readers.
 * The region is always in the page and polite, so the result is announced.
 */
export function AnswerFeedback({
    answer,
    expected,
    isTyped,
}: {
    answer: GivenAnswer | null;
    expected: string;
    isTyped: boolean;
}) {
    const { t } = useTranslation();

    if (!isTyped) {
        return (
            <div role="status" aria-live="polite" className="sr-only">
                {answer && t(`practice:feedback.${answer.result}`)}
            </div>
        );
    }

    if (!answer) return <div role="status" aria-live="polite" className="min-h-11" />;

    const { result } = answer;
    return (
        <div role="status" aria-live="polite" className="min-h-11">
            <div
                className="flex flex-col gap-1 rounded-md px-3 py-2.5 text-sm"
                style={{ background: TONE[result].background }}
            >
                <b className="flex items-center gap-2 text-sm" style={{ color: TONE[result].ink }}>
                    <ResultIcon result={result} size={18} />
                    {t(`practice:feedback.${result}`)}
                </b>
                {result === 'partial' && <span>{t('practice:feedback.partialHint')}</span>}
                {result !== 'correct' && <span>{t('practice:feedback.expected', { answer: expected })}</span>}
            </div>
        </div>
    );
}
