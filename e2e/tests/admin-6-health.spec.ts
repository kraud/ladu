import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test, expect, type Locator, type Page } from '@playwright/test';
import {
    closePool,
    createStaffAccount,
    deleteOpsEventsByDetail,
    deleteStaffByEmail,
    deleteUsersByEmail,
    seedOpsEvent,
    seedUser,
} from '../fixtures/db';

/**
 * Admin dashboard, slice 6 — the health page, against the real backend +
 * Postgres + the `admin/` UI (`.context/plans/admin-dashboard.md`).
 *
 * Seeds a viewer (the lowest role: it already has `health.read`), two users,
 * and a backup and a restore-test row as the VPS scripts would write them, then
 * checks the page against what the database really holds: the newest migration
 * name comes from the repo's own journal, the row counts include the seeded
 * users, and the backup section shows the seeded rows.
 */

const ADMIN_URL = process.env.E2E_ADMIN_URL ?? 'http://localhost:5174';

const run = Date.now();
const PASSWORD = 'e2e-staff-password';
const viewerEmail = `e2e-admin6-${run}-viewer@ladu.test`;
const userEmails = [`e2e-admin6-${run}-a@ladu.test`, `e2e-admin6-${run}-b@ladu.test`];
const DETAIL = `e2e-admin6-${run}`;

// The newest migration in the repo: a deployed, migrated database must report it.
const journal = JSON.parse(
    readFileSync(resolve(process.cwd(), '../backend/src/db/migrations/meta/_journal.json'), 'utf8'),
) as { entries: { tag: string; when: number }[] };
const newestMigration = journal.entries.reduce((a, b) => (b.when > a.when ? b : a)).tag;

test.beforeAll(async () => {
    await createStaffAccount(viewerEmail, 'viewer', PASSWORD);
    await seedUser(userEmails[0], { name: 'Health A', username: `ha${run}` });
    await seedUser(userEmails[1], { name: 'Health B', username: `hb${run}` });
    await seedOpsEvent('backup', true, `${DETAIL}-backup.dump`, 2);
    await seedOpsEvent('restore_test', false, `${DETAIL}-restore failed`, 1);
});

test.afterAll(async () => {
    await deleteOpsEventsByDetail(DETAIL);
    await deleteUsersByEmail(userEmails);
    await deleteStaffByEmail([viewerEmail]);
    await closePool();
});

const section = (page: Page, heading: string): Locator =>
    page.locator('section', { has: page.getByRole('heading', { name: heading, exact: true }) });

test.describe('Admin dashboard — health (slice 6)', () => {
    test('a viewer opens the page from the header and sees the real deployment state', async ({ page }) => {
        await page.goto(`${ADMIN_URL}/login`);
        await page.getByLabel('Email').fill(viewerEmail);
        await page.getByLabel('Password').fill(PASSWORD);
        await page.getByRole('button', { name: 'Sign in' }).click();

        await page.getByRole('link', { name: 'Health' }).click();
        await expect(page).toHaveURL(`${ADMIN_URL}/health`);
        await expect(page.getByRole('heading', { name: 'Health' })).toBeVisible();

        // Service: the database answers; the rest comes from the running backend.
        const service = section(page, 'Service');
        await expect(service.getByText('Answers')).toBeVisible();
        await expect(service.getByText('Environment').locator('xpath=following-sibling::dd')).not.toBeEmpty();
        await expect(service.getByText('Backend uptime').locator('xpath=following-sibling::dd')).toHaveText(/^\d+(s|m|h \d+m|d \d+h \d+m)/);
        await expect(service.getByText('Node.js').locator('xpath=following-sibling::dd')).toHaveText(/^v\d+\./);

        // Database: a size, the newest migration from the repo's journal, and counts.
        const database = section(page, 'Database');
        await expect(database.getByText('Size').locator('xpath=following-sibling::dd')).toHaveText(/^\d+(\.\d)? (KB|MB|GB)$/);
        await expect(database.getByText(newestMigration, { exact: true })).toBeVisible();
        const usersCount = await database.getByText('Users', { exact: true }).locator('xpath=following-sibling::dd').innerText();
        // Other specs create users at the same time, so "at least the two seeded ones".
        expect(Number(usersCount.replace(/,/g, ''))).toBeGreaterThanOrEqual(2);
        await expect(database.getByText('Audit log entries')).toBeVisible();

        // Backups: the two rows seeded as the VPS scripts write them.
        const backups = section(page, 'Backups');
        await expect(backups.getByText(`${DETAIL}-backup.dump`)).toBeVisible();
        await expect(backups.getByText(/2 hours ago/)).toBeVisible();
        await expect(backups.getByText(`${DETAIL}-restore failed`)).toBeVisible();
        await expect(backups.getByText('Failed', { exact: true })).toBeVisible();
        await expect(backups.getByText('OK', { exact: true })).toBeVisible();

        // The links open in a new tab and point at the public tools.
        const links = section(page, 'More detail in other tools').getByRole('link');
        await expect(links).toHaveCount(8);
        await expect(section(page, 'More detail in other tools').getByRole('link', { name: /Cloudflare/ })).toHaveAttribute('target', '_blank');

        // Refresh asks again, and the page stays filled in.
        const refresh = page.waitForResponse((r) => r.url().endsWith('/api/admin/health') && r.status() === 200);
        await page.getByRole('button', { name: 'Refresh' }).click();
        await refresh;
        await expect(service.getByText('Answers')).toBeVisible();

        // A reload keeps the session and shows the page again.
        await page.reload();
        await expect(page.getByRole('heading', { name: 'Health' })).toBeVisible();
        await expect(section(page, 'Backups').getByText(`${DETAIL}-backup.dump`)).toBeVisible();
    });

    test('the API refuses a request without a staff token', async ({ request }) => {
        const API = process.env.E2E_API_URL ?? 'http://localhost:5001';

        expect((await request.get(`${API}/api/admin/health`)).status()).toBe(401);
        expect((await request.get(`${API}/api/admin/health`, { headers: { Authorization: 'Bearer not-a-token' } })).status()).toBe(401);
    });
});
