import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { PartOfSpeech } from '@/ts/enums';
import type { WordSimpleBE } from '@/features/words/types';
import { WordCell } from './WordCell';

function baseRow(overrides: Partial<WordSimpleBE> = {}): WordSimpleBE {
    return {
        id: 'word-1',
        user: 'owner-1',
        partOfSpeech: PartOfSpeech.noun,
        tags: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        storedLanguages: [],
        ...overrides,
    };
}

describe('WordCell — no translation stored', () => {
    it('renders an Add button for an own word and calls onOpenCell', () => {
        const onOpenCell = vi.fn();
        const row = baseRow();
        renderWithProviders(
            <table>
                <tbody>
                    <tr>
                        <td>
                            <WordCell row={row} langKey="EN" isOwn showGender onOpenCell={onOpenCell} />
                        </td>
                    </tr>
                </tbody>
            </table>,
        );

        const button = screen.getByRole('button');
        expect(button.className).toContain('cell-add');
        fireEvent.click(button);
        expect(onOpenCell).toHaveBeenCalledWith('word-1', 'EN');
    });

    it('renders a read-only Block glyph for a followed-tag word, with no button', () => {
        const row = baseRow();
        renderWithProviders(
            <table>
                <tbody>
                    <tr>
                        <td>
                            <WordCell row={row} langKey="EN" isOwn={false} showGender />
                        </td>
                    </tr>
                </tbody>
            </table>,
        );

        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(document.querySelector('.cell-block')).toBeInTheDocument();
    });
});

describe('WordCell — translation stored', () => {
    it('renders the headline word and a completion ring', () => {
        const row = baseRow({ dataEN: 'house', registeredCasesEN: 2, storedLanguages: ['English'] });
        renderWithProviders(
            <table>
                <tbody>
                    <tr>
                        <td>
                            <WordCell row={row} langKey="EN" isOwn showGender />
                        </td>
                    </tr>
                </tbody>
            </table>,
        );

        expect(screen.getByRole('button')).toHaveTextContent('house');
        // English noun's expected count is 3 (regularity, singular, plural).
        expect(screen.getByText('2 of 3 cases')).toBeInTheDocument();
    });

    it('renders a dash when the language is stored but has no headline case', () => {
        const row = baseRow({
            partOfSpeech: PartOfSpeech.noun,
            genderES: 'la',
            registeredCasesES: 1,
            storedLanguages: ['Spanish'],
        });
        renderWithProviders(
            <table>
                <tbody>
                    <tr>
                        <td>
                            <WordCell row={row} langKey="ES" isOwn showGender />
                        </td>
                    </tr>
                </tbody>
            </table>,
        );

        // Still a translation-present cell (a button, not the Add/Block states).
        expect(screen.getByRole('button')).toHaveTextContent('—');
    });

    it('shows the gender chip only for a noun when showGender is on', () => {
        const row = baseRow({
            partOfSpeech: PartOfSpeech.noun,
            dataDE: 'Hund',
            genderDE: 'der',
            registeredCasesDE: 2,
            storedLanguages: ['German'],
        });
        const { rerender } = renderWithProviders(
            <table>
                <tbody>
                    <tr>
                        <td>
                            <WordCell row={row} langKey="DE" isOwn showGender />
                        </td>
                    </tr>
                </tbody>
            </table>,
        );
        expect(screen.getByText('der')).toBeInTheDocument();

        rerender(
            <table>
                <tbody>
                    <tr>
                        <td>
                            <WordCell row={row} langKey="DE" isOwn showGender={false} />
                        </td>
                    </tr>
                </tbody>
            </table>,
        );
        expect(screen.queryByText('der')).not.toBeInTheDocument();
    });

    it('renders no ring at all when there is no form config for this (pos, language)', () => {
        // Estonian has no Adverb config by design (configs/adverbs.ts).
        const row = baseRow({
            partOfSpeech: PartOfSpeech.adverb,
            dataEE: 'kiiresti',
            registeredCasesEE: 1,
            storedLanguages: ['Estonian'],
        });
        renderWithProviders(
            <table>
                <tbody>
                    <tr>
                        <td>
                            <WordCell row={row} langKey="EE" isOwn showGender />
                        </td>
                    </tr>
                </tbody>
            </table>,
        );

        expect(screen.getByRole('button')).toHaveTextContent('kiiresti');
        expect(document.querySelector('.ring')).not.toBeInTheDocument();
    });
});
