import { test, expect, type Page } from '@playwright/test';
import { clickUseValues } from '../fixtures/autocomplete';
import { closePool, deleteUsersByEmail } from '../fixtures/db';
import { createdEmails, registerAndVerify, signIn, type Account } from '../fixtures/practice';

/**
 * German autocomplete from the local lexicon (`.context/research/autocomplete-data-source-strategy.md`
 * Slice B2 gate). The `lexemes` table holds the committed 44-word German fixture in CI (loaded by
 * the e2e backend command in playwright.config.ts, `--if-empty`), or the full lexicon locally.
 * Every word below is in both.
 *
 *  1. A noun today's library cannot decline ("Polizei") fills from the lexicon.
 *
 * Removed in the test prune pass (`.context/plans/test-prune-pass.md`): the "sein" verb,
 * the homograph and the library fallback. `backend/tests/dictionary.test.js` owns them.
 *
 * Nothing is saved: the subject is the lookup.
 */

test.afterAll(async () => {
    await deleteUsersByEmail(createdEmails);
    await closePool();
});

const guessNotice = (page: Page) => page.getByText("We're not fully sure, but here's our best guess.");

/** New word → part of speech → the German card. */
async function openGerman(page: Page, partOfSpeech: RegExp): Promise<void> {
    await page.goto('/addWord');
    await expect(page.getByRole('heading', { name: 'New word' })).toBeVisible();
    await page.getByRole('radio', { name: partOfSpeech }).click();
    await page.getByRole('button', { name: 'Deutsch' }).click();
}

test.describe.serial('Autocomplete — German from the lexicon (Slice B2)', () => {
    let user: Account;

    test.beforeAll(async ({ request }) => {
        user = await registerAndVerify(request, 'Lexicon User', ['English', 'German']);
    });

    test.beforeEach(async ({ page }) => {
        await signIn(page, user);
    });

    test('a noun the old library could not decline fills from the lexicon', async ({ page }) => {
        await openGerman(page, /Noun/);
        await page.getByLabel('Singular nominative').fill('Polizei');

        await clickUseValues(page);
        await expect(page.getByRole('radio', { name: 'die', exact: true })).toBeChecked();
        await expect(page.getByLabel('Plural nominative')).toHaveValue('Polizeien');
        await expect(guessNotice(page)).toHaveCount(0);
    });

});
