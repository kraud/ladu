import { test, expect, type Page } from '@playwright/test';
import { closePool, deleteUsersByEmail } from '../fixtures/db';
import { createdEmails, registerAndVerify, signIn, type Account } from '../fixtures/practice';

/**
 * The "Reflexive verb" box (`.context/plans/autocomplete-data-source-strategy.md`, Slice H5 gate,
 * decisions D28–D30). The `lexemes` table holds the committed fixtures in CI, or the full lexicon
 * locally; every word below is in both.
 *
 *  1. Spanish "quejarse" (a reflexive lemma): autocomplete checks the box, the forms stay without
 *     the pronoun ("quejo"), and the card shows "me" before the person field; an unchecked box shows
 *     no pronoun. "lavar" (a verb that only CAN be reflexive) leaves the box unchecked.
 *  2. German "sputen" ("sich sputen"): the box is checked; the present shows the pronoun after the
 *     verb ("spute" + "mich"), the perfect before it ("habe mich"); a Dative-only verb-case choice
 *     turns "mich" into "mir" (D30). "waschen" leaves the box unchecked.
 *  3. The flag is saved with the word and comes back after a reload.
 */

test.afterAll(async () => {
    await deleteUsersByEmail(createdEmails);
    await closePool();
});

const useValues = (page: Page) => page.getByRole('button', { name: 'Use autocomplete values' });
const reflexiveBox = (page: Page) => page.getByRole('checkbox', { name: 'Reflexive verb' });

/** New word → Verb → the card for `language` (its native name). */
async function openVerbCard(page: Page, language: string): Promise<void> {
    await page.goto('/addWord');
    await expect(page.getByRole('heading', { name: 'New word' })).toBeVisible();
    await page.getByRole('radio', { name: /Verb/ }).click();
    await page.getByRole('button', { name: language }).click();
}

/** Types a whole word: the list closes by itself after the pause, then the button fills the card. */
async function typeAndFill(page: Page, fieldLabel: string, word: string): Promise<void> {
    await page.getByLabel(fieldLabel, { exact: true }).fill(word);
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await useValues(page).click();
}

test.describe.serial('Autocomplete — reflexive verbs (Slice H5)', () => {
    let user: Account;

    test.beforeAll(async ({ request }) => {
        user = await registerAndVerify(request, 'Reflexive User', ['English', 'German', 'Spanish']);
    });

    test.beforeEach(async ({ page }) => {
        await signIn(page, user);
    });

    test('Spanish: a reflexive lemma checks the box and shows "me"; the forms stay without the pronoun', async ({ page }) => {
        await openVerbCard(page, 'Español');
        await typeAndFill(page, 'Infinitive non-finite simple', 'quejarse');

        await expect(reflexiveBox(page)).toBeChecked();
        await expect(page.getByLabel('Yo').first()).toHaveValue('quejo');
        await expect(page.getByText('me', { exact: true }).first()).toBeVisible();

        await reflexiveBox(page).uncheck();
        await expect(page.getByText('me', { exact: true })).toHaveCount(0);
    });

    test('Spanish: "lavar" has a reflexive sense but is not a reflexive lemma: the box stays unchecked', async ({ page }) => {
        await openVerbCard(page, 'Español');
        await typeAndFill(page, 'Infinitive non-finite simple', 'lavar');

        await expect(page.getByLabel('Yo').first()).toHaveValue('lavo');
        await expect(reflexiveBox(page)).not.toBeChecked();
    });

    test('German: "sputen" checks the box; the pronoun follows the present and precedes the perfect; Dative gives "mir"', async ({ page }) => {
        await openVerbCard(page, 'Deutsch');
        await typeAndFill(page, 'Infinitive', 'sputen');

        await expect(reflexiveBox(page)).toBeChecked();
        await expect(page.getByLabel('Ich').first()).toHaveValue('spute');
        await expect(page.getByText('mich', { exact: true }).first()).toBeVisible();
        // Perfect: the auxiliary and the pronoun stand together before the participle.
        await expect(page.getByText('habe mich', { exact: true })).toBeVisible();

        // D30: Dative and not Accusative → mir.
        await page.getByRole('checkbox', { name: 'Dative' }).check();
        await expect(page.getByText('mir', { exact: true }).first()).toBeVisible();
        await page.getByRole('checkbox', { name: 'Accusative' }).check();
        await expect(page.getByText('mir', { exact: true })).toHaveCount(0);
    });

    test('German: "waschen" can be reflexive but is not always: the box stays unchecked', async ({ page }) => {
        await openVerbCard(page, 'Deutsch');
        await typeAndFill(page, 'Infinitive', 'waschen');

        await expect(page.getByLabel('Ich').first()).toHaveValue('wasche');
        await expect(reflexiveBox(page)).not.toBeChecked();
    });

    test('the flag is saved with the word and survives a reload', async ({ page }) => {
        await openVerbCard(page, 'Español');
        await typeAndFill(page, 'Infinitive non-finite simple', 'quejarse');
        await expect(reflexiveBox(page)).toBeChecked();

        await page.getByRole('button', { name: 'English' }).click();
        await page.locator('input[name="simplePresent1s"]').fill('complain');
        await page.getByRole('button', { name: 'Save' }).click();
        await expect(page.getByText('Word was created successfully')).toBeVisible();
        await page.getByRole('button', { name: 'Click here to see the new word' }).click();
        await expect(page).toHaveURL(/\/word\/.+/);

        await page.reload();
        await expect(page.getByText('Detailed view: Verb')).toBeVisible();
        await expect(page.getByText('quejarse')).toBeVisible();
        // Edit: the box is still checked.
        await page.getByRole('button', { name: 'Edit' }).click();
        await expect(reflexiveBox(page)).toBeChecked();
    });
});
