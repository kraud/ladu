import { test, expect, type Page } from '@playwright/test';
import { clickUseValues } from '../fixtures/autocomplete';
import { closePool, deleteUsersByEmail } from '../fixtures/db';
import { createdEmails, registerAndVerify, signIn, type Account } from '../fixtures/practice';

/**
 * Reflexive verbs (`.context/research/autocomplete-data-source-strategy.md`, Slice H5 gate, decisions
 * D28–D33). The `lexemes` table holds the committed fixtures in CI, or the full lexicon locally; every
 * word below is in both.
 *
 *  1. The German values are saved with the word and come back after a reload (also the new
 *     Prepositional box).
 *
 * Removed in the test prune pass (`.context/plans/test-prune-pass.md`): the five fill cases
 * (Spanish and German reflexive verbs) and the Spanish save. `backend/tests/dictionary.test.js` and
 * `AutocompleteRow.test.tsx` own them.
 */

test.afterAll(async () => {
    await deleteUsersByEmail(createdEmails);
    await closePool();
});

/** New word → Verb → the card for `language` (its native name). */
async function openVerbCard(page: Page, language: string): Promise<void> {
    await page.goto('/addWord');
    await expect(page.getByRole('heading', { name: 'New word' })).toBeVisible();
    await page.getByRole('radio', { name: /Verb/ }).click();
    await page.getByRole('button', { name: language }).click();
}

/** Types a whole word, then the button fills the card (`clickUseValues` closes the list first when the word is listed). */
async function typeAndFill(page: Page, fieldLabel: string, word: string): Promise<void> {
    await page.getByLabel(fieldLabel, { exact: true }).fill(word);
    await clickUseValues(page);
}

test.describe.serial('Autocomplete — reflexive verbs (Slice H5)', () => {
    let user: Account;

    test.beforeAll(async ({ request }) => {
        user = await registerAndVerify(request, 'Reflexive User', ['English', 'German', 'Spanish']);
    });

    test.beforeEach(async ({ page }) => {
        await signIn(page, user);
    });

    test('the German values and the Prepositional box are saved with the word and survive a reload', async ({ page }) => {
        await openVerbCard(page, 'Deutsch');
        await typeAndFill(page, 'Infinitive', 'sputen');
        await page.getByRole('checkbox', { name: 'Prepositional' }).check();
        await page.getByRole('radio', { name: /^Dative \(mir/ }).click();

        await page.getByRole('button', { name: 'English' }).click();
        await page.locator('input[name="simplePresent1s"]').fill('hurry');
        await page.getByRole('button', { name: 'Save' }).click();
        await expect(page.getByText('Word was created successfully')).toBeVisible();
        await page.getByRole('button', { name: 'Click here to see the new word' }).click();
        await expect(page).toHaveURL(/\/word\/.+/);

        await page.reload();
        await expect(page.getByText('Detailed view: Verb')).toBeVisible();
        await page.getByRole('button', { name: 'Edit' }).click();
        await expect(page.getByRole('radio', { name: 'Always reflexive' })).toBeChecked();
        await expect(page.getByRole('radio', { name: /^Dative \(mir/ })).toBeChecked();
        await expect(page.getByRole('checkbox', { name: 'Prepositional' })).toBeChecked();
        // "sputen" has no transitive tag: the autocomplete leaves the object boxes to the user.
        await expect(page.getByRole('checkbox', { name: 'Accusative', exact: true })).not.toBeChecked();
    });
});
