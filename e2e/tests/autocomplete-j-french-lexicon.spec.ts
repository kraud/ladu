import { test, expect, type Page } from '@playwright/test';
import { clickUseValues } from '../fixtures/autocomplete';
import { closePool, deleteUsersByEmail } from '../fixtures/db';
import { createdEmails, registerAndVerify, signIn, type Account } from '../fixtures/practice';

/**
 * French autocomplete from the local lexicon (`.context/plans/language-french.md`, Slice 10 gate). The
 * `lexemes` table holds the committed French fixture in CI (loaded by the e2e backend command,
 * `--if-empty`), or the full lexicon locally. Every word below is in both, except "zorplata", which is
 * in neither.
 *
 *  1. A noun ("cheval") gets its gender and its irregular plural.
 *  2. A verb ("aimer") fills the group, the auxiliary, reflexivity, both participles and the boxes of
 *     the present, imparfait, passé composé and futur simple.
 *  3. A verb that takes both auxiliaries ("partir") leaves the auxiliary empty (review log A1).
 *  4. A pronominal verb typed as "se laver" is found through "laver": Always reflexive, être, and the
 *     forms of the plain verb (review log V7).
 *  5. An adjective ("beau") fills the four agreement forms and the form before a vowel.
 *  6. A conjunction ("parce que") fills its type.
 *  7. A word the lexicon does not have shows the "we don't know this word" notice and no button: French
 *     has no library to fall back to.
 *
 * Nothing is saved: the subject is the lookup.
 */

test.afterAll(async () => {
    await deleteUsersByEmail(createdEmails);
    await closePool();
});

/** New word → part of speech → the French card. */
async function openFrench(page: Page, partOfSpeech: RegExp): Promise<void> {
    await page.goto('/addWord');
    await expect(page.getByRole('heading', { name: 'New word' })).toBeVisible();
    await page.getByRole('radio', { name: partOfSpeech }).click();
    await page.getByRole('button', { name: 'Français' }).click();
}

/** Types a whole word, then the button fills the card (`clickUseValues` closes the list first when the word is listed). */
async function typeAndFill(page: Page, fieldLabel: string, word: string): Promise<void> {
    await page.getByLabel(fieldLabel, { exact: true }).pressSequentially(word);
    await clickUseValues(page);
}

const field = (page: Page, name: string) => page.locator(`input[name="${name}"]`);
const auxiliary = (page: Page) => page.getByRole('radiogroup', { name: 'Auxiliary verb' });

test.describe.serial('Autocomplete — French from the lexicon (Slice 10)', () => {
    let user: Account;

    test.beforeAll(async ({ request }) => {
        user = await registerAndVerify(request, 'French Lexicon User', ['English', 'French']);
    });

    test.beforeEach(async ({ page }) => {
        await signIn(page, user);
    });

    test('a noun gets its gender and its irregular plural', async ({ page }) => {
        await openFrench(page, /Noun/);
        await typeAndFill(page, 'Singular', 'cheval');

        await expect(page.getByRole('radio', { name: 'le', exact: true })).toBeChecked();
        await expect(page.getByLabel('Plural', { exact: true })).toHaveValue('chevaux');
    });

    test('a verb fills the group, the auxiliary, the participles and the four tenses', async ({ page }) => {
        await openFrench(page, /Verb/);
        await typeAndFill(page, 'Infinitive', 'aimer');

        await expect(page.getByRole('radio', { name: '1er groupe', exact: true })).toBeChecked();
        await expect(auxiliary(page).getByRole('radio', { name: 'avoir' })).toBeChecked();
        await expect(page.getByRole('radio', { name: 'Not reflexive', exact: true })).toBeChecked();
        await expect(page.getByLabel('Past participle', { exact: true })).toHaveValue('aimé');
        await expect(page.getByLabel('Present participle', { exact: true })).toHaveValue('aimant');

        await expect(field(page, 'indicativePresent1s')).toHaveValue('aime');
        await expect(field(page, 'indicativePresent3pl')).toHaveValue('aiment');
        await expect(field(page, 'indicativeImperfect1s')).toHaveValue('aimais');
        await expect(field(page, 'indicativePerfect1s')).toHaveValue('aimé');
        await expect(field(page, 'indicativeSimpleFuture1s')).toHaveValue('aimerai');
    });

    test('a verb with both auxiliaries leaves the auxiliary empty', async ({ page }) => {
        await openFrench(page, /Verb/);
        await typeAndFill(page, 'Infinitive', 'partir');

        await expect(page.getByRole('radio', { name: '3e groupe', exact: true })).toBeChecked();
        await expect(field(page, 'indicativePresent1s')).toHaveValue('pars');
        // The passé composé still fills, with the masculine singular participle.
        await expect(field(page, 'indicativePerfect1pl')).toHaveValue('parti');
        await expect(auxiliary(page).getByRole('radio', { name: 'avoir' })).not.toBeChecked();
        await expect(auxiliary(page).getByRole('radio', { name: 'être' })).not.toBeChecked();
    });

    test('"se laver" is found through "laver": Always reflexive, être, the pronoun before the auxiliary', async ({ page }) => {
        await openFrench(page, /Verb/);
        await typeAndFill(page, 'Infinitive', 'se laver');

        // The infinitive keeps the pronoun as typed (review log V6); the forms are those of the plain verb.
        await expect(page.getByLabel('Infinitive', { exact: true })).toHaveValue('se laver');
        await expect(page.getByRole('radio', { name: 'Always reflexive', exact: true })).toBeChecked();
        await expect(auxiliary(page).getByRole('radio', { name: 'être' })).toBeChecked();
        await expect(field(page, 'indicativePresent1s')).toHaveValue('lave');
        await expect(page.getByText('me suis', { exact: true })).toBeVisible();
    });

    test('an adjective fills the four forms and the form before a vowel', async ({ page }) => {
        await openFrench(page, /Adjective/);
        await typeAndFill(page, 'Male singular', 'beau');

        await expect(page.getByLabel('Female singular', { exact: true })).toHaveValue('belle');
        await expect(page.getByLabel('Male plural', { exact: true })).toHaveValue('beaux');
        await expect(page.getByLabel('Female plural', { exact: true })).toHaveValue('belles');
        await expect(page.getByRole('checkbox', { name: /Has a form before a vowel/ })).toBeChecked();
        await expect(page.getByLabel('Form before a vowel', { exact: true })).toHaveValue('bel');
    });

    test('a conjunction fills its type', async ({ page }) => {
        await openFrench(page, /Conjunction/);
        await typeAndFill(page, 'Conjunction', 'parce que');

        await expect(page.getByRole('radio', { name: 'Subordinating', exact: true })).toBeChecked();
        await expect(page.getByRole('radio', { name: 'Coordinating', exact: true })).not.toBeChecked();
    });

    test('a word the lexicon does not know: "we don\'t know this word", and no button', async ({ page }) => {
        await openFrench(page, /Noun/);
        await page.getByLabel('Singular', { exact: true }).fill('zorplata');

        await expect(page.getByText("Sorry, we don't know this word!")).toBeVisible();
        await expect(page.getByRole('button', { name: 'Use autocomplete values' })).toHaveCount(0);
    });
});
