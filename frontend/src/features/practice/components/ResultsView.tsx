import { ArrowCounterClockwiseIcon, ArrowLeftIcon, WarningIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { practiceErrorKey } from '../errors';
import { useGenerateExercises } from '../hooks';
import { toGenerateBody } from '../params';
import { sessionCoverage, sessionScore, unsavedIndexes, type Session } from '../session';
import { usePracticeSessionStore } from '../sessionStore';
import { useSessionActions } from '../useSessionActions';
import { FlagGrid } from './FlagGrid';
import { NoMatchNotice } from './NoMatchNotice';
import { ParametersSummary } from './ParametersSummary';
import { ResultRow } from './ResultRow';
import { Pill } from './SetupFacts';
import { WordTypeGrid } from './WordTypeGrid';

/**
 * Stage 3 (Part C §C.5, mockup `#stage-results`): score, unsaved warning, one row
 * per exercise, the settings used, and the ways on. "Practice again" makes new
 * exercises with the same settings and words; "Finish" returns to Stage 1 (the
 * lists of sessions and configurations) and the back arrow returns to it with
 * the settings of this session. If "Practice again" finds nothing, the explanation
 * shows here, with a way to the settings.
 */
export function ResultsView({
    session,
    onChangeSettings,
    onFinish,
}: {
    session: Session;
    onChangeSettings: () => void;
    onFinish: () => void;
}) {
    const { t } = useTranslation();
    const dispatch = usePracticeSessionStore((s) => s.dispatch);
    const startSession = usePracticeSessionStore((s) => s.start);
    const actions = useSessionActions();
    const generate = useGenerateExercises();

    const score = sessionScore(session);
    const { languages, partsOfSpeech } = sessionCoverage(session);
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
        <div className="flex w-full flex-col gap-3">
            <div className="flex items-center gap-2.5">
                <button
                    type="button"
                    className="icon-btn"
                    aria-label={t('practice:results.backToSetup')}
                    onClick={onChangeSettings}
                >
                    <ArrowLeftIcon aria-hidden size={17} />
                </button>
                <h1 className="h1">{t('practice:results.title')}</h1>
            </div>

            <section
                className="card grid grid-cols-2 gap-y-3 px-4 py-4 md:grid-cols-4 md:gap-y-4 md:px-5.5 md:py-5"
                aria-label={t('practice:results.title')}
            >
                <HeaderStat className="max-md:col-span-2">
                    <BigNumber data-testid="score">
                        {t('practice:results.scoreCount', { correct: score.correct, total: score.total })}
                    </BigNumber>
                    <div className="flex flex-col gap-0.5">
                        <span className="label">{t('practice:results.correctAnswers')}</span>
                        {score.partial > 0 && (
                            <span className="hint">{t('practice:results.almostHint', { count: score.partial })}</span>
                        )}
                    </div>
                </HeaderStat>

                <HeaderStat className="max-md:border-t max-md:pt-3 md:border-l">
                    <FlagGrid languages={languages} className="self-center" />
                    <BigNumber data-testid="languages-count">{languages.length}</BigNumber>
                    <span className="label">{t('practice:results.languagesLabel', { count: languages.length })}</span>
                </HeaderStat>

                <HeaderStat className="max-md:border-t max-md:border-l max-md:pt-3 md:border-l">
                    <WordTypeGrid partsOfSpeech={partsOfSpeech} className="self-center" />
                    <BigNumber data-testid="types-count">{partsOfSpeech.length}</BigNumber>
                    <span className="label">{t('practice:results.typesLabel', { count: partsOfSpeech.length })}</span>
                </HeaderStat>

                <HeaderStat className="max-md:col-span-2 max-md:border-t max-md:pt-3 md:border-l">
                    <span className="flex flex-row flex-wrap justify-center gap-1.5 md:flex-col md:items-start">
                        <Pill>
                            {(session.wordIds?.length ?? 0) > 0
                                ? t('practice:configs.summary.selectedWords', { count: session.wordIds?.length ?? 0 })
                                : t('practice:configs.summary.allWords')}
                        </Pill>
                        <Pill>
                            {session.params.wordSelection === 'Random'
                                ? t('practice:configs.summary.randomOrder')
                                : t('practice:configs.summary.weakerFirst')}
                        </Pill>
                    </span>
                </HeaderStat>
            </section>

            {unsaved > 0 && (
                <div className="banner warning" role="status">
                    <WarningIcon aria-hidden weight="bold" size={15} className="shrink-0" />
                    <span className="grow">{t('practice:results.unsaved', { count: unsaved })}</span>
                    <Button type="button" variant="outline" size="sm" onClick={actions.retryAll}>
                        {t('practice:results.retryAll')}
                    </Button>
                </div>
            )}

            <ol className="card flex flex-col px-4 py-1.5">
                {session.exercises.map((exercise, index) => {
                    const answer = session.answers[index];
                    if (!answer) return null;
                    return (
                        <ResultRow
                            key={exercise.key}
                            exercise={exercise}
                            answer={answer}
                            onOpen={() => dispatch({ type: 'openFromResults', index })}
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
                <NoMatchNotice onAdjust={onChangeSettings} />
            )}

            <div className="mt-1 flex flex-wrap items-center gap-2.5">
                <Button type="button" disabled={generate.isPending} onClick={again}>
                    {generate.isPending ? (
                        t('practice:setup.starting')
                    ) : (
                        <>
                            <ArrowCounterClockwiseIcon aria-hidden size={15} />
                            {t('practice:results.again')}
                        </>
                    )}
                </Button>
                <Button type="button" variant="outline" onClick={onFinish}>
                    {t('practice:results.finish')}
                </Button>
            </div>
        </div>
    );
}

/** A large figure in the display font (the score, the language count, the type count). */
function BigNumber({ children, ...props }: { children: ReactNode; 'data-testid'?: string }) {
    return (
        <span
            className="text-[28px] leading-none font-semibold tracking-tight tabular-nums md:text-[42px]"
            style={{ fontFamily: 'var(--font-display)' }}
            {...props}
        >
            {children}
        </span>
    );
}

/**
 * One block of the results header: it fills a share of the card and centres its content, so
 * the three blocks are spaced evenly. The figure and its small label sit on the same bottom
 * edge; a flag grid (which can be taller than the figure) stays centred. Dividers on wide screens.
 */
function HeaderStat({ className, children }: { className?: string; children: ReactNode }) {
    return (
        <div
            className={`flex flex-wrap items-end justify-center gap-x-2 gap-y-1 border-border md:gap-x-3 ${className ?? ''}`}
        >
            {children}
        </div>
    );
}
