import { ClockCounterClockwiseIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { sessionCoverage, sessionScore, type Session } from '../session';
import { SetupFacts } from './SetupFacts';

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
            <SetupFacts
                figure={t('practice:results.scoreCount', { correct: score.answered, total: score.total })}
                hint={score.answered > 0 ? t('practice:setup.resume.correctHint', { count: score.correct }) : undefined}
                cardTypes={cardTypes}
                languages={languages}
                partsOfSpeech={partsOfSpeech}
            />
        </section>
    );
}
