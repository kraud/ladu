import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App (Slice-1 primitives gallery)', () => {
    it('renders every primitive without throwing', () => {
        render(<App />);
        expect(screen.getByRole('heading', { name: 'Ladu — primitives gallery', level: 1 })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Primary' })).toBeInTheDocument();
        expect(screen.getByLabelText('Email')).toBeInTheDocument();
        expect(screen.getByText('Verify your email to unlock every feature.')).toBeInTheDocument();
    });
});
