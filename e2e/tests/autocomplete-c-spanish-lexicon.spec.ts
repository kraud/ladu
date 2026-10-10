import { test, expect, type Page } from '@playwright/test';
import { clickUseValues } from '../fixtures/autocomplete';
import { closePool, deleteUsersByEmail } from '../fixtures/db';
import { createdEmails, registerAndVerify, signIn, type Account } from '../fixtures/practice';

/**
 * Spanish autocomplete from the local lexicon (`.context/plans/autocomplete-data-source-strategy.md`
 * Slice C1 gate). The `lexemes` table holds the committed Spanish fixture in CI (loaded by the e2e
 * backend command, `--if-empty`), or the full lexicon locally. Every word below is in both, except
 * "abarrancar", which is in neither.
 *
 *  1. A stem-changing verb ("sentir") is conjugated right (the old library said "sento") and is
 *     irregular (decision D16).
 *  2. 2nd person is labelled Tú / Ustedes and filled with the tú and ustedes forms (decision D10);
 *     the gerund fills too (the old library had none).
 *  3. A noun the old library gave the wrong gender ("leche") is feminine, with its plural.
 *  4. A verb the lexicon does not have falls back to the library, marked as a guess.
 *
 * Nothing is saved: the subject is the lookup.
 */

test.afterAll(async () => {
    await deleteUsersByEmail(createdEmails);
    await closePool();
});

const guessNotice = (page: Page) => page.getByText("We're not fully sure, but here's our best guess.");

/** New word → part of speech → the Spanish card. */
async function openSpanish(page: Page, partOfSpeech: RegExp): Promise<void> {
    await page.goto('/addWord');
    await expect(page.getByRole('heading', { name: 'New word' })).toBeVisible();
    await page.getByRole('radio', { name: partOfSpeech }).click();
    await page.getByRole('button', { name: 'Español' }).click();
}

test.describe.serial('Autocomplete — Spanish from the lexicon (Slice C1)', () => {
    let user: Account;

    test.beforeAll(async ({ request }) => {
        user = await registerAndVerify(request, 'Spanish Lexicon User', ['English', 'Spanish']);
    });

    test.beforeEach(async ({ page }) => {
        await signIn(page, user);
    });

    test('a stem-changing verb is conjugated right and marked irregular', async ({ page }) => {
        await openSpanish(page, /Verb/);
        await page.getByLabel('Infinitive non-finite simple').fill('sentir');

        await clickUseValues(page);
        // The first "Yo" field is the present tense.
        await expect(page.getByLabel('Yo').first()).toHaveValue('siento');
        await expect(page.getByLabel('Gerund non-finite simple')).toHaveValue('sintiendo');
        await expect(page.getByRole('radio', { name: 'irregular', exact: true })).toBeChecked();
        await expect(guessNotice(page)).toHaveCount(0);
    });

    test('2nd person is Tú and Ustedes, filled with the tú and ustedes forms', async ({ page }) => {
        await openSpanish(page, /Verb/);
        await page.getByLabel('Infinitive non-finite simple').fill('bailar');

        await clickUseValues(page);
        await expect(page.getByLabel('Tú').first()).toHaveValue('bailas');
        await expect(page.getByLabel('Ustedes').first()).toHaveValue('bailan');
        await expect(page.getByLabel('Gerund non-finite simple')).toHaveValue('bailando');
        await expect(page.getByLabel('Vos')).toHaveCount(0);
    });

    test('a noun gets the right gender and its plural', async ({ page }) => {
        await openSpanish(page, /Noun/);
        await page.getByLabel('Singular', { exact: true }).fill('leche');

        await clickUseValues(page);
        await expect(page.getByRole('radio', { name: 'la', exact: true })).toBeChecked();
        await expect(page.getByLabel('Plural', { exact: true })).toHaveValue('leches');
    });

    test('a verb not in the lexicon falls back to the library, marked as a guess', async ({ page }) => {
        await openSpanish(page, /Verb/);
        await page.getByLabel('Infinitive non-finite simple').fill('abarrancar');

        await expect(guessNotice(page)).toBeVisible();
        await clickUseValues(page);
        await expect(page.getByText('Autocomplete values applied')).toBeVisible();
        await expect(guessNotice(page)).toBeVisible();
    });
});
