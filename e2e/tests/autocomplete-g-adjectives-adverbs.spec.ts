import { test, expect, type Page } from '@playwright/test';
import { clickUseValues } from '../fixtures/autocomplete';
import { closePool, deleteUsersByEmail } from '../fixtures/db';
import { createdEmails, registerAndVerify, signIn, type Account } from '../fixtures/practice';

/**
 * Adjectives and adverbs in English, Spanish and German
 * (`.context/plans/autocomplete-data-source-strategy.md`, Slice H3 gate). The `lexemes` table holds
 * the committed fixtures in CI, or the full lexicon locally; every word below is in both.
 *
 *  1. German adjective "gut": comparative "besser", superlative "besten" (stored without "am"; the
 *     form shows "am" in front of the field).
 *  2. German adverb "oft" is Gradable and fills all degrees; "hier" is Non-gradable.
 *  3. Spanish adjective: "rojo" fills the M/F cells; a Neutral word ("feliz") typed on the M/F
 *     branch switches the card to Neutral; a pick from the list works too.
 *  4. English: "beautiful" picked from the list gets "more beautiful"; the adverb "quickly" gets
 *     "more quickly".
 *  5. Estonian adverb (new in H4, Ekilex stub): "kiiresti" fills the comparative and checks the
 *     "no one-word superlative" box (D27), so the superlative reads "kõige kiiremini"; a conjunction
 *     ("ja") is not found. The word is saved with an English adverb and shows after a reload.
 *
 * Only the Estonian adverb is saved: the subject of the others is the fill.
 */

test.afterAll(async () => {
    await deleteUsersByEmail(createdEmails);
    await closePool();
});


/** New word → part of speech → the card for `language` (its native name). */
async function openCard(page: Page, partOfSpeech: RegExp, language: string): Promise<void> {
    await page.goto('/addWord');
    await expect(page.getByRole('heading', { name: 'New word' })).toBeVisible();
    await page.getByRole('radio', { name: partOfSpeech }).click();
    await page.getByRole('button', { name: language }).click();
}

/** Types a whole word, then the button fills the card (`clickUseValues` closes the list first when the word is listed). */
async function typeAndFill(page: Page, fieldLabel: string, word: string): Promise<void> {
    await page.getByLabel(fieldLabel, { exact: true }).pressSequentially(word);
    await clickUseValues(page);
}

test.describe.serial('Autocomplete — adjectives and adverbs (Slice H3)', () => {
    let user: Account;

    test.beforeAll(async ({ request }) => {
        user = await registerAndVerify(request, 'Adjective User', ['English', 'German', 'Spanish', 'Estonian']);
    });

    test.beforeEach(async ({ page }) => {
        await signIn(page, user);
    });

    test('German adjective: the degrees fill, and the superlative has "am" in front of it, not in it', async ({ page }) => {
        await openCard(page, /Adjective/, 'Deutsch');
        await typeAndFill(page, 'Positive', 'gut');

        await expect(page.getByLabel('Comparative', { exact: true })).toHaveValue('besser');
        await expect(page.getByLabel('Superlative', { exact: true })).toHaveValue('besten');
        await expect(page.getByText('am', { exact: true })).toBeVisible();
    });

    test('German adverb: "oft" is Gradable with all degrees; "hier" is Non-gradable', async ({ page }) => {
        await openCard(page, /Adverb/, 'Deutsch');
        await typeAndFill(page, 'Adverb', 'oft');
        await expect(page.getByRole('radio', { name: 'Gradable', exact: true })).toBeChecked();
        await expect(page.getByLabel('Comparative', { exact: true })).toHaveValue('öfter');
        await expect(page.getByLabel('Superlative', { exact: true })).toHaveValue('öftesten');

        // Another word on the same card: the Non-gradable branch hides the degrees.
        await page.getByLabel('Adverb', { exact: true }).fill('hier');
        await clickUseValues(page);
        await expect(page.getByRole('radio', { name: 'Non-gradable', exact: true })).toBeChecked();
        await expect(page.getByLabel('Comparative', { exact: true })).toHaveCount(0);
    });

    test('Spanish adjective: a gendered word fills the M/F cells', async ({ page }) => {
        await openCard(page, /Adjective/, 'Español');
        await page.getByRole('radio', { name: 'M/F', exact: true }).click();
        await typeAndFill(page, 'Male singular', 'rojo');

        await expect(page.getByLabel('Male plural', { exact: true })).toHaveValue('rojos');
        await expect(page.getByLabel('Female singular', { exact: true })).toHaveValue('roja');
        await expect(page.getByLabel('Female plural', { exact: true })).toHaveValue('rojas');
    });

    test('Spanish adjective: a Neutral word typed on the M/F branch switches the card to Neutral', async ({ page }) => {
        await openCard(page, /Adjective/, 'Español');
        await page.getByRole('radio', { name: 'M/F', exact: true }).click();
        await typeAndFill(page, 'Male singular', 'feliz');

        await expect(page.getByRole('radio', { name: 'Neutral', exact: true })).toBeChecked();
        await expect(page.getByLabel('Neutral singular', { exact: true })).toHaveValue('feliz');
        await expect(page.getByLabel('Neutral plural', { exact: true })).toHaveValue('felices');
        await expect(page.getByLabel('Male singular', { exact: true })).toHaveCount(0);
    });

    test('Spanish adjective: a pick from the list fills the card at once', async ({ page }) => {
        await openCard(page, /Adjective/, 'Español');
        await page.getByRole('radio', { name: 'M/F', exact: true }).click();
        await page.getByLabel('Male singular', { exact: true }).pressSequentially('roj');
        await page.getByRole('listbox').getByRole('option', { name: 'rojo', exact: true }).click();

        await expect(page.getByLabel('Female singular', { exact: true })).toHaveValue('roja');
    });

    test('English adjective picked from the list, and an adverb in -ly: "more" forms', async ({ page }) => {
        await openCard(page, /Adjective/, 'English');
        await page.getByLabel('Positive', { exact: true }).pressSequentially('beau');
        await page.getByRole('listbox').getByRole('option', { name: 'beautiful', exact: true }).click();
        await expect(page.getByLabel('Comparative', { exact: true })).toHaveValue('more beautiful');
        await expect(page.getByLabel('Superlative', { exact: true })).toHaveValue('most beautiful');

        await openCard(page, /Adverb/, 'English');
        await typeAndFill(page, 'Adverb', 'quickly');
        await expect(page.getByLabel('Comparative', { exact: true })).toHaveValue('more quickly');
    });

    test('Estonian adverb: the comparative fills, the "kõige" box is checked, a conjunction is not found, and the word saves', async ({ page }) => {
        await openCard(page, /Adverb/, 'Eesti');
        await page.getByLabel('Adverb', { exact: true }).pressSequentially('ja');
        await expect(page.getByText("Sorry, we don't know this word!")).toBeVisible();

        await page.getByLabel('Adverb', { exact: true }).fill('kiiresti');
        await clickUseValues(page);
        await expect(page.getByLabel('Comparative', { exact: true })).toHaveValue('kiiremini');
        await expect(page.getByRole('checkbox', { name: /No one-word superlative/ })).toBeChecked();
        await expect(page.getByTestId('derived-superlative')).toHaveValue('kõige kiiremini');

        // A second translation, then save.
        await page.getByRole('button', { name: 'English' }).click();
        await page.getByLabel('Adverb', { exact: true }).last().fill('quickly');
        await page.getByRole('button', { name: 'Save' }).click();
        await expect(page.getByText('Word was created successfully')).toBeVisible();
        await page.getByRole('button', { name: 'Click here to see the new word' }).click();
        await expect(page).toHaveURL(/\/word\/.+/);

        await page.reload();
        await expect(page.getByText('Detailed view: Adverb')).toBeVisible();
        await expect(page.getByText('kiiresti')).toBeVisible();
        await expect(page.getByText('kiiremini', { exact: true })).toBeVisible();
        // The checkbox is stored; the view shows the superlative it stands for.
        await expect(page.getByTestId('derived-superlative')).toHaveText('kõige kiiremini');
    });
});
