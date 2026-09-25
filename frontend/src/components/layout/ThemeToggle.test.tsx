import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { ThemeToggle } from './ThemeToggle';
import { PublicThemeToggle } from './PublicThemeToggle';

describe('ThemeToggle', () => {
    it('offers dark from the light theme and calls back with the next theme', async () => {
        const onToggle = vi.fn();
        renderWithProviders(<ThemeToggle theme="light" onToggle={onToggle} />);

        await userEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
        expect(onToggle).toHaveBeenCalledWith('dark');
    });

    it('offers light from the dark theme', async () => {
        const onToggle = vi.fn();
        renderWithProviders(<ThemeToggle theme="dark" onToggle={onToggle} />);

        await userEvent.click(screen.getByRole('button', { name: 'Switch to light theme' }));
        expect(onToggle).toHaveBeenCalledWith('light');
    });

    it('is disabled while busy', () => {
        renderWithProviders(<ThemeToggle theme="light" onToggle={vi.fn()} busy />);
        expect(screen.getByRole('button')).toBeDisabled();
    });
});

describe('PublicThemeToggle', () => {
    it('switches the page theme and saves the choice without a session', async () => {
        renderWithProviders(<PublicThemeToggle />);

        await userEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }));

        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        expect(localStorage.getItem('ladu.theme')).toBe('dark');
        expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument();
    });
});
