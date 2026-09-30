import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { createTestI18n } from '@/test/render';
import { PartOfSpeech } from '@/ts/enums';
import { FormLabel } from './FormLabel';

const wrap = (node: React.ReactNode) => <I18nextProvider i18n={createTestI18n()}>{node}</I18nextProvider>;

describe('FormLabel', () => {
    it('is short by default, and the full words are there for screen readers', () => {
        render(wrap(<FormLabel partOfSpeech={PartOfSpeech.noun} caseName="pluralGenitivDE" />));

        expect(screen.getByText('n.')).toHaveAttribute('aria-hidden', 'true');
        expect(screen.getByText('pl.')).toBeInTheDocument();
        expect(screen.getByText('gen.')).toBeInTheDocument();
        expect(screen.getByText(/Noun,/)).toHaveClass('sr-only');
        expect(screen.getByText(/Plural,/)).toHaveClass('sr-only');
        expect(screen.getByText('Genitive')).toHaveClass('sr-only');
    });

    it('shows the complete label in the full mode, without abbreviations', () => {
        render(wrap(<FormLabel partOfSpeech={PartOfSpeech.verb} caseName="indicativeSimpleFuture3plDE" mode="full" />));

        expect(screen.getByText('Verb · Future · 3rd person plural')).toBeInTheDocument();
        expect(screen.queryByText('fut.')).not.toBeInTheDocument();
    });

    it('abbreviates a verb form with the person as one piece', () => {
        render(wrap(<FormLabel partOfSpeech={PartOfSpeech.verb} caseName="indicativePresent1sES" />));

        expect(screen.getByText('v.')).toBeInTheDocument();
        expect(screen.getByText('pres.')).toBeInTheDocument();
        expect(screen.getByText('1st p. sg.')).toBeInTheDocument();
    });
});
