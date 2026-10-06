import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/renderApp';
import { makeDetail } from '@/test/users';
import type { UserBadge, UserDetail } from '@/features/users/types';
import type { StaffRole } from '@/stores/authStore';

const OFFICIAL: UserBadge = {
    type: 'official',
    grantedAt: '2026-10-01T09:00:00.000Z',
    grantedBy: { id: 'staff-9', name: 'Olga Owner' },
};

type Call = { kind: 'grant' | 'revoke'; path: string; body: Record<string, unknown> };

/**
 * Serves the detail and the two badge routes. A grant or revoke changes what the
 * next answer says, as the real server does. `fail` answers the next badge call
 * with an error instead.
 */
function serveBadges(initial: UserDetail, fail?: { status: number; message: string }) {
    let current = initial;
    const calls: Call[] = [];
    server.use(
        http.get('/api/admin/users/:id', () => HttpResponse.json(current)),
        http.post('/api/admin/users/:id/badges', async ({ request }) => {
            const body = (await request.json()) as Record<string, unknown>;
            calls.push({ kind: 'grant', path: new URL(request.url).pathname, body });
            if (fail) return HttpResponse.json({ message: fail.message }, { status: fail.status });
            current = { ...current, badges: [...current.badges, { ...OFFICIAL, type: String(body.type) }] };
            return HttpResponse.json(current);
        }),
        http.post('/api/admin/users/:id/badges/:type/revoke', async ({ request, params }) => {
            const body = (await request.json()) as Record<string, unknown>;
            calls.push({ kind: 'revoke', path: new URL(request.url).pathname, body });
            if (fail) return HttpResponse.json({ message: fail.message }, { status: fail.status });
            current = { ...current, badges: current.badges.filter((b) => b.type !== params.type) };
            return HttpResponse.json(current);
        }),
    );
    return calls;
}

const open = async (role: StaffRole) => {
    await renderApp({ initialEntry: '/users/u1', role });
    await screen.findByRole('heading', { name: 'Kaja Tamm' });
};

const badgeSection = () => within(screen.getByRole('heading', { name: 'Badges' }).closest('section') as HTMLElement);

describe('the badge list', () => {
    it('says so when the account has no badge', async () => {
        serveBadges(makeDetail({ badges: [] }));
        await open('viewer');

        expect(badgeSection().getByText('This account has no badge.')).toBeInTheDocument();
    });

    it.each<StaffRole>(['viewer', 'support', 'admin'])('%s sees the badge and who granted it, but no buttons', async (role) => {
        serveBadges(makeDetail({ badges: [OFFICIAL] }));
        await open(role);

        const section = badgeSection();
        expect(section.getByText('Official')).toBeInTheDocument();
        expect(section.getByText(/by Olga Owner/)).toBeInTheDocument();
        expect(section.queryByRole('button')).not.toBeInTheDocument();
    });

    it('the owner sees "Grant badge" when the account has none, and no Revoke button', async () => {
        serveBadges(makeDetail({ badges: [] }));
        await open('owner');

        expect(badgeSection().getAllByRole('button').map((b) => b.textContent)).toEqual(['Grant badge']);
    });

    it('the owner sees Revoke, and no "Grant badge" once every type is on the account', async () => {
        serveBadges(makeDetail({ badges: [OFFICIAL] }));
        await open('owner');

        expect(badgeSection().getAllByRole('button').map((b) => b.textContent)).toEqual(['Revoke']);
        expect(badgeSection().getByRole('button', { name: 'Revoke the Official badge' })).toBeInTheDocument();
    });

    it('shows a type that the page does not know by its raw name', async () => {
        serveBadges(makeDetail({ badges: [{ ...OFFICIAL, type: 'curator' }] }));
        await open('admin');

        expect(badgeSection().getByText('curator')).toBeInTheDocument();
    });
});

describe('grant', () => {
    it('needs a reason, sends type and reason, then shows the badge and a notice', async () => {
        const calls = serveBadges(makeDetail({ badges: [] }));
        const user = userEvent.setup();
        await open('owner');

        await user.click(badgeSection().getByRole('button', { name: 'Grant badge' }));
        const dialog = within(await screen.findByRole('dialog'));
        const confirm = dialog.getByRole('button', { name: 'Grant badge' });

        expect(confirm).toBeDisabled();
        await user.type(dialog.getByLabelText(/Reason/), '   ');
        expect(confirm).toBeDisabled();
        await user.type(dialog.getByLabelText(/Reason/), 'Ladu team account');
        expect(confirm).toBeEnabled();
        await user.click(confirm);

        expect(await screen.findByRole('status')).toHaveTextContent('The Official badge is granted.');
        expect(calls).toEqual([
            { kind: 'grant', path: '/api/admin/users/u1/badges', body: { type: 'official', reason: 'Ladu team account' } },
        ]);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        // The detail now comes from the server answer: the badge is listed, "Grant badge" is gone.
        expect(badgeSection().getByText('Official')).toBeInTheDocument();
        expect(badgeSection().queryByRole('button', { name: 'Grant badge' })).not.toBeInTheDocument();
    });

    it('lists the badge type in the dialog', async () => {
        serveBadges(makeDetail({ badges: [] }));
        const user = userEvent.setup();
        await open('owner');

        await user.click(badgeSection().getByRole('button', { name: 'Grant badge' }));
        const select = within(await screen.findByRole('dialog')).getByLabelText('Badge');

        expect(select).toHaveValue('official');
    });

    it('shows the server error in the dialog and keeps it open', async () => {
        serveBadges(makeDetail({ badges: [] }), { status: 409, message: 'This account already has this badge' });
        const user = userEvent.setup();
        await open('owner');

        await user.click(badgeSection().getByRole('button', { name: 'Grant badge' }));
        const dialog = within(await screen.findByRole('dialog'));
        await user.type(dialog.getByLabelText(/Reason/), 'again');
        await user.click(dialog.getByRole('button', { name: 'Grant badge' }));

        expect(await dialog.findByRole('alert')).toHaveTextContent('This account already has this badge');
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('Cancel closes the dialog and sends nothing', async () => {
        const calls = serveBadges(makeDetail({ badges: [] }));
        const user = userEvent.setup();
        await open('owner');

        await user.click(badgeSection().getByRole('button', { name: 'Grant badge' }));
        await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(calls).toEqual([]);
    });
});

describe('revoke', () => {
    it('needs a reason, sends it to the revoke route, then removes the badge and shows a notice', async () => {
        const calls = serveBadges(makeDetail({ badges: [OFFICIAL] }));
        const user = userEvent.setup();
        await open('owner');

        await user.click(badgeSection().getByRole('button', { name: 'Revoke the Official badge' }));
        const dialog = within(await screen.findByRole('dialog'));
        const confirm = dialog.getByRole('button', { name: 'Revoke badge' });

        expect(dialog.getByRole('heading', { name: 'Revoke the Official badge?' })).toBeInTheDocument();
        // Revoke has no type select: the type is the badge that was clicked.
        expect(dialog.queryByLabelText('Badge')).not.toBeInTheDocument();
        expect(confirm).toBeDisabled();
        await user.type(dialog.getByLabelText(/Reason/), 'Left the team');
        await user.click(confirm);

        expect(await screen.findByRole('status')).toHaveTextContent('The Official badge is revoked.');
        expect(calls).toEqual([
            { kind: 'revoke', path: '/api/admin/users/u1/badges/official/revoke', body: { reason: 'Left the team' } },
        ]);
        expect(badgeSection().getByText('This account has no badge.')).toBeInTheDocument();
        expect(badgeSection().getAllByRole('button').map((b) => b.textContent)).toEqual(['Grant badge']);
    });

    it('shows the server error in the dialog and keeps the badge', async () => {
        serveBadges(makeDetail({ badges: [OFFICIAL] }), { status: 409, message: 'This account does not have this badge' });
        const user = userEvent.setup();
        await open('owner');

        await user.click(badgeSection().getByRole('button', { name: 'Revoke the Official badge' }));
        const dialog = within(await screen.findByRole('dialog'));
        await user.type(dialog.getByLabelText(/Reason/), 'x');
        await user.click(dialog.getByRole('button', { name: 'Revoke badge' }));

        expect(await dialog.findByRole('alert')).toHaveTextContent('This account does not have this badge');
        // The page behind an open dialog is hidden from the accessibility tree, so close it first.
        await user.click(dialog.getByRole('button', { name: 'Cancel' }));
        expect(badgeSection().getByText('Official')).toBeInTheDocument();
    });
});
