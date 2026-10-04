import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { Lang, PartOfSpeech } from '@/ts/enums';
import type { PreselectedWord } from '../preselection';
import type { PracticeParams } from '../types';
import { PreselectedWords, type WordsMode } from './PreselectedWords';

const house: PreselectedWord = { id: 'w1', partOfSpeech: PartOfSpeech.noun, label: 'house', languages: ['EN', 'DE'] };
const run: PreselectedWord = { id: 'w2', partOfSpeech: PartOfSpeech.verb, label: 'run', languages: ['EN', 'ES'] };

type Params = Pick<PracticeParams, 'languages' | 'partsOfSpeech'>;
const all: Params = { languages: [Lang.EN, Lang.ES, Lang.DE], partsOfSpeech: [PartOfSpeech.noun, PartOfSpeech.verb] };

function Harness({ params, initial = 'visible' as WordsMode, onClear }: { params: Params; initial?: WordsMode; onClear?: () => void }) {
    const [mode, setMode] = useState<WordsMode>(initial);
    return <PreselectedWords words={[house, run]} params={params} mode={mode} onModeChange={setMode} onClear={onClear} />;
}

const flags = (row: HTMLElement) => Array.from(row.querySelectorAll('img'));
const rowOf = (label: string) => screen.getByText(label).closest('li') as HTMLElement;

describe('PreselectedWords', () => {
    it('lays every row out as flags | word | type, in the same three columns', () => {
        renderWithProviders(<Harness params={all} />);
        for (const label of ['house', 'run']) {
            const row = rowOf(label);
            expect(row).toHaveClass('grid');
            expect(row.className).toMatch(/grid-cols-\[4\.75rem_minmax\(0,1fr\)_auto\]/);
            const [flagCell, wordCell, typeCell] = Array.from(row.children);
            expect(flagCell!.querySelectorAll('img').length).toBeGreaterThan(0);
            expect(wordCell).toHaveTextContent(label);
            expect(typeCell).toHaveClass('text-right');
        }
    });

    it('has no hide-words button, and says how many words the settings use', () => {
        renderWithProviders(<Harness params={{ ...all, partsOfSpeech: [PartOfSpeech.noun] }} />);
        expect(screen.queryByRole('button', { name: /Hide words|Show words/ })).not.toBeInTheDocument();
        expect(screen.getByText('1 of 2 words will be used with these settings.')).toBeInTheDocument();
    });

    describe('eye (visible)', () => {
        it('shows every word; a word that is not used is gray with a line through it', () => {
            renderWithProviders(<Harness params={{ ...all, partsOfSpeech: [PartOfSpeech.noun] }} />);
            const used = rowOf('house');
            const unused = rowOf('run');
            expect(used).toHaveAttribute('data-used', 'true');
            expect(used).not.toHaveClass('line-through');
            expect(unused).toHaveAttribute('data-used', 'false');
            expect(unused).toHaveClass('line-through', 'text-muted-foreground');
            expect(flags(unused).every((img) => img.classList.contains('grayscale'))).toBe(true);
        });

        it('shows the flag of an unselected language in gray, and the others in color', () => {
            renderWithProviders(<Harness params={{ ...all, languages: [Lang.EN, Lang.ES] }} />);
            const [en, de] = flags(rowOf('house'));
            expect(en).not.toHaveClass('grayscale');
            expect(de).toHaveClass('grayscale');
        });

        it('a word whose languages are all unselected is gray and struck through', () => {
            renderWithProviders(<Harness params={{ ...all, languages: [Lang.ES] }} />);
            expect(rowOf('house')).toHaveClass('line-through');
            expect(rowOf('run')).not.toHaveClass('line-through');
        });
    });

    describe('eye closed (hidden)', () => {
        it('leaves out the words that will not be used', async () => {
            const user = userEvent.setup();
            renderWithProviders(<Harness params={{ ...all, partsOfSpeech: [PartOfSpeech.noun] }} />);
            await user.click(screen.getByRole('button', { name: 'Hide the words that will not be used' }));

            expect(screen.getByText('house')).toBeInTheDocument();
            expect(screen.queryByText('run')).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Show all words' })).toBeInTheDocument();
        });

        it('leaves out the flags of unselected languages', async () => {
            const user = userEvent.setup();
            renderWithProviders(<Harness params={{ ...all, languages: [Lang.EN, Lang.ES] }} />);
            await user.click(screen.getByRole('button', { name: 'Hide the words that will not be used' }));
            expect(flags(rowOf('house'))).toHaveLength(1);
            expect(flags(rowOf('run'))).toHaveLength(2);
        });

        it('says so when nothing would be used, and the eye brings the words back', async () => {
            const user = userEvent.setup();
            renderWithProviders(<Harness params={{ ...all, partsOfSpeech: [] }} initial="hidden" />);
            expect(screen.getByText('No selected word matches these settings.')).toBeInTheDocument();

            await user.click(screen.getByRole('button', { name: 'Show all words' }));
            expect(screen.getByText('house')).toBeInTheDocument();
        });
    });

    it('asks before it removes the pre-selection, and only offers that when it can', async () => {
        const user = userEvent.setup();
        const onClear = vi.fn();
        const { unmount } = renderWithProviders(<Harness params={all} onClear={onClear} />);

        await user.click(screen.getByRole('button', { name: 'Remove pre-selection' }));
        expect(onClear).not.toHaveBeenCalled();
        await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove' }));
        expect(onClear).toHaveBeenCalledTimes(1);
        unmount();

        renderWithProviders(<Harness params={all} />);
        expect(screen.queryByRole('button', { name: 'Remove pre-selection' })).not.toBeInTheDocument();
    });
});
