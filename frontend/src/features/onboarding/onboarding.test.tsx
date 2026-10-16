import { describe, expect, it } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { makeMetricsHandlers } from '@/test/msw/metricsHandlers';
import { makeAccessHandlers } from '@/test/msw/accessHandlers';
import { saveOnboardingResult } from './resultCard';
import { renderApp } from '@/test/render';
import { OPEN_ACCESS } from '@/features/access/types';
import { useAuthStore } from '@/stores/authStore';
import { futureToken } from '@/test/tokens';
import de from '../../../public/locales/de/onboarding.json';
import ee from '../../../public/locales/ee/onboarding.json';
import en from '../../../public/locales/en/onboarding.json';
import es from '../../../public/locales/es/onboarding.json';

const pendingSession = { id: 'u1', email: 'a@x.com', token: futureToken(), onboardingStatus: 'pending' };

describe('/onboarding (welcome + skip)', () => {
    it('shows the welcome full screen, without the app header', async () => {
        server.use(...makeAccessHandlers({ ...OPEN_ACCESS, onboarding: { enabled: true } }));
        await renderApp({ initialEntry: '/', session: pendingSession });
        expect(await screen.findByRole('heading', { name: en.welcome.title })).toBeInTheDocument();
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
        await waitFor(() => expect(useAuthStore.getState().user?.onboardingStatus).toBe('skipped'));
        expect(called).toBe(1);
        await waitFor(() => expect(screen.queryByRole('heading', { name: en.welcome.title })).not.toBeInTheDocument());
    });

    it('stays on the page and shows an error when Skip fails', async () => {
        server.use(
            ...makeAccessHandlers({ ...OPEN_ACCESS, onboarding: { enabled: true } }),
            http.post('*/api/onboarding/skip', () => HttpResponse.json({ message: 'x' }, { status: 500 })),
        );
        await renderApp({ initialEntry: '/', session: pendingSession });
        await userEvent.click(await screen.findByRole('button', { name: en.skip }));
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

    async function toTopics() {
        await click(en.start);
        await click(en.next);
        await click(en.levels.beginner);
        await click(en.next);
    }

    it('walks every step and creates with the chosen levels, topics and count', async () => {
        const calls = setup();
        await renderApp({ initialEntry: '/', session });
        await toTopics();
        for (const id of ['clothing', 'animals', 'weather']) await click(en.topics.names[id as keyof typeof en.topics.names]);
        await click(en.next);
        expect(await screen.findByText('100 words')).toBeInTheDocument();
        await click('Add 100 words');
        await waitFor(() => expect(useAuthStore.getState().user?.onboardingStatus).toBe('done'));
        expect(calls.profile).toHaveLength(0);
        expect(calls.capacity).toEqual([{ levels: { Spanish: 'beginner' }, topics: ['clothing', 'animals', 'weather'] }]);
        expect(calls.create).toEqual([{ levels: { Spanish: 'beginner' }, topics: ['clothing', 'animals', 'weather'], count: 100 }]);
    });

    it('keeps Next off until the step is complete, and stops at 6 topics', async () => {
        setup();
        await renderApp({ initialEntry: '/', session });
        await click(en.start);
        await click(en.next);
        expect(screen.getByRole('button', { name: en.next })).toBeDisabled();
        await click(en.levels.advanced);
        await click(en.next);
        const ids = Object.keys(en.topics.names) as (keyof typeof en.topics.names)[];
        for (const id of ids.slice(0, 2)) await click(en.topics.names[id]);
        expect(screen.getByRole('button', { name: en.next })).toBeDisabled();
        for (const id of ids.slice(2, 6)) await click(en.topics.names[id]);
        expect(screen.getByRole('button', { name: en.next })).toBeEnabled();
        expect(screen.getByRole('button', { name: en.topics.names[ids[6]] })).toBeDisabled();
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
        for (const id of ['clothing', 'animals', 'weather']) await click(en.topics.names[id as keyof typeof en.topics.names]);
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
        for (const id of ['clothing', 'animals', 'weather']) await click(en.topics.names[id as keyof typeof en.topics.names]);
        await click(en.next);
        expect(await screen.findByText('30 words')).toBeInTheDocument();
        expect(screen.queryByRole('slider')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Add 30 words' })).toBeEnabled();
    });

    it('shows an error and stays when Create fails', async () => {
        setup();
        server.use(http.post('*/api/onboarding', () => HttpResponse.json({ message: 'x' }, { status: 500 })));
        await renderApp({ initialEntry: '/', session });
        await toTopics();
        for (const id of ['clothing', 'animals', 'weather']) await click(en.topics.names[id as keyof typeof en.topics.names]);
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
        await userEvent.click(await screen.findByRole('button', { name: en.levels.beginner }));
        await userEvent.click(await screen.findByRole('button', { name: en.next }));
        for (const id of ['clothing', 'animals', 'weather'] as const) {
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
])('onboarding.json (%s)', (_code, file) => {
    it('has the same keys as English', () => {
        expect(keys(file)).toEqual(keys(en));
    });
});
