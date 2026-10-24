import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { renderApp } from '@/test/render';
import { server } from '@/test/msw/server';
import { EMPTY_METRICS, makeMetricsHandlers } from '@/test/msw/metricsHandlers';
import { useAuthStore } from '@/stores/authStore';
import { futureToken } from '@/test/tokens';
import { makeExercise, makePracticeHandlers } from '@/test/msw/practiceHandlers';
import { mockMobileViewport } from '@/test/viewport';
import { usePracticeSessionStore } from '@/features/practice/sessionStore';
import { defaultParams } from '@/features/practice/params';
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
    totalTags: 0,
    unpracticedWordsCount: 2,
    translationsInPractice: 24,
    practicedTranslations: 6,
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

describe('DashboardPage — quick actions', () => {
    const quick = (name: string) => screen.queryByRole('button', { name });

    it('on a desktop: two equal buttons under the stat cards, each a big icon with its label under it', async () => {
        server.use(...makeMetricsHandlers(POPULATED).handlers);
        await renderApp({ initialEntry: '/', session: session(['English', 'German']) });

        const random = await screen.findByRole('button', { name: 'Random practice' });
        const newWord = screen.getByRole('button', { name: 'New word' });
        // One row, two halves.
        expect(random.parentElement).toBe(newWord.parentElement);
        expect(random.parentElement).toHaveClass('grid', 'grid-cols-2');
        // Icon first (accent, decorative), the label under it.
        for (const button of [random, newWord]) {
            expect(button).toHaveClass('flex-col');
            expect(button.firstElementChild?.querySelector('svg')).not.toBeNull();
            expect(button.firstElementChild).toHaveClass('text-(--accent)');
        }
        // Under the last stat card: after the unpracticed-words card in the same column.
        const incomplete = (await screen.findByText('Unpracticed words')).closest('.stat-card')!;
        expect(incomplete.parentElement).toContainElement(random.parentElement as HTMLElement);
        expect(incomplete.compareDocumentPosition(random) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('on a phone: not on the dashboard (the menu has them)', async () => {
        mockMobileViewport();
        server.use(...makeMetricsHandlers(POPULATED).handlers);
        await renderApp({ initialEntry: '/', session: session(['English', 'German']) });

        await screen.findByText('Unpracticed words');
        expect(quick('Random practice')).not.toBeInTheDocument();
        expect(quick('New word')).not.toBeInTheDocument();
    });

    it('New word opens the Add word page', async () => {
        server.use(...makeMetricsHandlers(POPULATED).handlers);
        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/', session: session(['English', 'German']) });

        await user.click(await screen.findByRole('button', { name: 'New word' }));
        await waitFor(() => expect(router.state.location.pathname).toBe('/addWord'));
    });

    it('Random practice starts a session with the default settings and opens Practice', async () => {
        usePracticeSessionStore.getState().clear();
        server.use(...makeMetricsHandlers(POPULATED).handlers);
        const fake = makePracticeHandlers({ exercises: [makeExercise()] });
        server.use(...fake.handlers);
        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/', session: session(['English', 'German']) });

        await user.click(await screen.findByRole('button', { name: 'Random practice' }));
        await waitFor(() => expect(router.state.location.pathname).toBe('/practice'));
        expect(fake.state.generateBodies).toHaveLength(1);
    });

    it('Random practice asks first while a session is open, like the menu does', async () => {
        server.use(...makeMetricsHandlers(POPULATED).handlers);
        const fake = makePracticeHandlers({ exercises: [makeExercise({ key: 'new' })] });
        server.use(...fake.handlers);
        usePracticeSessionStore.getState().start({
            userId: 'u1', params: defaultParams(['English', 'German']), wordIds: null, exercises: [makeExercise({ key: 'old' })],
        });
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/', session: session(['English', 'German']) });

        await user.click(await screen.findByRole('button', { name: 'Random practice' }));
        expect(await screen.findByRole('button', { name: 'Leave session and delete' })).toBeInTheDocument();
        expect(fake.state.generateBodies).toHaveLength(0);
        usePracticeSessionStore.getState().clear();
    });
});
