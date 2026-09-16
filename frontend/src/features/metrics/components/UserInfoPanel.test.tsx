import { screen, waitFor } from '@testing-library/react';
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
    incompleteWordsCount: 3,
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
        await waitFor(() => expect(screen.getByText('10')).toBeInTheDocument());
    });

    it('renders the three stat cards from the metrics response', async () => {
        const fake = makeMetricsHandlers(populated);
        server.use(...fake.handlers);

        await renderApp({ initialEntry: '/', session: session(['English', 'German']) });

        await waitFor(() => expect(screen.getByText('10')).toBeInTheDocument());
        expect(screen.getByText('Total words')).toBeInTheDocument();
        expect(screen.getByText('15')).toBeInTheDocument(); // totalTranslations = 10 + 5
        expect(screen.getByText('Total translations')).toBeInTheDocument();
        expect(screen.getByText('30%')).toBeInTheDocument(); // 3 / 10
        const meter = screen.getByRole('progressbar', { name: 'Incomplete words' });
        expect(meter).toHaveAttribute('aria-valuenow', '30');
    });

    it('shows "—" and an add-languages link for a language-less account (D10)', async () => {
        const fake = makeMetricsHandlers({ ...populated, incompleteWordsCount: 0 });
        server.use(...fake.handlers);

        await renderApp({ initialEntry: '/', session: session([]) });

        await waitFor(() => expect(screen.getByText('—')).toBeInTheDocument());
        expect(screen.queryByRole('progressbar', { name: 'Incomplete words' })).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Add your languages' })).toHaveAttribute('href', '/user');
    });
});
