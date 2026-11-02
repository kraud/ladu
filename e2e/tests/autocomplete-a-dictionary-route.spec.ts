import { EKI_STUB_URL } from '../fixtures/env';
import { test, expect, type Page } from '@playwright/test';
import { clickUseValues } from '../fixtures/autocomplete';
import { closePool, deleteUsersByEmail } from '../fixtures/db';
import { createdEmails, registerAndVerify, signIn, type Account } from '../fixtures/practice';

/**
 * Autocomplete through the one dictionary route — `GET /api/dictionary/:language/:pos/:query`
 * (`.context/research/autocomplete-data-source-strategy.md` Slice A, step A3 gate).
 *
 * A signed-in user opens New word, picks a part of speech and one language, types the base
 * form, and uses the autocomplete values. Nothing is saved: the subject is the lookup.
 *
 *  1. German noun: gender and declension fill in.
 *  2. Estonian adjective (Ekilex adapter, answered by the local stub): the plural fills in,
 *     and the stub received "väike" URL-encoded as UTF-8.
 *
 * Removed in the test prune pass (`.context/plans/test-prune-pass.md`): the Spanish verb,
 * the Spanish noun guess and the unknown Estonian word. `backend/tests/dictionary.test.js` and
 * `TranslationCard.test.tsx` own them.
 *
 * The Estonian case needs the e2e backend to use the stub. playwright.config.ts passes the stub
 * address, and the values of the repo-root .env do not override it (LADU_KEEP_PROCESS_ENV).
 */


test.afterAll(async () => {
    await deleteUsersByEmail(createdEmails);
    await closePool();
});

/** New word → part of speech → one language card. */
async function openNewWord(page: Page, partOfSpeech: RegExp, language: string): Promise<void> {
    await page.goto('/addWord');
    await expect(page.getByRole('heading', { name: 'New word' })).toBeVisible();
    await page.getByRole('radio', { name: partOfSpeech }).click();
    await page.getByRole('button', { name: language }).click();
}

test.describe.serial('Autocomplete — one dictionary route (Slice A)', () => {
    let user: Account;

    test.beforeAll(async ({ request }) => {
        user = await registerAndVerify(request, 'Autocomplete User', ['English', 'Spanish', 'German', 'Estonian']);
    });

    test.beforeEach(async ({ page }) => {
        await signIn(page, user);
    });

    test('German noun: gender and declension fill in', async ({ page }) => {
        await openNewWord(page, /Noun/, 'Deutsch');
        await page.getByLabel('Singular nominative').fill('Haus');

        await clickUseValues(page);
        await expect(page.getByRole('radio', { name: 'das', exact: true })).toBeChecked();
        await expect(page.getByLabel('Plural nominative')).toHaveValue('Häuser');
        await expect(page.getByLabel('Plural dative')).toHaveValue('Häusern');
        await expect(page.getByText('Autocomplete values applied')).toBeVisible();
    });

    // An adjective: Estonian adjectives always go to Ekilex (the local lexicon has none since Slice D2), so this
    // reaches the stub on every machine — a noun like "õun" may now be answered by a local full lexicon.
    test('Estonian adjective through the stub dictionary: the plural fills in, and the word reaches the service URL-encoded', async ({
        page,
        request,
    }) => {
        const before = ((await (await request.get(`${EKI_STUB_URL}/__requests`)).json()) as unknown[]).length;

        await openNewWord(page, /Adjective/, 'Eesti');
        await page.getByLabel('Positive degree').fill('väike');

        await clickUseValues(page);
        await expect(page.getByLabel('Plural nominative')).toHaveValue('väikesed');

        const received = ((await (await request.get(`${EKI_STUB_URL}/__requests`)).json()) as { rawPath: string }[]).slice(before);
        expect(received, 'the backend did not call the stub — is a backend with another environment running on the e2e API port?').toContainEqual(
            expect.objectContaining({ rawPath: '/api/word/ids/v%C3%A4ike/eki/est' }),
        );
    });

});
