import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { makeMetricsHandlers } from '@/test/msw/metricsHandlers';
import { makeAccessHandlers } from '@/test/msw/accessHandlers';
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
