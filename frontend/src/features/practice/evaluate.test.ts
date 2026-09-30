import { describe, expect, it } from 'vitest';
import { evaluateChoice, evaluateTextInput, isCorrect } from './evaluate';

describe('evaluateTextInput (A.7)', () => {
    it('exact match is correct at every strictness', () => {
        for (const level of [1, 2, 3] as const) {
            expect(evaluateTextInput('Haus', 'Haus', level)).toBe('correct');
        }
    });

    it('trims both sides before comparing', () => {
        expect(evaluateTextInput('  Haus  ', 'Haus', 3)).toBe('correct');
        expect(evaluateTextInput('Haus', ' Haus\n', 3)).toBe('correct');
    });

    describe('strictness 1 — ignores accents and capitals', () => {
        it('capitals only differ -> partial', () => {
            expect(evaluateTextInput('haus', 'Haus', 1)).toBe('partial');
        });
        it('accents only differ -> partial', () => {
            expect(evaluateTextInput('cafe', 'café', 1)).toBe('partial');
            expect(evaluateTextInput('CAFÉ', 'cafe', 1)).toBe('partial');
        });
        it('strips Estonian and German marks (NFD)', () => {
            expect(evaluateTextInput('oun', 'õun', 1)).toBe('partial');
            expect(evaluateTextInput('Mutter', 'Mütter', 1)).toBe('partial');
        });
        it('a different word is wrong', () => {
            expect(evaluateTextInput('casa', 'cosa', 1)).toBe('wrong');
        });
    });

    describe('strictness 2 — ignores capitals only', () => {
        it('capitals only differ -> partial', () => {
            expect(evaluateTextInput('haus', 'Haus', 2)).toBe('partial');
        });
        it('accents differ -> wrong', () => {
            expect(evaluateTextInput('cafe', 'café', 2)).toBe('wrong');
        });
    });

    describe('strictness 3 — exact only', () => {
        it('capitals differ -> wrong', () => {
            expect(evaluateTextInput('haus', 'Haus', 3)).toBe('wrong');
        });
        it('accents differ -> wrong', () => {
            expect(evaluateTextInput('cafe', 'café', 3)).toBe('wrong');
        });
    });

    it('an empty answer is wrong', () => {
        expect(evaluateTextInput('', 'Haus', 1)).toBe('wrong');
        expect(evaluateTextInput('   ', 'Haus', 1)).toBe('wrong');
    });
});

describe('evaluateChoice', () => {
    it('compares without case and never returns partial', () => {
        expect(evaluateChoice('Der', 'der')).toBe('correct');
        expect(evaluateChoice('die', 'der')).toBe('wrong');
        expect(evaluateChoice('cafe', 'café')).toBe('wrong');
    });
});

describe('isCorrect', () => {
    it('counts partial as correct', () => {
        expect(isCorrect('correct')).toBe(true);
        expect(isCorrect('partial')).toBe(true);
        expect(isCorrect('wrong')).toBe(false);
    });
});
