/**
 * Answer checking — pure, client-side (C1). Spec: phase-5-practice.md §A.7.
 * `partial` counts as correct for the score and is stored as `record: true`.
 */
import type { AnswerResult, StrictnessTI } from './types';

/** Lowercase, then drop combining marks (NFD): "Café" -> "cafe", "õun" -> "oun". */
function stripAccents(text: string): string {
    return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Typed answer against the expected value. Both sides are trimmed first.
 *  1: exact -> correct; equal without accents and case -> partial
 *  2: exact -> correct; equal without case -> partial
 *  3: exact -> correct
 */
export function evaluateTextInput(typed: string, expected: string, strictness: StrictnessTI): AnswerResult {
    const answer = typed.trim();
    const target = expected.trim();
    if (answer === target) return 'correct';
    if (strictness === 1 && stripAccents(answer) === stripAccents(target)) return 'partial';
    if (strictness === 2 && answer.toLowerCase() === target.toLowerCase()) return 'partial';
    return 'wrong';
}

/** Multiple choice: case-insensitive equality, never partial. */
export function evaluateChoice(chosen: string, expected: string): AnswerResult {
    return chosen.trim().toLowerCase() === expected.trim().toLowerCase() ? 'correct' : 'wrong';
}

export const isCorrect = (result: AnswerResult): boolean => result !== 'wrong';
