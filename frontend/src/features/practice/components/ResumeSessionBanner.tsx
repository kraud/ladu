import { ClockCounterClockwiseIcon, ListBulletsIcon, PencilSimpleLineIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { sessionCoverage, sessionScore, type Session } from '../session';
import type { CardType } from '../types';
import { FlagGrid } from './FlagGrid';
import { gridItemStyle, gridStyle } from './gridShape';
import { WordTypeGrid } from './WordTypeGrid';

/**
 * Shown on the set-up when an unfinished session was left: what it is (progress, languages,
 * word types — the same three facts as the results header) and a way to resume or drop it.
 */
export function ResumeSessionBanner({
    session,
    onResume,
    onDismiss,
}: {
    session: Session;
    onResume: () => void;
    onDismiss: () => void;
}) {
    const { t } = useTranslation();
    const score = sessionScore(session);
    const { languages, partsOfSpeech } = sessionCoverage(session);
    const cardTypes = [...new Set(session.exercises.map((exercise) => exercise.type))];

    return (
        <section className="banner info flex-col items-stretch gap-3 px-4 py-3.5" role="status">
            <div className="flex flex-wrap items-center gap-2.5">
                <ClockCounterClockwiseIcon aria-hidden size={16} className="shrink-0" />
                <b className="grow">{t('practice:setup.resume.title')}</b>
                <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={onResume}>
                        {t('practice:setup.resume.resume')}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={onDismiss}>
                        {t('practice:setup.resume.dismiss')}
                    </Button>
                </div>
            </div>
            <div className="grid grid-cols-1 gap-y-3 md:grid-cols-3">
                <Stat>
                    <Figure>{t('practice:results.scoreCount', { correct: score.answered, total: score.total })}</Figure>
                    <CardTypeGrid types={cardTypes} className="self-end" />
                    <div className="flex flex-col gap-0.5">
                        <span className="label">{t('practice:setup.resume.answeredLabel')}</span>
                        {score.answered > 0 && (
                            <span className="hint">{t('practice:setup.resume.correctHint', { count: score.correct })}</span>
                        )}
                    </div>
                </Stat>
                <Stat className="md:border-l">
                    <FlagGrid languages={languages} className="self-center" />
                    <Figure>{languages.length}</Figure>
                    <span className="label">{t('practice:results.languagesLabel', { count: languages.length })}</span>
                </Stat>
                <Stat className="md:border-l">
                    <WordTypeGrid partsOfSpeech={partsOfSpeech} className="self-center" />
                    <Figure>{partsOfSpeech.length}</Figure>
                    <span className="label">{t('practice:results.typesLabel', { count: partsOfSpeech.length })}</span>
                </Stat>
            </div>
        </section>
    );
}

/** The answer styles of the session (typed / chosen) in the same column grid as the flags; one or two icons. */
function CardTypeGrid({ types, className }: { types: readonly CardType[]; className?: string }) {
    return (
        <span
            aria-hidden
            data-testid="card-type-grid"
            className={`grid shrink-0 gap-1 ${className ?? ''}`}
            style={gridStyle(types.length)}
        >
            {types.map((type, index) => (
                <span key={type} className="flex" style={gridItemStyle(index, types.length)}>
                    {type === 'Text-Input' ? (
                        <PencilSimpleLineIcon weight="bold" size={16} />
                    ) : (
                        <ListBulletsIcon weight="bold" size={16} />
                    )}
                </span>
            ))}
        </span>
    );
}

function Figure({ children }: { children: ReactNode }) {
    return (
        <span
            className="text-[42px] leading-none font-semibold tracking-tight tabular-nums"
            style={{ fontFamily: 'var(--font-display)' }}
        >
            {children}
        </span>
    );
}

function Stat({ className, children }: { className?: string; children: ReactNode }) {
    return (
        <div
            className={`flex items-end justify-center gap-3 border-current/15 max-md:border-t max-md:pt-3 max-md:first:border-t-0 max-md:first:pt-0 ${className ?? ''}`}
        >
            {children}
        </div>
    );
}
