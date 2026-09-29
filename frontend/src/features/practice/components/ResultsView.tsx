import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Button, buttonVariants } from '@/components/ui/button';
import { practiceErrorKey } from '../errors';
import { useGenerateExercises } from '../hooks';
import { toGenerateBody } from '../params';
import { sessionScore, unsavedIndexes, type Session } from '../session';
import { usePracticeSessionStore } from '../sessionStore';
import { useSessionActions } from '../useSessionActions';
import { ParametersSummary } from './ParametersSummary';
import { ResultRow } from './ResultRow';

/**
 * Stage 3 (Part C §C.5): score, unsaved warning, one row per exercise, the
 * settings used, and the ways on. "Practice again" makes new exercises with
 * the same settings and words; "Change settings" returns to Stage 1.
 */
export function ResultsView({ session, onChangeSettings }: { session: Session; onChangeSettings: () => void }) {
    const { t } = useTranslation();
    const dispatch = usePracticeSessionStore((s) => s.dispatch);
    const startSession = usePracticeSessionStore((s) => s.start);
    const actions = useSessionActions();
    const generate = useGenerateExercises();

    const score = sessionScore(session);
    const unsaved = unsavedIndexes(session).length;

    function again() {
        if (generate.isPending) return;
        generate.mutate(toGenerateBody(session.params, session.wordIds ?? undefined), {
            onSuccess: ({ exercises }) => {
                if (exercises.length === 0) return;
                startSession({
                    userId: session.userId,
                    params: session.params,
                    wordIds: session.wordIds,
                    preselected: session.preselected,
                    exercises,
                });
            },
        });
    }

    return (
        <div className="flex max-w-2xl flex-col gap-4">
            <h1 className="h1">{t('practice:results.title')}</h1>

            <section className="card card-pad flex flex-col gap-1" aria-label={t('practice:results.title')}>
                <p className="text-2xl font-semibold" data-testid="score">
                    {t('practice:results.score', { correct: score.correct, total: score.total })}
                </p>
                <p className="text-sm text-muted-foreground">
                    {t('practice:results.percent', { percent: score.percent })}
                    {score.partial > 0 && <> · {t('practice:results.almost', { count: score.partial })}</>}
                </p>
            </section>

            {unsaved > 0 && (
                <div className="banner warning items-start" role="status">
                    <span className="grow">{t('practice:results.unsaved', { count: unsaved })}</span>
                    <Button type="button" variant="outline" size="sm" onClick={actions.retryAll}>
                        {t('practice:results.retryAll')}
                    </Button>
                </div>
            )}

            <ol className="flex flex-col gap-2">
                {session.exercises.map((exercise, index) => {
                    const answer = session.answers[index];
                    if (!answer) return null;
                    return (
                        <ResultRow
                            key={exercise.key}
                            exercise={exercise}
                            answer={answer}
                            onOpen={() => dispatch({ type: 'openFromResults', index })}
                            onRetry={() => actions.retry(index)}
                        />
                    );
                })}
            </ol>

            <ParametersSummary session={session} />

            {generate.isError && (
                <div className="banner warning items-start" role="alert">
                    <span className="grow">
                        <b>{t('practice:setup.error.title')}</b>
                        <br />
                        {t(practiceErrorKey(generate.error))}
                    </span>
                </div>
            )}
            {generate.isSuccess && generate.data.exercises.length === 0 && (
                <div className="banner warning items-start" role="status">
                    <b>{t('practice:setup.noMatch.title')}</b>
                </div>
            )}

            <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={generate.isPending} onClick={again}>
                    {generate.isPending ? t('practice:setup.starting') : t('practice:results.again')}
                </Button>
                <Button type="button" variant="outline" onClick={onChangeSettings}>
                    {t('practice:results.change')}
                </Button>
                <Link to="/review" className={buttonVariants({ variant: 'outline' })}>
                    {t('practice:results.toReview')}
                </Link>
            </div>
        </div>
    );
}
