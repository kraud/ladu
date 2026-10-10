import { test, expect, type Page } from '@playwright/test';
import { clickUseValues } from '../fixtures/autocomplete';
import { closePool, deleteUsersByEmail } from '../fixtures/db';
import { createdEmails, registerAndVerify, signIn, type Account } from '../fixtures/practice';

/**
 * Reflexive verbs (`.context/plans/autocomplete-data-source-strategy.md`, Slice H5 gate, decisions
 * D28–D33). The `lexemes` table holds the committed fixtures in CI, or the full lexicon locally; every
 * word below is in both.
 *
 *  1. Spanish "quejarse" (a reflexive lemma): Always reflexive, the forms stay without the pronoun
 *     ("quejo"), and the card shows "me" before the person field; Optionally reflexive hides the hint.
 *     "lavar" (a verb that only CAN be reflexive) is Optionally reflexive, "bailar" Not reflexive.
 *  2. German "sputen" ("sich sputen"): Always reflexive, pronoun case Accusative; the present shows the
 *     pronoun after the verb ("spute" + "mich"), the perfect before it ("habe mich"). The pronoun-case
 *     radio changes it to "mir" or "mich/mir".
 *  3. German "waschen": Optionally reflexive (no pronoun hint) and the Accusative object box checked
 *     from the transitive tag; "denken": pronoun case Dative; "tanzen": Not reflexive, no pronoun-case
 *     radio.
 *  4. The values are saved with the word and come back after a reload (also the new Prepositional box).
 */

test.afterAll(async () => {
    await deleteUsersByEmail(createdEmails);
    await closePool();
});

const reflexivity = (page: Page, value: string) => page.getByRole('radio', { name: value, exact: true });

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

    test('Spanish: a reflexive lemma is Always reflexive and shows "me"; the forms stay without the pronoun', async ({ page }) => {
        await openVerbCard(page, 'Español');
        await typeAndFill(page, 'Infinitive non-finite simple', 'quejarse');

        await expect(reflexivity(page, 'Always reflexive')).toBeChecked();
        await expect(page.getByLabel('Yo', { exact: true }).first()).toHaveValue('quejo');
        await expect(page.getByText('me', { exact: true }).first()).toBeVisible();
        // No pronoun-case radio in Spanish: me, te, se are the same for dative and accusative.
        await expect(page.getByRole('radio', { name: /Dative/ })).toHaveCount(0);

        await reflexivity(page, 'Optionally reflexive').click();
        await expect(page.getByText('me', { exact: true })).toHaveCount(0);
    });

    test('Spanish: "lavar" is Optionally reflexive (no hint), "bailar" is Not reflexive', async ({ page }) => {
        await openVerbCard(page, 'Español');
        await typeAndFill(page, 'Infinitive non-finite simple', 'lavar');
        await expect(page.getByLabel('Yo', { exact: true }).first()).toHaveValue('lavo');
        await expect(reflexivity(page, 'Optionally reflexive')).toBeChecked();
        await expect(page.getByText('me', { exact: true })).toHaveCount(0);

        await page.getByLabel('Infinitive non-finite simple', { exact: true }).fill('bailar');
        await clickUseValues(page);
        await expect(reflexivity(page, 'Not reflexive')).toBeChecked();
    });

    test('German: "sputen" is Always reflexive; the pronoun follows the present and precedes the perfect; the case radio gives mir / mich/mir', async ({ page }) => {
        await openVerbCard(page, 'Deutsch');
        await typeAndFill(page, 'Infinitive', 'sputen');

        await expect(page.getByRole('radio', { name: 'Always reflexive' })).toBeChecked();
        await expect(page.getByRole('radio', { name: /^Accusative \(mich/ })).toBeChecked();
        await expect(page.getByLabel('Ich', { exact: true }).first()).toHaveValue('spute');
        await expect(page.getByText('mich', { exact: true }).first()).toBeVisible();
        // Perfect: the auxiliary and the pronoun stand together before the participle.
        await expect(page.getByText('habe mich', { exact: true })).toBeVisible();

        await page.getByRole('radio', { name: /^Dative \(mir/ }).click();
        await expect(page.getByText('mir', { exact: true }).first()).toBeVisible();
        await expect(page.getByText('mich', { exact: true })).toHaveCount(0);
        await page.getByRole('radio', { name: 'Both / variable' }).click();
        await expect(page.getByText('mich/mir', { exact: true }).first()).toBeVisible();
    });

    test('German: "waschen" is Optionally reflexive (no pronoun hint), with the accusative object box checked', async ({ page }) => {
        await openVerbCard(page, 'Deutsch');
        await typeAndFill(page, 'Infinitive', 'waschen');

        await expect(page.getByLabel('Ich', { exact: true }).first()).toHaveValue('wasche');
        await expect(page.getByRole('radio', { name: 'Optionally reflexive' })).toBeChecked();
        await expect(page.getByText('mich', { exact: true })).toHaveCount(0);
        await expect(page.getByRole('checkbox', { name: 'Accusative', exact: true })).toBeChecked();
        await expect(page.getByRole('checkbox', { name: 'Dative', exact: true })).not.toBeChecked();
    });

    test('German: "denken" has the Dative pronoun case; "tanzen" is Not reflexive and has no pronoun-case radio', async ({ page }) => {
        await openVerbCard(page, 'Deutsch');
        await typeAndFill(page, 'Infinitive', 'denken');
        await expect(page.getByRole('radio', { name: /^Dative \(mir/ })).toBeChecked();

        await page.getByLabel('Infinitive', { exact: true }).fill('tanzen');
        await clickUseValues(page);
        await expect(page.getByRole('radio', { name: 'Not reflexive' })).toBeChecked();
        await expect(page.getByRole('radio', { name: /^Dative \(mir/ })).toHaveCount(0);
    });

    test('the Spanish reflexivity is saved with the word and survives a reload', async ({ page }) => {
        await openVerbCard(page, 'Español');
        await typeAndFill(page, 'Infinitive non-finite simple', 'quejarse');
        await expect(reflexivity(page, 'Always reflexive')).toBeChecked();

        await page.getByRole('button', { name: 'English' }).click();
        await page.locator('input[name="simplePresent1s"]').fill('complain');
        await page.getByRole('button', { name: 'Save' }).click();
        await expect(page.getByText('Word was created successfully')).toBeVisible();
        await page.getByRole('button', { name: 'Click here to see the new word' }).click();
        await expect(page).toHaveURL(/\/word\/.+/);

        await page.reload();
        await expect(page.getByText('Detailed view: Verb')).toBeVisible();
        await expect(page.getByText('quejarse')).toBeVisible();
        // Edit: the radio is still on "Always reflexive".
        await page.getByRole('button', { name: 'Edit' }).click();
        await expect(reflexivity(page, 'Always reflexive')).toBeChecked();
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
