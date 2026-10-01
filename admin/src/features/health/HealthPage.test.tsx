import { describe, expect, it } from 'vitest';
import { HttpResponse } from 'msw';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/renderApp';
import { makeStaff } from '@/test/msw/handlers';
import { healthHandler, hoursAgo, makeHealth } from '@/test/health';
import { EXTERNAL_LINKS } from '@/features/health/links';

const section = (name: string) => within(screen.getByRole('heading', { name }).closest('section') as HTMLElement);

describe('HealthPage', () => {
    it('shows the service, the database and the backups', async () => {
        server.use(healthHandler());

        await renderApp({ initialEntry: '/health', role: 'viewer' });
        await screen.findByRole('heading', { name: 'Service' });

        const service = section('Service');
        expect(service.getByText('Answers')).toBeInTheDocument();
        expect(service.getByText('prod')).toBeInTheDocument();
        expect(service.getByText('0123456')).toBeInTheDocument();
        // The full commit is one hover away.
        expect(service.getByText('0123456').closest('dd')).toHaveAttribute('title', '0123456789abcdef0123456789abcdef01234567');
        expect(service.getByText('1d 2h 3m')).toBeInTheDocument();
        expect(service.getByText('v24.19.0')).toBeInTheDocument();

        const database = section('Database');
        expect(database.getByText('15.0 MB')).toBeInTheDocument();
        expect(database.getByText('0013_ops_events')).toBeInTheDocument();
        expect(database.getByText('Users').nextSibling).toHaveTextContent('1,234');
        expect(database.getByText('Words').nextSibling).toHaveTextContent('50,000');
        expect(database.getByText('Saved practice sessions').nextSibling).toHaveTextContent('7');

        const backups = section('Backups');
        expect(backups.getByText('ladu_prod_20261001T030000Z.dump')).toBeInTheDocument();
        expect(backups.getByText(/5 hours ago/)).toBeInTheDocument();
        expect(backups.getByText(/3 days ago/)).toBeInTheDocument();
        expect(backups.getAllByText('OK')).toHaveLength(2);
    });

    it('flags an overdue backup, an overdue restore test, and a failed run', async () => {
        server.use(
            healthHandler(() =>
                makeHealth({
                    backups: {
                        lastBackup: { ok: true, detail: 'old.dump', at: hoursAgo(40) },
                        lastRestoreTest: { ok: false, detail: 'pg_restore failed', at: hoursAgo(3) },
                    },
                }),
            ),
        );

        await renderApp({ initialEntry: '/health', role: 'viewer' });
        await screen.findByRole('heading', { name: 'Backups' });

        const backups = section('Backups');
        expect(backups.getByText('Overdue')).toBeInTheDocument();
        expect(backups.getByText('Failed')).toBeInTheDocument();
        expect(backups.getByText('pg_restore failed')).toBeInTheDocument();
        expect(backups.queryByText('OK')).not.toBeInTheDocument();
    });

    it('treats a restore test of 7 days as current and of 9 days as overdue', async () => {
        server.use(
            healthHandler(() =>
                makeHealth({
                    backups: {
                        lastBackup: { ok: true, detail: null, at: hoursAgo(1) },
                        lastRestoreTest: { ok: true, detail: null, at: hoursAgo(7 * 24) },
                    },
                }),
            ),
        );
        const { unmount } = await renderApp({ initialEntry: '/health', role: 'viewer' });
        await screen.findByRole('heading', { name: 'Backups' });
        expect(section('Backups').queryByText('Overdue')).not.toBeInTheDocument();
        unmount();

        server.use(
            healthHandler(() =>
                makeHealth({
                    backups: {
                        lastBackup: { ok: true, detail: null, at: hoursAgo(1) },
                        lastRestoreTest: { ok: true, detail: null, at: hoursAgo(9 * 24) },
                    },
                }),
            ),
        );
        await renderApp({ initialEntry: '/health', role: 'viewer' });
        await screen.findByRole('heading', { name: 'Backups' });
        expect(await section('Backups').findByText('Overdue')).toBeInTheDocument();
    });

    it('explains an empty backup section (staging, or before the first run)', async () => {
        server.use(healthHandler(() => makeHealth({ backups: { lastBackup: null, lastRestoreTest: null } })));

        await renderApp({ initialEntry: '/health', role: 'viewer' });
        await screen.findByRole('heading', { name: 'Backups' });

        expect(section('Backups').getAllByText('None recorded')).toHaveLength(2);
        expect(section('Backups').getByText(/Only production is backed up/)).toBeInTheDocument();
    });

    it('shows the problem, not an error page, when the database does not answer', async () => {
        server.use(
            healthHandler(() =>
                makeHealth({ service: { ...makeHealth().service, database: 'error' }, database: null, backups: null }),
            ),
        );

        await renderApp({ initialEntry: '/health', role: 'viewer' });
        await screen.findByRole('heading', { name: 'Service' });

        expect(section('Service').getByText('Does not answer')).toBeInTheDocument();
        expect(section('Database').getByText(/database does not answer/)).toBeInTheDocument();
        expect(section('Backups').getByText(/database does not answer/)).toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('shows an alert when the admin API itself fails', async () => {
        server.use(healthHandler(() => HttpResponse.json({ message: 'Boom' }, { status: 500 }) as unknown as Response));

        await renderApp({ initialEntry: '/health', role: 'viewer' });

        expect(await screen.findByRole('alert')).toHaveTextContent('The admin API did not answer the health check.');
        expect(screen.getByRole('alert')).toHaveTextContent('Boom');
        // The links do not depend on the API, so they stay useful exactly when it is down.
        expect(screen.getByRole('link', { name: /Netcup/ })).toBeInTheDocument();
    });

    it('checks again when Refresh is pressed', async () => {
        let calls = 0;
        server.use(
            healthHandler(() => {
                calls += 1;
                return makeHealth();
            }),
        );
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/health', role: 'viewer' });
        await screen.findByRole('heading', { name: 'Service' });
        expect(calls).toBe(1);

        await user.click(screen.getByRole('button', { name: 'Refresh' }));

        await waitFor(() => expect(calls).toBe(2));
    });

    it('lists the external tools, each opening safely in a new tab', async () => {
        server.use(healthHandler());

        await renderApp({ initialEntry: '/health', role: 'viewer' });
        await screen.findByRole('heading', { name: 'More detail in other tools' });

        const links = section('More detail in other tools').getAllByRole('link');
        expect(links).toHaveLength(EXTERNAL_LINKS.length);
        for (const link of links) {
            expect(link).toHaveAttribute('target', '_blank');
            expect(link).toHaveAttribute('rel', 'noopener noreferrer');
            expect(link.getAttribute('href')).toMatch(/^https:\/\//);
        }
        expect(links.map((l) => l.getAttribute('href'))).toEqual(expect.arrayContaining(['https://app.ladu.com.ar/api/health', 'https://staging.ladu.com.ar/api/health']));
    });
});

describe('Health nav link', () => {
    it('is shown to a role with health.read, and opens the page', async () => {
        server.use(healthHandler());
        const user = userEvent.setup();
        const { router } = await renderApp({ role: 'viewer' });

        await user.click(await screen.findByRole('link', { name: 'Health' }));

        expect(router.state.location.pathname).toBe('/health');
        expect(await screen.findByRole('heading', { name: 'Service' })).toBeInTheDocument();
    });

    it('is hidden from a staff member without health.read', async () => {
        await renderApp({ session: { staff: { ...makeStaff('viewer'), permissions: ['users.read'] } } });

        await screen.findByRole('link', { name: 'Users' });

        expect(screen.queryByRole('link', { name: 'Health' })).not.toBeInTheDocument();
    });
});
