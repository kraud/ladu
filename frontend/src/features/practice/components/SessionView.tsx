import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { recoverInterruptedSaves, useSessionActions } from '../useSessionActions';
import { allAnswered, isLastExercise, type Session } from '../session';
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
    const clear = usePracticeSessionStore((s) => s.clear);
    const actions = useSessionActions();
    const nextRef = useRef<HTMLButtonElement>(null);

    const index = session.current;
    const exercise = session.exercises[index]!;
    const answer = session.answers[index] ?? null;
    const last = isLastExercise(session);
    const canFinish = allAnswered(session);

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
        <div className="flex max-w-2xl flex-col gap-4">
            <ProgressHeader session={session} onLeave={clear} />

            <ExerciseCard
                key={exercise.key}
                exercise={exercise}
                answer={answer}
                strictness={session.params.strictnessTI}
                onAnswer={(result, given) => actions.answer(index, result, given)}
                onRetry={() => actions.retry(index)}
            />

            <nav className="flex flex-wrap items-center justify-between gap-2" aria-label={t('practice:page.title')}>
                <Button
                    type="button"
                    variant="outline"
                    disabled={index === 0}
                    onClick={() => dispatch({ type: 'goTo', index: index - 1 })}
                >
                    {t('practice:session.previous')}
                </Button>
                {last ? (
                    <Button
                        ref={nextRef}
                        type="button"
                        disabled={!canFinish}
                        onClick={() => dispatch({ type: 'finish' })}
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
            {last && !canFinish && <p className="hint text-right">{t('practice:session.answerAll')}</p>}
        </div>
    );
}
