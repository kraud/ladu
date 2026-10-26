import { beforeEach, describe, expect, it } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { makeMetricsHandlers } from '@/test/msw/metricsHandlers';
import { makeAccessHandlers } from '@/test/msw/accessHandlers';
import { buildTiming } from './hooks';
import { saveOnboardingResult } from './resultCard';
import { renderApp } from '@/test/render';
import { OPEN_ACCESS } from '@/features/access/types';
import { useAuthStore } from '@/stores/authStore';
import { futureToken } from '@/test/tokens';
import de from '../../../public/locales/de/onboarding.json';
import ee from '../../../public/locales/ee/onboarding.json';
import en from '../../../public/locales/en/onboarding.json';
import es from '../../../public/locales/es/onboarding.json';
import fr from '../../../public/locales/fr/onboarding.json';

beforeEach(() => {
    buildTiming.minMs = 0;
});

/** The title has a line break in it, so the name is matched with `\s+`. */
const WELCOME_TITLE = /Welcome to Ladu\s+let's create your first Words and Tags\./;

const pendingSession = { id: 'u1', email: 'a@x.com', token: futureToken(), onboardingStatus: 'pending' };

describe('/onboarding (welcome + skip)', () => {
    it('shows the welcome full screen, without the app header', async () => {
        server.use(...makeAccessHandlers({ ...OPEN_ACCESS, onboarding: { enabled: true } }));
        await renderApp({ initialEntry: '/', session: pendingSession });
        expect(await screen.findByRole('heading', { name: WELCOME_TITLE })).toBeInTheDocument();
        expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    });

    it('Skip tells the server, saves "skipped" and opens the dashboard', async () => {
        let called = 0;
        server.use(
            ...makeAccessHandlers({ ...OPEN_ACCESS, onboarding: { enabled: true } }),
            ...makeMetricsHandlers().handlers,
            http.post('*/api/onboarding/skip', () => {
                called += 1;
                return HttpResponse.json({ onboardingStatus: 'skipped' });
            }),
        );
        await renderApp({ initialEntry: '/', session: pendingSession });
        await userEvent.click(await screen.findByRole('button', { name: en.skip }));
        await userEvent.click(await screen.findByRole('button', { name: en.skipDialog.confirm }));
        await waitFor(() => expect(useAuthStore.getState().user?.onboardingStatus).toBe('skipped'));
        expect(called).toBe(1);
        await waitFor(() => expect(screen.queryByRole('heading', { name: WELCOME_TITLE })).not.toBeInTheDocument());
    });

    it('asks for confirmation before it skips, and does nothing when the user continues', async () => {
        let called = 0;
        server.use(
            ...makeAccessHandlers({ ...OPEN_ACCESS, onboarding: { enabled: true } }),
            http.post('*/api/onboarding/skip', () => {
                called += 1;
                return HttpResponse.json({ onboardingStatus: 'skipped' });
            }),
        );
        await renderApp({ initialEntry: '/', session: pendingSession });
        await userEvent.click(await screen.findByRole('button', { name: en.skip }));
        const dialog = await screen.findByRole('alertdialog');
        expect(within(dialog).getByText(en.skipDialog.text)).toBeInTheDocument();
        await userEvent.click(within(dialog).getByRole('button', { name: en.skipDialog.cancel }));
        await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
        expect(called).toBe(0);
        expect(useAuthStore.getState().user?.onboardingStatus).toBe('pending');
    });

    it('stays on the page and shows an error when Skip fails', async () => {
        server.use(
            ...makeAccessHandlers({ ...OPEN_ACCESS, onboarding: { enabled: true } }),
            http.post('*/api/onboarding/skip', () => HttpResponse.json({ message: 'x' }, { status: 500 })),
        );
        await renderApp({ initialEntry: '/', session: pendingSession });
        await userEvent.click(await screen.findByRole('button', { name: en.skip }));
        await userEvent.click(await screen.findByRole('button', { name: en.skipDialog.confirm }));
        expect(await screen.findByRole('alert')).toBeInTheDocument();
        expect(useAuthStore.getState().user?.onboardingStatus).toBe('pending');
    });
});


/** The flow past the welcome: languages → levels → topics → count → Create (Slice 4c). */
describe('/onboarding steps', () => {
    const session = {
        ...pendingSession,
        name: 'Ada',
        username: 'ada',
        languages: ['English', 'Spanish'],
        uiLanguage: 'English',
        nativeLanguage: 'English',
    };

    function setup(capacity = 150) {
        const calls = { capacity: [] as unknown[], create: [] as unknown[], profile: [] as unknown[] };
        server.use(
            ...makeAccessHandlers({ ...OPEN_ACCESS, onboarding: { enabled: true } }),
            ...makeMetricsHandlers().handlers,
            http.put('*/api/users/updateUser', async ({ request }) => {
                const body = (await request.json()) as Record<string, unknown>;
                calls.profile.push(body);
                return HttpResponse.json({ ...session, ...body, onboardingStatus: 'pending' });
            }),
            http.post('*/api/onboarding/capacity', async ({ request }) => {
                calls.capacity.push(await request.json());
                return HttpResponse.json({ capacity });
            }),
            http.post('*/api/onboarding', async ({ request }) => {
                calls.create.push(await request.json());
                return HttpResponse.json({ words: 60, tags: [] }, { status: 201 });
            }),
        );
        return calls;
    }

    const click = async (name: string | RegExp) => userEvent.click(await screen.findByRole('button', { name }));

    const clickLevel = async (name: string) => userEvent.click(await screen.findByRole('radio', { name }));

    async function toTopics() {
        await click(en.start);
        await click(en.next);
        await clickLevel(en.levels.beginner);
        await click(en.next);
    }

    it('walks every step and creates with the chosen levels, topics and count', async () => {
        const calls = setup();
        await renderApp({ initialEntry: '/', session });
        await toTopics();
        for (const id of ['clothing', 'animals', 'weather', 'feelings']) await click(en.topics.names[id as keyof typeof en.topics.names]);
        await click(en.next);
        expect(await screen.findByRole('status')).toHaveTextContent('100 words');
        await click('Add 100 words');
        await waitFor(() => expect(useAuthStore.getState().user?.onboardingStatus).toBe('done'));
        expect(calls.profile).toHaveLength(0);
        expect(calls.capacity).toEqual([{ levels: { Spanish: 'beginner' }, topics: ['clothing', 'animals', 'weather', 'feelings'] }]);
        expect(calls.create).toEqual([{ levels: { Spanish: 'beginner' }, topics: ['clothing', 'animals', 'weather', 'feelings'], count: 100 }]);
    });

    it('keeps Next off until the step is complete; needs 4 topics and has no maximum', async () => {
        setup();
        await renderApp({ initialEntry: '/', session });
        await click(en.start);
        await click(en.next);
        expect(screen.getByRole('button', { name: en.next })).toBeDisabled();
        await clickLevel(en.levels.advanced);
        await click(en.next);
        const ids = Object.keys(en.topics.names) as (keyof typeof en.topics.names)[];
        for (const id of ids.slice(0, 3)) await click(en.topics.names[id]);
        expect(screen.getByRole('button', { name: en.next })).toBeDisabled();
        await click(en.topics.names[ids[3]]);
        expect(screen.getByRole('button', { name: en.next })).toBeEnabled();
        // No maximum: all 15 topics can be picked.
        for (const id of ids.slice(4)) await click(en.topics.names[id]);
        expect(ids).toHaveLength(15);
        expect(screen.getByRole('button', { name: en.next })).toBeEnabled();
        for (const id of ids) expect(screen.getByRole('button', { name: en.topics.names[id] })).toBeEnabled();
        expect(screen.getByText('15 topics picked')).toBeInTheDocument();
    });

    it('saves a changed native language before the levels step, and asks a level for the new language', async () => {
        const calls = setup();
        await renderApp({ initialEntry: '/', session });
        await click(en.start);
        const native = await screen.findByRole('region', { name: en.languages.nativeTitle });
        await userEvent.click(within(native).getByRole('button', { name: 'Español' }));
        await click(en.next);
        await waitFor(() => expect(calls.profile).toHaveLength(1));
        expect(calls.profile[0]).toMatchObject({ languages: ['English', 'Spanish'], nativeLanguage: 'Spanish', email: 'a@x.com' });
        expect(await screen.findByRole('region', { name: 'English' })).toBeInTheDocument();
    });

    it('caps the slider at the capacity and explains it', async () => {
        setup(110);
        await renderApp({ initialEntry: '/', session });
        await toTopics();
        for (const id of ['clothing', 'animals', 'weather', 'feelings']) await click(en.topics.names[id as keyof typeof en.topics.names]);
        await click(en.next);
        const slider = await screen.findByRole('slider');
        expect(slider).toHaveAttribute('max', '110');
        expect(slider).toHaveAttribute('min', '50');
        expect(screen.getByText('With these levels and topics, we can add up to 110 words.')).toBeInTheDocument();
    });

    it('under 50 words the minimum becomes the capacity (D25)', async () => {
        setup(30);
        await renderApp({ initialEntry: '/', session });
        await toTopics();
        for (const id of ['clothing', 'animals', 'weather', 'feelings']) await click(en.topics.names[id as keyof typeof en.topics.names]);
        await click(en.next);
        expect(await screen.findByRole('status')).toHaveTextContent('30 words');
        expect(screen.queryByRole('slider')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Add 30 words' })).toBeEnabled();
    });

    it('marks the current step in the rail and fills the summary with the answers', async () => {
        setup();
        await renderApp({ initialEntry: '/', session });
        await click(en.start);
        const rail = await screen.findByRole('complementary', { name: en.rail.label });
        const steps = within(rail).getAllByRole('listitem');
        expect(steps[0]).toHaveAttribute('aria-current', 'step');
        expect(within(rail).getByText('Español')).toBeInTheDocument();
        expect(within(rail).getAllByText('English')).toHaveLength(2); // a language and the native one
        await click(en.next);
        await clickLevel(en.levels.beginner);
        await click(en.next);
        expect(steps[0]).toHaveClass('done');
        expect(within(rail).getAllByRole('listitem')[2]).toHaveAttribute('aria-current', 'step');
        await click(en.topics.names.clothing);
        expect(within(rail).getByText(en.topics.names.clothing)).toBeInTheDocument();
    });

    it('has no Back on the first question, and goes back from the others', async () => {
        setup();
        await renderApp({ initialEntry: '/', session });
        await click(en.start);
        await screen.findByRole('heading', { name: en.languages.title });
        expect(screen.queryByRole('button', { name: en.back })).not.toBeInTheDocument();
        await click(en.next);
        await click(en.back);
        expect(await screen.findByRole('heading', { name: en.languages.title })).toBeInTheDocument();
    });

    it('shows the building screen, without Skip or Next, while Create runs', async () => {
        setup();
        server.use(
            http.post('*/api/onboarding', async () => {
                await new Promise((resolve) => setTimeout(resolve, 150));
                return HttpResponse.json({ words: 60, tags: [] }, { status: 201 });
            }),
        );
        await renderApp({ initialEntry: '/', session });
        await toTopics();
        for (const id of ['clothing', 'animals', 'weather', 'feelings']) await click(en.topics.names[id as keyof typeof en.topics.names]);
        await click(en.next);
        await click('Add 100 words');
        expect(await screen.findByRole('heading', { name: en.building.title })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: en.skip })).toBeDisabled();
        expect(screen.queryByRole('button', { name: en.next })).not.toBeInTheDocument();
        await waitFor(() => expect(useAuthStore.getState().user?.onboardingStatus).toBe('done'));
    });

    it('keeps the building screen for the minimum time, even when the server is fast', async () => {
        setup();
        buildTiming.minMs = 400;
        await renderApp({ initialEntry: '/', session });
        await toTopics();
        for (const id of ['clothing', 'animals', 'weather', 'feelings']) await click(en.topics.names[id as keyof typeof en.topics.names]);
        await click(en.next);
        await click('Add 100 words');
        expect(await screen.findByRole('heading', { name: en.building.title })).toBeInTheDocument();
        await new Promise((resolve) => setTimeout(resolve, 200));
        expect(screen.getByRole('heading', { name: en.building.title })).toBeInTheDocument();
        expect(useAuthStore.getState().user?.onboardingStatus).toBe('pending');
        await waitFor(() => expect(useAuthStore.getState().user?.onboardingStatus).toBe('done'));
    });

    it('offers only the languages from registration, all selected', async () => {
        setup();
        await renderApp({ initialEntry: '/', session });
        await click(en.start);
        await screen.findByRole('heading', { name: en.languages.title });
        const tiles = Array.from(document.querySelectorAll('.lang-tile'));
        expect(tiles.map((tile) => tile.getAttribute('aria-label'))).toEqual(['English', 'Español']);
        expect(tiles.every((tile) => tile.getAttribute('aria-pressed') === 'true')).toBe(true);
    });

    it('has the language and theme switches in the rail', async () => {
        setup();
        await renderApp({ initialEntry: '/', session });
        await click(en.start);
        const rail = await screen.findByRole('complementary', { name: en.rail.label });
        expect(within(rail).getAllByRole('button').length).toBeGreaterThanOrEqual(2);
    });

    it('shows an error and stays when Create fails', async () => {
        setup();
        server.use(http.post('*/api/onboarding', () => HttpResponse.json({ message: 'x' }, { status: 500 })));
        await renderApp({ initialEntry: '/', session });
        await toTopics();
        for (const id of ['clothing', 'animals', 'weather', 'feelings']) await click(en.topics.names[id as keyof typeof en.topics.names]);
        await click(en.next);
        await click('Add 100 words');
        expect(await screen.findByRole('alert')).toBeInTheDocument();
        expect(useAuthStore.getState().user?.onboardingStatus).toBe('pending');
    });
});

describe('dashboard result card (Slice 4d)', () => {
    const tags = [
        { id: 't1', label: 'Clothing', topic: 'clothing', words: 20 },
        { id: 't2', label: 'Animals', topic: 'animals', words: 20 },
        { id: 't3', label: 'Weather', topic: 'weather', words: 20 },
        { id: 't4', label: 'Core vocabulary', topic: 'core', words: 10 },
    ];
    const session = { id: 'u1', email: 'a@x.com', token: futureToken(), onboardingStatus: 'done' };

    function setup() {
        server.use(...makeAccessHandlers(), ...makeMetricsHandlers().handlers);
    }

    it('shows words, topics (not the core tag), a link per tag and a way to practise', async () => {
        setup();
        saveOnboardingResult('u1', { words: 70, tags });
        await renderApp({ initialEntry: '/', session });
        expect(await screen.findByText('70 words added in 3 topics')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Clothing · 20' })).toHaveAttribute('href', '/tag/t1');
        expect(screen.getByRole('link', { name: 'Core vocabulary · 10' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: en.result.practise })).toHaveAttribute('href', '/practice');
    });

    it('stays after a reload and goes when the user closes it', async () => {
        setup();
        saveOnboardingResult('u1', { words: 70, tags });
        await renderApp({ initialEntry: '/', session });
        await screen.findByText('70 words added in 3 topics');
        cleanup();
        await renderApp({ initialEntry: '/', session });
        await userEvent.click(await screen.findByRole('button', { name: 'Close' }));
        expect(screen.queryByText('70 words added in 3 topics')).not.toBeInTheDocument();
        cleanup();
        await renderApp({ initialEntry: '/', session });
        await screen.findByText(/Welcome/);
        expect(screen.queryByText('70 words added in 3 topics')).not.toBeInTheDocument();
    });

    it('is not shown to another account on the same browser', async () => {
        setup();
        saveOnboardingResult('someone-else', { words: 70, tags });
        await renderApp({ initialEntry: '/', session });
        await screen.findByText(/Welcome/);
        expect(screen.queryByText('70 words added in 3 topics')).not.toBeInTheDocument();
    });

    it('Create stores the answer, so the dashboard shows the card', async () => {
        const created = { words: 60, tags: [{ id: 't9', label: 'Ropa', topic: 'clothing', words: 60 }] };
        server.use(
            ...makeAccessHandlers({ ...OPEN_ACCESS, onboarding: { enabled: true } }),
            ...makeMetricsHandlers().handlers,
            http.post('*/api/onboarding/capacity', () => HttpResponse.json({ capacity: 150 })),
            http.post('*/api/onboarding', () => HttpResponse.json(created, { status: 201 })),
        );
        await renderApp({
            initialEntry: '/',
            session: { ...session, onboardingStatus: 'pending', languages: ['English', 'Spanish'], nativeLanguage: 'English' },
        });
        await userEvent.click(await screen.findByRole('button', { name: en.start }));
        await userEvent.click(await screen.findByRole('button', { name: en.next }));
        await userEvent.click(await screen.findByRole('radio', { name: en.levels.beginner }));
        await userEvent.click(await screen.findByRole('button', { name: en.next }));
        for (const id of ['clothing', 'animals', 'weather', 'feelings'] as const) {
            await userEvent.click(await screen.findByRole('button', { name: en.topics.names[id] }));
        }
        await userEvent.click(await screen.findByRole('button', { name: en.next }));
        await userEvent.click(await screen.findByRole('button', { name: 'Add 100 words' }));
        expect(await screen.findByText('60 words added in 1 topics')).toBeInTheDocument();
    });
});

const keys = (value: unknown, prefix = ''): string[] =>
    typeof value === 'object' && value !== null
        ? Object.entries(value).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k)).sort()
        : [prefix];

describe.each([
    ['es', es],
    ['de', de],
    ['ee', ee],
    ['fr', fr],
])('onboarding.json (%s)', (_code, file) => {
    it('has the same keys as English', () => {
        expect(keys(file)).toEqual(keys(en));
    });
});
