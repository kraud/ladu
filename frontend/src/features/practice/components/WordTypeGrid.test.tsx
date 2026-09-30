import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { createTestI18n } from '@/test/render';
import { PartOfSpeech } from '@/ts/enums';
import { WordTypeGrid } from './WordTypeGrid';

const wrap = (node: React.ReactNode) => <I18nextProvider i18n={createTestI18n()}>{node}</I18nextProvider>;

describe('WordTypeGrid', () => {
    it('shows each type as a short tag and keeps the full name for screen readers', () => {
        render(wrap(<WordTypeGrid partsOfSpeech={[PartOfSpeech.noun, PartOfSpeech.verb]} />));

        expect(screen.getByText('n.')).toHaveAttribute('aria-hidden', 'true');
        expect(screen.getByText('v.')).toBeInTheDocument();
        expect(screen.getByText('Noun')).toHaveClass('sr-only');
        expect(screen.getByText('Verb')).toHaveClass('sr-only');
    });

    it('puts a lone last tag on the bottom row', () => {
        render(wrap(<WordTypeGrid partsOfSpeech={[PartOfSpeech.noun, PartOfSpeech.verb, PartOfSpeech.adjective]} />));

        expect(screen.getByTestId('types-grid').children[2]).toHaveStyle({ gridRow: '2', gridColumn: '2' });
    });

    it('uses the same grid shapes as the flags', () => {
        const four = [PartOfSpeech.noun, PartOfSpeech.verb, PartOfSpeech.adjective, PartOfSpeech.adverb];
        render(wrap(<WordTypeGrid partsOfSpeech={four} />));

        const grid = screen.getByTestId('types-grid');
        expect(grid.children).toHaveLength(4);
        expect(grid).toHaveStyle({ gridTemplateRows: 'repeat(2, max-content)', gridAutoFlow: 'column' });
    });
});
