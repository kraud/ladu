import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './button';

describe('Button', () => {
    it('renders the default (primary) variant at 36px with the Ladu radius', () => {
        render(<Button>Sign in</Button>);
        const button = screen.getByRole('button', { name: 'Sign in' });
        expect(button.className).toContain('bg-primary');
        expect(button.className).toContain('h-9');
        expect(button.className).toContain('rounded-md');
    });

    it('renders the secondary, ghost and destructive variants', () => {
        render(
            <>
                <Button variant="secondary">Reset</Button>
                <Button variant="ghost">Cancel</Button>
                <Button variant="destructive">Delete</Button>
            </>
        );
        expect(screen.getByRole('button', { name: 'Reset' }).className).toContain('bg-secondary');
        expect(screen.getByRole('button', { name: 'Cancel' }).className).toContain('hover:bg-muted');
        expect(screen.getByRole('button', { name: 'Delete' }).className).toContain('bg-destructive');
    });

    it('disables interaction and dims at .45 opacity when disabled', () => {
        render(<Button disabled>Loading…</Button>);
        const button = screen.getByRole('button', { name: 'Loading…' });
        expect(button).toBeDisabled();
        expect(button.className).toContain('disabled:opacity-45');
    });
});
