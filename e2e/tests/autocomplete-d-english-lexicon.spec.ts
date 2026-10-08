import { test, expect, type Page } from '@playwright/test';
import { closePool, deleteUsersByEmail } from '../fixtures/db';
import { createdEmails, registerAndVerify, signIn, type Account } from '../fixtures/practice';

/**
 * English autocomplete from the local lexicon, and no is-word gate
 * (`.context/plans/autocomplete-data-source-strategy.md` Slice C2 gate). The `lexemes` table holds
 * the committed English fixture in CI (`--if-empty`), or the full lexicon locally; "child" and
 * "can" are in both, "zorplate" in neither.
 *
 *  1. English nouns have autocomplete for the first time: an irregular plural fills.
 *  2. A modal verb is right (the old library said "caned"): main sense, decision D15 (refined).
 *  3. A made-up verb gets the library's rule-based guess, marked "not fully sure" (decision D17).
 *
 * Nothing is saved: the subject is the lookup.
 */

test.afterAll(async () => {
    await deleteUsersByEmail(createdEmails);
    await closePool();
});

const useValues = (page: Page) => page.getByRole('button', { name: 'Use autocomplete values' });
const guessNotice = (page: Page) => page.getByText("We're not fully sure, but here's our best guess.");

/** New word → part of speech → the English card. */
async function openEnglish(page: Page, partOfSpeech: RegExp): Promise<void> {
    await page.goto('/addWord');
    await expect(page.getByRole('heading', { name: 'New word' })).toBeVisible();
    await page.getByRole('radio', { name: partOfSpeech }).click();
    await page.getByRole('button', { name: 'English' }).click();
}

test.describe.serial('Autocomplete — English from the lexicon (Slice C2)', () => {
    let user: Account;

    test.beforeAll(async ({ request }) => {
        user = await registerAndVerify(request, 'English Lexicon User', ['English', 'German']);
    });

    test.beforeEach(async ({ page }) => {
        await signIn(page, user);
    });

    test('an English noun gets its plural', async ({ page }) => {
        await openEnglish(page, /Noun/);
        await page.getByLabel('Singular', { exact: true }).fill('child');

        await useValues(page).click();
        await expect(page.getByLabel('Plural', { exact: true })).toHaveValue('children');
        await expect(guessNotice(page)).toHaveCount(0);
    });

    test('a modal verb gets its real past tense', async ({ page }) => {
        await openEnglish(page, /Verb/);
        // "I" labels one field per tense: present, past, future, conditional. The first is the query field.
        await page.getByLabel('I', { exact: true }).first().fill('can');

        await useValues(page).click();
        await expect(page.getByLabel('I', { exact: true }).nth(1)).toHaveValue('could');
        await expect(guessNotice(page)).toHaveCount(0);
    });

    test('a made-up verb gets a rule-based guess, marked as one', async ({ page }) => {
        await openEnglish(page, /Verb/);
        await page.getByLabel('I', { exact: true }).first().fill('zorplate');

        await expect(guessNotice(page)).toBeVisible();
        await useValues(page).click();
        await expect(page.getByLabel('He/She/it').first()).toHaveValue('zorplates');
        await expect(guessNotice(page)).toBeVisible();
    });
});
