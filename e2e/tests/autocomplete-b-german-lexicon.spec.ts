import { test, expect, type Page } from '@playwright/test';
import { closePool, deleteUsersByEmail } from '../fixtures/db';
import { createdEmails, registerAndVerify, signIn, type Account } from '../fixtures/practice';

/**
 * German autocomplete from the local lexicon (`.context/plans/autocomplete-data-source-strategy.md`
 * Slice B2 gate). The `lexemes` table holds the committed 44-word German fixture in CI (loaded by
 * the e2e backend command in playwright.config.ts, `--if-empty`), or the full lexicon locally.
 * Every word below is in both.
 *
 *  1. A noun today's library cannot decline ("Polizei") fills from the lexicon.
 *  2. A "sein" verb ("gehen") gets the right auxiliary and its regularity.
 *  3. A homograph ("See": der See / die See) gets its main sense (decision D15).
 *  4. A verb the lexicon does not have ("abkleben") falls back to the library, marked as a guess.
 *
 * Nothing is saved: the subject is the lookup.
 */

test.afterAll(async () => {
    await deleteUsersByEmail(createdEmails);
    await closePool();
});

const useValues = (page: Page) => page.getByRole('button', { name: 'Use autocomplete values' });
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

        await useValues(page).click();
        await expect(page.getByRole('radio', { name: 'die', exact: true })).toBeChecked();
        await expect(page.getByLabel('Plural nominative')).toHaveValue('Polizeien');
        await expect(guessNotice(page)).toHaveCount(0);
    });

    test('a "sein" verb gets its auxiliary and regularity', async ({ page }) => {
        await openGerman(page, /Verb/);
        await page.getByLabel('Infinitive').fill('gehen');

        await useValues(page).click();
        await expect(page.getByRole('radiogroup', { name: 'Auxiliary verb' }).getByRole('radio', { name: 'sein' })).toBeChecked();
        await expect(page.getByRole('radio', { name: 'irregular', exact: true })).toBeChecked();
        await expect(guessNotice(page)).toHaveCount(0);
    });

    test('a homograph gets its main sense: der See', async ({ page }) => {
        await openGerman(page, /Noun/);
        await page.getByLabel('Singular nominative').fill('See');

        await useValues(page).click();
        await expect(page.getByRole('radio', { name: 'der', exact: true })).toBeChecked();
        await expect(page.getByLabel('Plural nominative')).toHaveValue('Seen');
    });

    test('a verb not in the lexicon falls back to the library, marked as a guess', async ({ page }) => {
        await openGerman(page, /Verb/);
        await page.getByLabel('Infinitive').fill('abkleben');

        await expect(guessNotice(page)).toBeVisible();
        await useValues(page).click();
        await expect(page.getByText('Autocomplete values applied')).toBeVisible();
        await expect(guessNotice(page)).toBeVisible();
    });
});
