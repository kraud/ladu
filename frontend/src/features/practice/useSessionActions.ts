/**
 * The session's side effects: give an answer, save it in the background, retry.
 * The reducer (`session.ts`) stays pure; this hook is the only place that
 * talks to the network during a session.
 *
 * A save runs through the store, not through component state, so it finishes
 * even when the user leaves `/practice` while it runs.
 */
import { useCallback } from 'react';
import { useSaveAnswer } from './hooks';
import { unsavedIndexes } from './session';
import { usePracticeSessionStore } from './sessionStore';
import type { AnswerResult } from './types';

/** Exercise keys with a save request running in this page load. */
const inFlight = new Set<string>();

/**
 * A reload cuts a running save off, but the stored answer still says `saving`.
 * Call once when a session view opens: every such answer becomes `unsaved`, so
 * the user sees a retry button instead of a spinner that never ends.
 */
export function recoverInterruptedSaves(): void {
    const { session, dispatch } = usePracticeSessionStore.getState();
    session?.answers.forEach((answer, index) => {
        const exercise = session.exercises[index];
        if (answer?.saveStatus === 'saving' && exercise && !inFlight.has(exercise.key)) {
            dispatch({ type: 'saveFailed', index });
        }
    });
}

export function useSessionActions() {
    const { mutateAsync } = useSaveAnswer();

    const send = useCallback(
        (index: number) => {
            const { session, dispatch } = usePracticeSessionStore.getState();
            const exercise = session?.exercises[index];
            const answer = session?.answers[index];
            if (!exercise || !answer) return;

            /** The session may have been replaced while the request ran: never apply to a different exercise. */
            const stillThere = () =>
                usePracticeSessionStore.getState().session?.exercises[index]?.key === exercise.key;

            inFlight.add(exercise.key);
            mutateAsync({
                translationId: exercise.translationId,
                caseName: exercise.answer.caseName,
                result: answer.result,
            })
                .then((performance) => {
                    if (stillThere()) dispatch({ type: 'saveSucceeded', index, performance });
                })
                .catch(() => {
                    if (stillThere()) dispatch({ type: 'saveFailed', index });
                })
                .finally(() => inFlight.delete(exercise.key));
        },
        [mutateAsync],
    );

    /** One try only: a second call for the same exercise is ignored (no second save). */
    const answer = useCallback(
        (index: number, result: AnswerResult, given: string) => {
            const { session, dispatch } = usePracticeSessionStore.getState();
            if (!session || session.answers[index] !== null) return;
            dispatch({ type: 'answer', index, result, given });
            send(index);
        },
        [send],
    );

    const retry = useCallback(
        (index: number) => {
            const { session, dispatch } = usePracticeSessionStore.getState();
            if (session?.answers[index]?.saveStatus !== 'unsaved') return;
            dispatch({ type: 'saveRetry', index });
            send(index);
        },
        [send],
    );

    /** Retry every answer whose save failed (results screen). */
    const retryAll = useCallback(() => {
        const { session } = usePracticeSessionStore.getState();
        if (session) unsavedIndexes(session).forEach(retry);
    }, [retry]);

    return { answer, retry, retryAll };
}
