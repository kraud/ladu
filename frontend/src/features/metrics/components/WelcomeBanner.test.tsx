import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { WelcomeBanner } from './WelcomeBanner';

afterEach(() => {
    vi.useRealTimers();
});

describe('WelcomeBanner', () => {
    it('greets the user by name', () => {
        renderWithProviders(<WelcomeBanner name="Kai Rebane" />);
        expect(
            screen.getByRole('heading', { name: /Welcome, Kai Rebane/ }),
        ).toBeInTheDocument();
    });

    it('cycles the greeting line through the four UI languages', () => {
        vi.useFakeTimers();
        const { container } = renderWithProviders(<WelcomeBanner name="Kai" />);
        const lang = () => container.querySelector('[data-lang]')?.getAttribute('data-lang');

        // One step per rotation tick — mirrors `ROTATE_MS` in WelcomeBanner.
        expect(lang()).toBe('en');
        act(() => vi.advanceTimersByTime(8000));
        expect(lang()).toBe('es');
        act(() => vi.advanceTimersByTime(8000));
        expect(lang()).toBe('de');
        act(() => vi.advanceTimersByTime(8000));
        expect(lang()).toBe('ee');
        act(() => vi.advanceTimersByTime(8000));
        expect(lang()).toBe('en'); // wraps
    });

    it('replays the hand shake with every greeting change (the icon remounts)', () => {
        vi.useFakeTimers();
        const { container } = renderWithProviders(<WelcomeBanner name="Kai" />);
        const hand = () => container.querySelector('.wave-shake');

        const first = hand();
        expect(first).not.toBeNull();
        act(() => vi.advanceTimersByTime(8000));
        expect(hand()).not.toBeNull();
        expect(hand()).not.toBe(first);
    });
});
