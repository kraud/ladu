import { test, expect, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import { closePool, deleteUsersByEmail, getVerifyToken } from '../fixtures/db';

/**
 * Phase 4 — tags, against the real stack (`.context/plans/phase-4-tags.md`
 * Slice 9 gate).
 *
 * Two accounts, two browser contexts (the same "separate device" pattern
 * `phase-3-9-theme.spec.ts` already established) held open side by side for
 * the whole run, so each half of the story is exercised through the real UI
 * exactly as a person would live it, not replayed from a fixture:
 *
 *  - User A creates a tag through `TagFormDialog`'s "Add words now" picker
 *    (D18), attaching two already-owned words at the tag's own creation
 *    time, then bulk-adds the same tag to a third word from Review (D5/D17).
 *  - User B discovers the Public tag, follows it, and sees all three words
 *    in their own Review list, read-only (the "from a followed tag" owner
 *    dot, D10).
 *  - A flips the tag to Private -> B's Review loses the words immediately
 *    and `/tags` marks it Unavailable (D9) -> A flips it back to Public ->
 *    B's access returns on its own, with no re-follow action (D9).
 *  - B clones a *different* Public tag of A's instead, landing on an
 *    independent, editable copy (D11) — word-count and follower badges are
 *    checked at each step along the way, not just at the end.
 *
 * Word creation itself (the form engine, autocomplete, case validation) is
 * already covered by `phase-2-noun-crud.spec.ts`/`phase-3-review.spec.ts`;
 * the four words this spec needs are seeded directly via the API so the run
 * stays focused on the tag flows Phase 4 actually adds.
 *
 * Runs against `keelapp_v2_dev`. Uses unique `e2e-*@ladu.test` emails and
 * deletes both accounts in `afterAll` — `words`/`tags`/`tag_words`/
 * `user_following_tags` all cascade off the `users` row
 * (`backend/src/db/schema.ts`).
 */

const API = process.env.E2E_API_URL ?? 'http://localhost:5001';

const run = Date.now();
let seq = 0;
const uniqueEmail = () => `e2e-${run}-${++seq}@ladu.test`;
const createdEmails: string[] = [];

interface Account {
    name: string;
    username: string;
    email: string;
    password: string;
}

/** Registers + verifies a user directly via the API (no UI, no SMTP wait) — login still goes through the real form. */
async function registerAndVerify(request: APIRequestContext, name: string, languages: string[]): Promise<Account> {
    const account: Account = {
        name,
        username: `tag${run}${++seq}`,
        email: uniqueEmail(),
        password: 'password123',
    };
    createdEmails.push(account.email);

    const res = await request.post(`${API}/api/users`, {
        data: { ...account, languages, uiLanguage: 'English' },
    });
    expect(res.status()).toBe(201);

    const { userId, token } = await getVerifyToken(account.email);
    const verifyRes = await request.get(`${API}/api/users/${userId}/verify/${token}`);
    expect(verifyRes.ok()).toBeTruthy();

    return account;
}

async function loginForToken(request: APIRequestContext, account: Account): Promise<string> {
    const res = await request.post(`${API}/api/users/login`, {
        data: { email: account.email, password: account.password },
    });
    expect(res.ok()).toBeTruthy();
    const { token } = (await res.json()) as { token: string };
    return token;
}

/** Seeds a two-language noun directly via the API — only the headline (English) word matters to this spec. */
async function createNoun(
    request: APIRequestContext,
    token: string,
    englishWord: string,
    germanWord: string,
): Promise<string> {
    const res = await request.post(`${API}/api/words`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
            partOfSpeech: 'Noun',
            translations: [
                { language: 'English', cases: [{ caseName: 'singularEN', word: englishWord }] },
                {
                    language: 'German',
                    cases: [
                        { caseName: 'genderDE', word: 'der' },
                        { caseName: 'singularNominativDE', word: germanWord },
                    ],
                },
            ],
        },
    });
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { id: string };
    return body.id;
}

async function createPublicTag(
    request: APIRequestContext,
    token: string,
    label: string,
    wordIds: string[],
): Promise<string> {
    const res = await request.post(`${API}/api/tags`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { label, visibility: 'Public', wordIds },
    });
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { id: string };
    return body.id;
}

async function signIn(page: Page, account: Account): Promise<void> {
    await page.goto('/login');
    await page.getByLabel('Email').fill(account.email);
    await page.getByLabel('Password').fill(account.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('heading', { name: new RegExp(`Welcome, ${account.name}`) })).toBeVisible();
}

/** A browser profile of its own — no shared storage, like a second device (matches `phase-3-9-theme.spec.ts`). */
async function freshPage(browser: Browser): Promise<Page> {
    const context = await browser.newContext();
    return context.newPage();
}

/** The `/tags` card for one label, scoped so an action button click can't land on a different card. */
function tagCard(page: Page, label: string) {
    return page.locator('.tagcard', { hasText: label });
}

async function setScope(page: Page, scope: 'All' | 'Owned' | 'Followed' | 'Discover'): Promise<void> {
    await page.getByRole('button', { name: scope, exact: true }).click();
    await expect(page.getByRole('button', { name: scope, exact: true })).toHaveAttribute('aria-pressed', 'true');
}

test.afterAll(async () => {
    await deleteUsersByEmail(createdEmails);
    await closePool();
});

test.describe.serial('Phase 4 — tags', () => {
    let owner: Account;
    let follower: Account;

    test.beforeAll(async ({ request }) => {
        owner = await registerAndVerify(request, 'Tag Owner', ['English', 'German']);
        follower = await registerAndVerify(request, 'Tag Follower', ['English', 'German']);

        // Word creation itself is already covered elsewhere (see file header) —
        // seeded directly via the API so this run stays focused on tag flows.
        // Only the English headline words are asserted on later, so the
        // generated ids don't need to be kept.
        const ownerToken = await loginForToken(request, owner);
        await createNoun(request, ownerToken, 'Apple', 'Apfel');
        await createNoun(request, ownerToken, 'Banana', 'Banane');
        await createNoun(request, ownerToken, 'Carrot', 'Karotte');
        const cuminId = await createNoun(request, ownerToken, 'Cumin', 'Kreuzkümmel');
        await createPublicTag(request, ownerToken, 'Spices', [cuminId]);
    });

    test('A creates a tag, bulk-adds it from Review; B discovers, follows, keeps read-only access through a Private/Public flip, then clones a different tag', async ({
        browser,
    }) => {
        const pageA = await freshPage(browser);
        const pageB = await freshPage(browser);

        await test.step('A signs in', async () => {
            await signIn(pageA, owner);
        });

        await test.step('A creates "Kitchen Words" with two words attached at creation time (D18)', async () => {
            await pageA.getByRole('link', { name: 'tags' }).click();
            await expect(pageA).toHaveURL('/tags');

            await pageA.getByRole('button', { name: 'New tag' }).click();
            const dialog = pageA.getByRole('dialog');
            await expect(dialog.getByRole('heading', { name: 'New tag' })).toBeVisible();

            await dialog.getByLabel('Label').fill('Kitchen Words');
            // Visibility defaults to Public — left untouched so B can discover it later.

            const wordSearch = dialog.getByLabel('Search your words to add now');
            await wordSearch.fill('Apple');
            await dialog.getByRole('row', { name: /Apple/ }).click();
            await expect(dialog.getByText('1 selected')).toBeVisible();

            await dialog.getByRole('button', { name: 'Clear search' }).click();
            await wordSearch.fill('Banana');
            await dialog.getByRole('row', { name: /Banana/ }).click();
            await expect(dialog.getByText('2 selected')).toBeVisible();

            await dialog.getByRole('button', { name: 'Create tag' }).click();
            await expect(pageA.getByText('Tag "Kitchen Words" created')).toBeVisible();

            const card = tagCard(pageA, 'Kitchen Words');
            await expect(card).toBeVisible();
            await expect(card.locator('.num').nth(0)).toHaveText('2'); // word count
        });

        await test.step('A bulk-adds the tag to a third word from Review (D5/D17)', async () => {
            await pageA.getByRole('link', { name: 'words', exact: true }).click();
            await expect(pageA).toHaveURL('/words');

            await pageA.getByRole('row', { name: /Carrot/ }).getByRole('checkbox').click();
            await pageA.getByRole('button', { name: 'Add tags', exact: true }).click();

            const dialog = pageA.getByRole('dialog');
            await expect(dialog.getByRole('heading', { name: 'Add tags to 1 word' })).toBeVisible();
            await dialog.getByLabel('Search tags to add…').fill('Kitchen');
            // The combobox popover is portaled to <body> (base-ui ComboboxContent),
            // so it is no longer a descendant of the dialog — scope to the page instead.
            await pageA.getByRole('option', { name: 'Kitchen Words', exact: true }).click();
            await dialog.getByRole('button', { name: 'Apply' }).click();

            await expect(pageA.getByText('Tag added to 1 word')).toBeVisible();
            await expect(pageA.getByRole('row', { name: /Carrot/ }).getByText('Kitchen Words')).toBeVisible();
        });

        await test.step('B signs in and follows "Kitchen Words" from Discover', async () => {
            await signIn(pageB, follower);
            await pageB.getByRole('link', { name: 'tags' }).click();
            await expect(pageB).toHaveURL('/tags');

            await setScope(pageB, 'Discover');
            await pageB.getByLabel('Search tags').fill('Kitchen Words');
            const card = tagCard(pageB, 'Kitchen Words');
            await expect(card).toBeVisible();

            await card.getByRole('button', { name: 'Follow', exact: true }).click();
            await expect(pageB.getByText('You\'re now following "Kitchen Words"')).toBeVisible();
        });

        await test.step("B sees all three words in Review, read-only (owner dot as group, D10)", async () => {
            await pageB.getByRole('link', { name: 'words', exact: true }).click();
            await expect(pageB).toHaveURL('/words');

            for (const word of ['Apple', 'Banana', 'Carrot']) {
                const row = pageB.getByRole('row', { name: new RegExp(word) });
                await expect(row).toBeVisible();
                await expect(row.locator('.owner-group')).toBeVisible();
            }
        });

        await test.step('A flips the tag to Private (D9) — the follower count already reflects B', async () => {
            await pageA.getByRole('link', { name: 'tags' }).click();
            await expect(pageA).toHaveURL('/tags');

            const card = tagCard(pageA, 'Kitchen Words');
            await expect(card.locator('.num').nth(0)).toHaveText('3'); // word count, after the bulk add
            await expect(card.locator('.num').nth(1)).toHaveText('1'); // follower count, B followed it

            await card.getByRole('button', { name: 'Edit' }).click();
            const dialog = pageA.getByRole('dialog');
            await dialog.getByRole('radio', { name: /^Private/ }).click();
            await dialog.getByRole('button', { name: 'Save changes' }).click();
            await expect(pageA.getByText('"Kitchen Words" updated')).toBeVisible();
        });

        await test.step("B's Review loses the words; /tags marks the tag Unavailable", async () => {
            await pageB.reload();
            for (const word of ['Apple', 'Banana', 'Carrot']) {
                await expect(pageB.getByRole('row', { name: new RegExp(word) })).not.toBeVisible();
            }

            await pageB.getByRole('link', { name: 'tags' }).click();
            await expect(pageB).toHaveURL('/tags');
            const card = tagCard(pageB, 'Kitchen Words');
            await expect(card.getByText('Unavailable')).toBeVisible();
            await expect(card.getByRole('button', { name: 'Unfollow' })).toBeVisible();
            await expect(card.getByRole('button', { name: 'Follow', exact: true })).toHaveCount(0);
        });

        await test.step('A flips the tag back to Public', async () => {
            await pageA.getByRole('link', { name: 'tags' }).click();
            const card = tagCard(pageA, 'Kitchen Words');
            await card.getByRole('button', { name: 'Edit' }).click();
            const dialog = pageA.getByRole('dialog');
            await dialog.getByRole('radio', { name: /^Public/ }).click();
            await dialog.getByRole('button', { name: 'Save changes' }).click();
            await expect(pageA.getByText('"Kitchen Words" updated')).toBeVisible();
        });

        await test.step("B's access returns automatically — no re-follow needed", async () => {
            await pageB.getByRole('link', { name: 'words', exact: true }).click();
            for (const word of ['Apple', 'Banana', 'Carrot']) {
                await expect(pageB.getByRole('row', { name: new RegExp(word) })).toBeVisible();
            }

            await pageB.getByRole('link', { name: 'tags' }).click();
            const card = tagCard(pageB, 'Kitchen Words');
            await expect(card.getByText('Followed', { exact: true })).toBeVisible();
            await expect(card.getByRole('button', { name: 'Follow', exact: true })).toHaveCount(0);
        });

        await test.step('B clones a different Public tag of A\'s ("Spices") into an independent copy (D11)', async () => {
            await expect(tagCard(pageB, 'Kitchen Words')).toBeVisible(); // still on /tags, All scope
            await setScope(pageB, 'Discover');
            await pageB.getByLabel('Search tags').fill('Spices');
            const discoverCard = tagCard(pageB, 'Spices');
            await expect(discoverCard).toBeVisible();

            await discoverCard.getByRole('button', { name: 'Clone' }).click();
            const dialog = pageB.getByRole('dialog');
            await expect(dialog.getByRole('heading', { name: 'Clone this tag' })).toBeVisible();
            await dialog.getByRole('button', { name: 'Create copy' }).click();
            await expect(pageB.getByText('Copy of "Spices" created')).toBeVisible();

            await setScope(pageB, 'Owned');
            const ownedCard = tagCard(pageB, 'Spices');
            await expect(ownedCard).toBeVisible();
            await expect(ownedCard.getByText('Cloned from')).toBeVisible();
            await expect(ownedCard.locator('.num').nth(0)).toHaveText('1'); // same word count as the source
        });

        await pageA.context().close();
        await pageB.context().close();
    });
});
