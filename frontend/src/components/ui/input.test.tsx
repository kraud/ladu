import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Input } from './input';

describe('Input', () => {
    it('renders at 36px with the Ladu control padding', () => {
        render(<Input placeholder="you@example.com" />);
        const input = screen.getByPlaceholderText('you@example.com');
        expect(input.className).toContain('h-9');
        expect(input.className).toContain('px-[11px]');
    });

    it('marks aria-invalid inputs with the danger ring token', () => {
        render(<Input aria-invalid="true" defaultValue="short" />);
        const input = screen.getByDisplayValue('short');
        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(input.className).toContain('ring-(--danger-soft)');
    });
});
