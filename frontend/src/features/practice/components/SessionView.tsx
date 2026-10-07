import { useEffect, useRef, useState } from 'react';
import { ArrowLeftIcon, XIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useDeleteSavedSession } from '../hooks';
import { recoverInterruptedSaves, useSessionActions } from '../useSessionActions';
import { allAnswered, isLastExercise, shortfall, type Session } from '../session';
import { usePracticeSessionStore } from '../sessionStore';
import { ExerciseCard } from './ExerciseCard';
import { ProgressHeader } from './ProgressHeader';

/**
 * Stage 2 (Part C §C.4): one card at a time with previous / next. Navigation is
 * never blocked by a save. After an answer the focus moves to "Next", so Enter
 * goes on; a new open card puts the focus in its answer field.
 */
export function SessionView({ session }: { session: Session }) {
    const { t } = useTranslation();
    const dispatch = usePracticeSessionStore((s) => s.dispatch);
    const setSavedId = usePracticeSessionStore((s) => s.setSavedId);
    const deleteSaved = useDeleteSavedSession();
    const actions = useSessionActions();
    const nextRef = useRef<HTMLButtonElement>(null);
    const [shortfallDismissed, setShortfallDismissed] = useState(false);

    const index = session.current;
    const exercise = session.exercises[index]!;
    const answer = session.answers[index] ?? null;
    const last = isLastExercise(session);
    const canFinish = allAnswered(session);

    /** A finished session has no reason to stay in the saved list. A failed delete is not shown: the copy expires. */
    function finish() {
        dispatch({ type: 'finish' });
        if (session.savedId) {
            deleteSaved.mutate(session.savedId);
            setSavedId(null);
        }
    }

    useEffect(() => {
        recoverInterruptedSaves();
    }, []);

    // Focus "Next" only at the moment this card gets answered, not when an answered card is opened.
    const seen = useRef({ index, answered: answer !== null });
    useEffect(() => {
        const answered = answer !== null;
        if (seen.current.index === index && !seen.current.answered && answered) nextRef.current?.focus();
        seen.current = { index, answered };
    }, [index, answer]);

    return (
        <div className="mx-auto flex w-full max-w-180 flex-col gap-3.5">
            <ProgressHeader session={session} />
            {shortfall(session) > 0 && !shortfallDismissed && (
                <div className="banner warning" role="status">
                    {t('practice:setup.shortfall', { created: session.exercises.length, requested: session.requested })}
                    <button
                        type="button"
                        className="icon-btn ml-auto shrink-0"
                        aria-label={t('common:buttons.close')}
                        onClick={() => setShortfallDismissed(true)}
                    >
                        <XIcon size={16} />
                    </button>
                </div>
            )}

            <ExerciseCard
                key={exercise.key}
                exercise={exercise}
                answer={answer}
                strictness={session.params.strictnessTI}
                onAnswer={(result, given) => actions.answer(index, result, given)}
                onRetry={() => actions.retry(index)}
            />

            {session.returnToResults ? (
                <div className="flex justify-end">
                    <Button type="button" onClick={() => dispatch({ type: 'backToResults' })}>
                        {t('practice:results.backToResults')}
                    </Button>
                </div>
            ) : (
                <nav className="flex flex-wrap items-center justify-between gap-2" aria-label={t('practice:page.title')}>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={index === 0}
                        onClick={() => dispatch({ type: 'goTo', index: index - 1 })}
                    >
                        <ArrowLeftIcon aria-hidden size={15} />
                    {t('practice:session.previous')}
                    </Button>
                    {last ? (
                        <Button
                            ref={nextRef}
                            type="button"
                            disabled={!canFinish}
                            onClick={finish}
                        >
                            {t('practice:session.seeResults')}
                        </Button>
                    ) : (
                        <Button
                            ref={nextRef}
                            type="button"
                            variant={answer ? 'default' : 'outline'}
                            onClick={() => dispatch({ type: 'goTo', index: index + 1 })}
                        >
                            {t('practice:session.next')}
                        </Button>
                    )}
                </nav>
            )}
            {!session.returnToResults && last && !canFinish && <p className="hint text-right">{t('practice:session.answerAll')}</p>}
        </div>
    );
}
