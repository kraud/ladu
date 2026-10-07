import { test, expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import {
    closePool,
    createStaffAccount,
    deleteStaffByEmail,
    deleteUsersByEmail,
    getAuditForUser,
    getBadgeRows,
    seedTag,
    seedUser,
} from '../fixtures/db';
import { signIn, type Account } from '../fixtures/practice';

/**
 * Account badges (`.context/plans/verified-badges.md`, slice 8 gate), against the real
 * backend + Postgres + both UIs (`admin/` and the learner app).
 *
 * One story, told in order:
 *  - Only the owner may grant a badge. An admin sees the badge list but no buttons, and the API
 *    says 403.
 *  - The owner grants "official" to an author, in the admin panel, with a reason. The audit log
 *    and the badge table both record it.
 *  - A reader sees the seal on the author's card on `/tags` and on the `/tag/:id` page. A tag of
 *    an author with no badge shows none.
 *  - The reader ticks "Verified" on `/tags`: only the badged author's tag stays, the choice is in
 *    the URL and survives a reload.
 *  - A badged account may take a reserved name such as "Ladu" (an `official` badge exempts it).
 *  - The owner revokes the badge, with a reason. The row stays (`revoked_at`). The reader's same
 *    session shows no seal and an empty "Verified" list at once: the badge is read from the DB on
 *    each request, not from the token.
 *  - With no badge, the author may no longer take a reserved name, and the reader cannot either,
 *    in the account form.
 *
 * The suite runs against the dev DB, which holds other people's tags. So every check looks for
 * this run's uniquely named tags and never assumes a list holds only them.
 *
 * Uses unique `e2e-badges-*` emails and removes them in `afterAll` (tags and badge rows cascade
 * off the user).
 */

const ADMIN_URL = process.env.E2E_ADMIN_URL ?? 'http://localhost:5174';
const API = process.env.E2E_API_URL ?? 'http://localhost:5001';

const run = Date.now();
const STAFF_PASSWORD = 'e2e-staff-password';
const LEARNER_PASSWORD = 'e2e-learner-password';
const staffEmail = (role: string) => `e2e-badges-${run}-${role}@ladu.test`;

const account = (key: string, name: string): Account => ({
    name,
    username: `e2ebadge${run}${key}`,
    email: `e2e-badges-${run}-${key}@ladu.test`,
    password: LEARNER_PASSWORD,
});
// `author` gets the badge, `plain` never does, `reader` looks at the tags.
const accounts = {
    author: account('author', 'Badge Author'),
    plain: account('plain', 'Plain Author'),
    reader: account('reader', 'Badge Reader'),
};
const ids: Record<string, string> = {};
const tagIds: Record<string, string> = {};

// One search term that matches both of this run's tags, and nothing else on a shared dev DB.
const SEARCH = `e2e-badge-${run}`;
const LABEL = { official: `${SEARCH} from the badged author`, plain: `${SEARCH} from the plain author` };

const GRANT_REASON = 'Ladu team account (e2e)';
const REVOKE_REASON = 'Left the team (e2e)';
const SEAL = 'Official Ladu account';
const RESERVED_USERNAME = `Ladu ${run}`;

// The steps share rows and each one builds on the one before.
test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
    await createStaffAccount(staffEmail('owner'), 'owner', STAFF_PASSWORD);
    await createStaffAccount(staffEmail('admin'), 'admin', STAFF_PASSWORD);
    for (const [key, who] of Object.entries(accounts)) {
        const { userId } = await seedUser(who.email, { name: who.name, username: who.username, learnerPassword: LEARNER_PASSWORD });
        ids[key] = userId;
    }
    tagIds.official = await seedTag(ids.author, LABEL.official, 'Public');
    tagIds.plain = await seedTag(ids.plain, LABEL.plain, 'Public');
});

test.afterAll(async () => {
    await deleteUsersByEmail(Object.values(accounts).map((who) => who.email));
    await deleteStaffByEmail([staffEmail('owner'), staffEmail('admin')]);
    await closePool();
});

// --- helpers -------------------------------------------------------------------------------------

async function staffSignIn(page: Page, role: 'owner' | 'admin', goTo: string) {
    await page.goto(`${ADMIN_URL}${goTo}`);
    await page.getByLabel('Email').fill(staffEmail(role));
    await page.getByLabel('Password').fill(STAFF_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
}

const badgeSection = (page: Page): Locator => page.getByRole('heading', { name: 'Badges' }).locator('xpath=ancestor::section[1]');

async function learnerToken(request: APIRequestContext, who: Account): Promise<string> {
    const res = await request.post(`${API}/api/users/login`, { data: { email: who.email, password: who.password } });
    expect(res.status()).toBe(200);
    return ((await res.json()) as { token: string }).token;
}

/** `PUT /api/users/updateUser` as the account itself. The body needs the account's own email. */
const renameTo = (request: APIRequestContext, token: string, who: Account, username: string) =>
    request.put(`${API}/api/users/updateUser`, { headers: { Authorization: `Bearer ${token}` }, data: { email: who.email, username } });

const card = (page: Page, label: string): Locator =>
    page.locator('article.tagcard').filter({ has: page.getByRole('link', { name: `Open ${label}` }) });

const seal = (scope: Page | Locator): Locator => scope.getByRole('img', { name: SEAL });

const verifiedBox = (page: Page): Locator => page.getByRole('checkbox', { name: 'Verified' });

/** Opens the Discover tab as the reader and narrows the list to this run's two tags. */
async function openDiscover(page: Page, query = '') {
    await page.goto(`/tags?scope=discover${query}`);
    await page.getByRole('textbox', { name: 'Search tags' }).fill(SEARCH);
}

// --- the story -----------------------------------------------------------------------------------

test.describe('Account badges', () => {
    test('only the owner may grant: an admin sees the list but no buttons, and the API answers 403', async ({ page, request }) => {
        await staffSignIn(page, 'admin', `/users/${ids.author}`);
        await expect(page.getByRole('heading', { name: accounts.author.name })).toBeVisible();

        const section = badgeSection(page);
        await expect(section.getByText('This account has no badge.')).toBeVisible();
        await expect(section.getByRole('button')).toHaveCount(0);

        // The API refuses too: hiding a button is not the lock.
        const login = await request.post(`${API}/api/admin/auth/login`, { data: { email: staffEmail('admin'), password: STAFF_PASSWORD } });
        const { token } = (await login.json()) as { token: string };
        const refused = await request.post(`${API}/api/admin/users/${ids.author}/badges`, {
            headers: { Authorization: `Bearer ${token}` },
            data: { type: 'official', reason: 'not allowed' },
        });
        expect(refused.status()).toBe(403);
        expect(await getBadgeRows(ids.author)).toEqual([]);
    });

    test('the owner grants the official badge with a reason, and it is recorded', async ({ page }) => {
        await staffSignIn(page, 'owner', `/users/${ids.author}`);
        await expect(page.getByRole('heading', { name: accounts.author.name })).toBeVisible();

        await badgeSection(page).getByRole('button', { name: 'Grant badge' }).click();
        const dialog = page.getByRole('dialog');
        // A reason is required: the confirm button stays disabled without one.
        await expect(dialog.getByRole('button', { name: 'Grant badge' })).toBeDisabled();
        await dialog.getByLabel(/Reason/).fill(GRANT_REASON);
        await dialog.getByRole('button', { name: 'Grant badge' }).click();
        await expect(dialog).toHaveCount(0);

        await expect(page.getByRole('status')).toHaveText('The Official badge is granted.');
        const section = badgeSection(page);
        await expect(section.getByText('Official', { exact: true })).toBeVisible();
        await expect(section.getByText(/Granted .* by E2E owner/)).toBeVisible();
        // Every type is on the account now, so there is nothing left to grant.
        await expect(section.getByRole('button', { name: 'Grant badge' })).toHaveCount(0);

        // The audit history (an owner may read it) shows the action and its reason.
        await expect(page.getByText('badge.grant', { exact: true })).toBeVisible();
        await expect(page.getByText(`Reason: ${GRANT_REASON}`, { exact: true })).toBeVisible();

        expect(await getBadgeRows(ids.author)).toEqual([{ type: 'official', revoked: false }]);
        const audit = (await getAuditForUser(ids.author)).filter((row) => row.action === 'badge.grant');
        expect(audit).toHaveLength(1);
        expect(audit[0]).toMatchObject({ reason: GRANT_REASON, metadata: { badge: 'official', username: accounts.author.username } });
    });

    test('the reader sees the seal on the card and on the tag page, and none on a plain author', async ({ page }) => {
        await signIn(page, accounts.reader);
        await openDiscover(page);

        await expect(card(page, LABEL.official)).toBeVisible();
        await expect(card(page, LABEL.plain)).toBeVisible();
        await expect(seal(card(page, LABEL.official))).toBeVisible();
        await expect(seal(card(page, LABEL.plain))).toHaveCount(0);

        // Open the tag from its card: the seal is next to "by <author>".
        await page.getByRole('link', { name: `Open ${LABEL.official}` }).click();
        await expect(page).toHaveURL(new RegExp(`/tag/${tagIds.official}$`));
        await expect(page.getByRole('heading', { level: 1, name: LABEL.official })).toBeVisible();
        const by = page.locator('.t-by');
        await expect(by).toContainText(accounts.author.username);
        await expect(seal(by)).toBeVisible();

        // The plain author's tag page has no seal.
        await page.goto(`/tag/${tagIds.plain}`);
        await expect(page.getByRole('heading', { level: 1, name: LABEL.plain })).toBeVisible();
        await expect(page.locator('.t-by')).toContainText(accounts.plain.username);
        await expect(seal(page)).toHaveCount(0);
    });

    test('ticking "Verified" keeps only the badged author: in the URL, and it survives a reload', async ({ page }) => {
        await signIn(page, accounts.reader);
        await openDiscover(page);
        await expect(card(page, LABEL.plain)).toBeVisible();
        await expect(card(page, LABEL.official)).toBeVisible();

        await verifiedBox(page).click();

        await expect(page).toHaveURL(/badge=official/);
        await expect(card(page, LABEL.plain)).toHaveCount(0);
        await expect(card(page, LABEL.official)).toBeVisible();
        await expect(page.getByText('1 of 1 tags')).toBeVisible();

        // The filter is part of the URL, so a reload keeps it. (The search box is local state, so type it again.)
        await page.reload();
        await expect(verifiedBox(page)).toBeChecked();
        await page.getByRole('textbox', { name: 'Search tags' }).fill(SEARCH);
        await expect(card(page, LABEL.official)).toBeVisible();
        await expect(card(page, LABEL.plain)).toHaveCount(0);

        // Unticking brings the other author back, and removes the parameter.
        await verifiedBox(page).click();
        await expect(card(page, LABEL.plain)).toBeVisible();
        await expect(page).not.toHaveURL(/badge=/);
    });

    test('an account with the official badge may take a reserved name', async ({ request }) => {
        const token = await learnerToken(request, accounts.author);

        const taken = await renameTo(request, token, accounts.author, RESERVED_USERNAME);
        expect(taken.status()).toBe(200);
        expect(((await taken.json()) as { username: string }).username).toBe(RESERVED_USERNAME);

        // Back to the original name, so later steps find the author by it.
        const back = await renameTo(request, token, accounts.author, accounts.author.username);
        expect(back.status()).toBe(200);
    });

    test('the owner revokes the badge with a reason: the row stays, and it is recorded', async ({ page }) => {
        await staffSignIn(page, 'owner', `/users/${ids.author}`);
        await expect(page.getByRole('heading', { name: accounts.author.name })).toBeVisible();

        await badgeSection(page).getByRole('button', { name: 'Revoke the Official badge' }).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog.getByRole('button', { name: 'Revoke badge' })).toBeDisabled();
        await dialog.getByLabel(/Reason/).fill(REVOKE_REASON);
        await dialog.getByRole('button', { name: 'Revoke badge' }).click();
        await expect(dialog).toHaveCount(0);

        await expect(page.getByRole('status')).toHaveText('The Official badge is revoked.');
        await expect(badgeSection(page).getByText('This account has no badge.')).toBeVisible();
        await expect(page.getByText('badge.revoke', { exact: true })).toBeVisible();
        await expect(page.getByText(`Reason: ${REVOKE_REASON}`, { exact: true })).toBeVisible();

        // The row is kept, with `revoked_at` set: the history stays.
        expect(await getBadgeRows(ids.author)).toEqual([{ type: 'official', revoked: true }]);
        const actions = (await getAuditForUser(ids.author)).map((row) => row.action).filter((action) => action.startsWith('badge.'));
        expect(actions).toEqual(['badge.grant', 'badge.revoke']);
    });

    test('after the revoke the reader sees no seal and an empty "Verified" list, on the same session', async ({ page }) => {
        await signIn(page, accounts.reader);

        // The Verified list: this run's search finds nothing, so the page says so.
        await page.goto('/tags?scope=discover&badge=official');
        await page.getByRole('textbox', { name: 'Search tags' }).fill(SEARCH);
        await expect(page.getByText('No verified tags match')).toBeVisible();

        // "Show all tags" clears the filter. Both tags are back, and neither has a seal.
        await page.getByRole('button', { name: 'Show all tags' }).click();
        await expect(page).not.toHaveURL(/badge=/);
        await expect(card(page, LABEL.official)).toBeVisible();
        await expect(card(page, LABEL.plain)).toBeVisible();
        await expect(seal(card(page, LABEL.official))).toHaveCount(0);

        // The tag page shows no seal either.
        await page.goto(`/tag/${tagIds.official}`);
        await expect(page.getByRole('heading', { level: 1, name: LABEL.official })).toBeVisible();
        await expect(seal(page)).toHaveCount(0);
    });

    test('with no badge, a reserved name is refused: for the author on the API, and for the reader in the account form', async ({ page, request }) => {
        // The author lost the exemption with the badge.
        const authorToken = await learnerToken(request, accounts.author);
        const refused = await renameTo(request, authorToken, accounts.author, RESERVED_USERNAME);
        expect(refused.status()).toBe(400);
        expect(await refused.json()).toEqual({ message: 'This username is not available', code: 'username_reserved' });

        // The reader tries a look-alike ("0" for "o") in the real account form.
        await signIn(page, accounts.reader);
        await page.goto('/user');
        await page.getByRole('button', { name: /edit profile/i }).click();
        await page.getByLabel(/^Username/).fill('Ladu 0fficial');
        await page.getByRole('button', { name: 'Save' }).click();
        await expect(page.getByText('That username is not available. Please choose another.')).toBeVisible();

        // Nothing changed.
        const readerToken = await learnerToken(request, accounts.reader);
        const me = await request.get(`${API}/api/users/me`, { headers: { Authorization: `Bearer ${readerToken}` } });
        expect(((await me.json()) as { username: string }).username).toBe(accounts.reader.username);
    });
});
