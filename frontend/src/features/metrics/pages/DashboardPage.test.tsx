import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { renderApp } from '@/test/render';
import { server } from '@/test/msw/server';
import { EMPTY_METRICS, makeMetricsHandlers } from '@/test/msw/metricsHandlers';
import { useAuthStore } from '@/stores/authStore';
import { futureToken } from '@/test/tokens';
import { PartOfSpeech } from '@/ts/enums';
import type { BasicUserMetricsBE } from '../types';
import { monthLabel } from '../selectors';

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

// Adjective/adverb deliberately absent, so pieSeries('words') zero-fills them
// to 0 — `worstSegment`'s tie-break (`selectors.ts`) keeps the first zero it
// finds, and adjective precedes adverb in `CREATABLE_POS`, so adjective is
// the unambiguous worst category here.
const POPULATED: BasicUserMetricsBE = {
    totalWords: 12,
    incompleteWordsCount: 2,
    translationsPerLanguage: [
        { language: 'English', count: 12, type: 'language' },
        { language: 'German', count: 6, type: 'language' },
    ],
    translationsPerLanguageAndPOS: [
        { label: 'English', type: 'language', partOfSpeech: PartOfSpeech.noun, count: 8 },
        { label: 'German', type: 'language', partOfSpeech: PartOfSpeech.verb, count: 4 },
    ],
    wordsPerPOS: [
        { partOfSpeech: PartOfSpeech.noun, type: 'partOfSpeech', count: 8 },
        { partOfSpeech: PartOfSpeech.verb, type: 'partOfSpeech', count: 4 },
    ],
    // The current month: "by month" is the default view only when words were added this month.
    wordsPerMonth: [{ label: monthLabel(new Date()), partOfSpeech: PartOfSpeech.noun, count: 8 }],
};

afterEach(() => {
    useAuthStore.getState().clearSession();
});

describe('DashboardPage — MetricsPanel', () => {
    it('renders both charts from the metrics response once loaded', async () => {
        server.use(...makeMetricsHandlers(POPULATED).handlers);

        const { container } = await renderApp({ initialEntry: '/', session: session(['English', 'German']) });

        expect(await screen.findByRole('img', { name: 'Distribution of word types' })).toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'Words per month' })).toBeInTheDocument();
        // Scoped to the pie's own legend — "Noun"/"Verb" also appear in the
        // bar chart's legend, so an unscoped query is ambiguous.
        const pieLegend = within(container.querySelector('.pie-legend') as HTMLElement);
        expect(pieLegend.getByText('Noun')).toBeInTheDocument();
        expect(pieLegend.getByText('Verb')).toBeInTheDocument();
    });

    it('shows the call to action over placeholder charts for a fresh account', async () => {
        server.use(...makeMetricsHandlers(EMPTY_METRICS).handlers);

        await renderApp({ initialEntry: '/', session: session(['English', 'German']) });

        expect(await screen.findByText('No words yet')).toBeInTheDocument();
        // Placeholder pie, and an explanatory banner in the middle of the empty bar chart.
        expect(screen.getByTestId('pie-empty')).toBeInTheDocument();
        expect(screen.getByText('No data yet')).toBeInTheDocument();
        expect(screen.getByText('No words were added in this period yet.')).toBeInTheDocument();
    });

    it('opens the bar chart on "By language" when nothing was added this month, even with older monthly data', async () => {
        server.use(
            ...makeMetricsHandlers({
                ...POPULATED,
                wordsPerMonth: [{ label: '2020-01', partOfSpeech: PartOfSpeech.noun, count: 8 }],
            }).handlers,
        );

        await renderApp({ initialEntry: '/', session: session(['English', 'German']) });

        const xToggle = await screen.findByRole('radiogroup', { name: 'Bar chart X axis' });
        expect(within(xToggle).getByRole('radio', { name: 'Language' })).toBeChecked();
    });

    it('opens the bar chart on "By language" when only that view has data', async () => {
        server.use(
            ...makeMetricsHandlers({ ...POPULATED, wordsPerMonth: [] }).handlers,
        );

        await renderApp({ initialEntry: '/', session: session(['English', 'German']) });

        const xToggle = await screen.findByRole('radiogroup', { name: 'Bar chart X axis' });
        expect(within(xToggle).getByRole('radio', { name: 'Language' })).toBeChecked();
        expect(screen.queryByText(/were added in this period/)).not.toBeInTheDocument();

        // The user can still pick "By month" — which then explains why it is empty.
        await userEvent.click(within(xToggle).getByRole('radio', { name: 'Month' }));
        expect(await screen.findByText('No words were added in this period yet.')).toBeInTheDocument();
    });

    it('switches the pie from word-type to language distribution', async () => {
        server.use(...makeMetricsHandlers(POPULATED).handlers);

        await renderApp({ initialEntry: '/', session: session(['English', 'German']) });

        await screen.findByRole('img', { name: 'Distribution of word types' });
        const pieToggle = screen.getByRole('radiogroup', { name: 'Pie chart distribution' });
        await userEvent.click(within(pieToggle).getByRole('radio', { name: 'Language' }));

        expect(await screen.findByRole('img', { name: 'Distribution of languages' })).toBeInTheDocument();
        // "Español" (Spanish's native name, per lib/language.ts) is a zero-filled
        // UI_LANGUAGES entry — only the pie's language legend can show it.
        expect(screen.getByText('Español')).toBeInTheDocument();
    });

    it('switches the bar chart x-axis from month to language', async () => {
        server.use(...makeMetricsHandlers(POPULATED).handlers);

        await renderApp({ initialEntry: '/', session: session(['English', 'German']) });

        await screen.findByRole('img', { name: 'Words per month' });
        const xAxisToggle = screen.getByRole('radiogroup', { name: 'Bar chart X axis' });
        await userEvent.click(within(xAxisToggle).getByRole('radio', { name: 'Language' }));

        expect(await screen.findByRole('img', { name: 'Words per language' })).toBeInTheDocument();
    });

    it('names the icon-only bar grouping options with their tooltips', async () => {
        server.use(...makeMetricsHandlers(POPULATED).handlers);

        await renderApp({ initialEntry: '/', session: session(['English', 'German']) });

        await screen.findByRole('img', { name: 'Words per month' });
        const groupingToggle = screen.getByRole('radiogroup', { name: 'Bar chart grouping' });
        // The two options are icons only, so `title` is the whole contract:
        // it is the hover tooltip and the accessible name.
        expect(within(groupingToggle).getByRole('radio', { name: 'Grouped' })).toHaveAttribute(
            'title',
            'Grouped',
        );
        expect(within(groupingToggle).getByRole('radio', { name: 'Separated' })).toHaveAttribute(
            'title',
            'Separated',
        );
    });

    it('links the pie chart worst category to /addWord/<pos>', async () => {
        server.use(...makeMetricsHandlers(POPULATED).handlers);

        const { router } = await renderApp({ initialEntry: '/', session: session(['English', 'German']) });

        await screen.findByRole('img', { name: 'Distribution of word types' });
        await userEvent.click(screen.getByRole('button', { name: /Adjective/ }));

        await waitFor(() => expect(router.state.location.pathname).toBe('/addWord/adjective'));
    });
});
