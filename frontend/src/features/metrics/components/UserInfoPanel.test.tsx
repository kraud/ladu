import { waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { renderApp } from '@/test/render';
import { server } from '@/test/msw/server';
import { makeMetricsHandlers } from '@/test/msw/metricsHandlers';
import { useAuthStore } from '@/stores/authStore';
import { futureToken } from '@/test/tokens';
import { PartOfSpeech } from '@/ts/enums';
import type { BasicUserMetricsBE } from '../types';

function session(languages: string[]) {
    return {
        id: 'u1',
        name: 'Kai Rebane',
        email: 'kai@example.com',
        username: 'kai',
        languages,
        uiLanguage: 'English',
        nativeLanguage: null,
        verified: true,
        token: futureToken(),
    };
}

const populated: BasicUserMetricsBE = {
    totalWords: 10,
    totalTags: 0,
    unpracticedWordsCount: 3,
    translationsInPractice: 40,
    practicedTranslations: 30,
    translationsPerLanguage: [
        { language: 'English', count: 10, type: 'language' },
        { language: 'German', count: 5, type: 'language' },
    ],
    translationsPerLanguageAndPOS: [],
    wordsPerPOS: [{ partOfSpeech: PartOfSpeech.noun, type: 'partOfSpeech', count: 10 }],
    wordsPerMonth: [{ label: '2026-09', partOfSpeech: PartOfSpeech.noun, count: 4 }],
};

afterEach(() => {
    useAuthStore.getState().clearSession();
});

describe('UserInfoPanel (via DashboardPage)', () => {
    it('shows skeleton placeholders before the metrics response resolves', async () => {
        const fake = makeMetricsHandlers(populated);
        server.use(...fake.handlers);

        const { container } = await renderApp({ initialEntry: '/', session: session(['English', 'German']) });

        expect(container.querySelectorAll('.sk-num').length).toBeGreaterThan(0);
        // Scoped to `.stat-stack` — MetricsPanel's chart gridlines/legend can
        // repeat the same digits (Slice 6), so an unscoped query is ambiguous.
        const stats = () => within(container.querySelector('.stat-stack') as HTMLElement);
        await waitFor(() => expect(stats().getByText('10')).toBeInTheDocument());
    });

    it('renders the three stat cards from the metrics response', async () => {
        const fake = makeMetricsHandlers(populated);
        server.use(...fake.handlers);

        const { container } = await renderApp({ initialEntry: '/', session: session(['English', 'German']) });

        const stats = () => within(container.querySelector('.stat-stack') as HTMLElement);
        await waitFor(() => expect(stats().getByText('10')).toBeInTheDocument());
        expect(stats().getByText('Total words')).toBeInTheDocument();
        expect(stats().getByText('15')).toBeInTheDocument(); // totalTranslations = 10 + 5
        expect(stats().getByText('Total translations')).toBeInTheDocument();
        expect(stats().getByText('3')).toBeInTheDocument(); // unpracticedWordsCount
        expect(stats().getByText('Unpracticed words')).toBeInTheDocument();
        expect(stats().getByText('75% of translations practiced (30/40)')).toBeInTheDocument();
        const meter = stats().getByRole('progressbar', { name: 'Translations practiced' });
        expect(meter).toHaveAttribute('aria-valuenow', '75');
    });

    it('shows an empty card with a link to add words when there are no translations to practice', async () => {
        const fake = makeMetricsHandlers({ ...populated, totalWords: 0, unpracticedWordsCount: 0, translationsInPractice: 0, practicedTranslations: 0 });
        server.use(...fake.handlers);

        const { container } = await renderApp({ initialEntry: '/', session: session(['English', 'German']) });

        const stats = () => within(container.querySelector('.stat-stack') as HTMLElement);
        await waitFor(() => expect(stats().getByText('Unpracticed words')).toBeInTheDocument());
        expect(stats().getByText('—')).toBeInTheDocument();
        expect(stats().queryByRole('progressbar')).not.toBeInTheDocument();
        expect(stats().getByRole('link', { name: 'Add words to track your practice' })).toHaveAttribute('href', '/addWord');
    });

    it('a small share shows one decimal and the counts, so it never reads as 0%', async () => {
        server.use(...makeMetricsHandlers({ ...populated, translationsInPractice: 5738, practicedTranslations: 23 }).handlers);

        const { container } = await renderApp({ initialEntry: '/', session: session(['English', 'German']) });

        const stats = () => within(container.querySelector('.stat-stack') as HTMLElement);
        await waitFor(() => expect(stats().getByText('0.4% of translations practiced (23/5738)')).toBeInTheDocument());
        expect(stats().getByRole('progressbar', { name: 'Translations practiced' })).toHaveAttribute('aria-valuenow', '0.4');
    });

    it('does not depend on the account languages (the old incomplete-words rule did)', async () => {
        server.use(...makeMetricsHandlers(populated).handlers);

        const { container } = await renderApp({ initialEntry: '/', session: session([]) });

        const stats = () => within(container.querySelector('.stat-stack') as HTMLElement);
        await waitFor(() => expect(stats().getByText('75% of translations practiced (30/40)')).toBeInTheDocument());
    });
});
