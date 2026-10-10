import { test, expect, type Locator, type Page } from '@playwright/test';
import { clickUseValues } from '../fixtures/autocomplete';
import { closePool, deleteUsersByEmail } from '../fixtures/db';
import { createdEmails, registerAndVerify, signIn, type Account } from '../fixtures/practice';

/**
 * The type-ahead list on the autocomplete query field (`.context/plans/autocomplete-data-source-strategy.md`
 * Slice E gate, decision D21). The `lexemes` table holds the committed fixtures in CI, or the full
 * lexicon locally; every word below is in both. The list order differs between the two (the full
 * lexicon has more words), so the checks find options by name, never by position.
 *
 *  1. A prefix lists the homograph "See" once per meaning; a click on "die See" fills the card
 *     with that meaning (not the main sense der See), and the footer shows it as applied.
 *  2. Arrow keys + Enter pick too ("der See": genitive "Sees", where die See has "See").
 *  3. A Spanish verb: a pick fills the conjugation.
 *  4. A whole word typed without a pick, also when it is the only match: the list stays open (it does
 *     not close by itself), and a click on the word fills the card. A click outside closes the list
 *     and frees the "Use autocomplete values" button.
 *
 * Nothing is saved: the subject is the list and the fill.
 */

test.afterAll(async () => {
    await deleteUsersByEmail(createdEmails);
    await closePool();
});

const useValues = (page: Page) => page.getByRole('button', { name: 'Use autocomplete values' });
const applied = (page: Page) => page.getByText('Autocomplete values applied');

/** Types `text` and waits for the list. The list also stays open when `text` is a whole listed word. */
async function typeAndOpenList(page: Page, field: Locator, text: string): Promise<void> {
    await field.pressSequentially(text);
    await expect(page.getByRole('listbox')).toBeVisible();
}

/** New word → part of speech → the card for `language` (its native name). */
async function openCard(page: Page, partOfSpeech: RegExp, language: string): Promise<void> {
    await page.goto('/addWord');
    await expect(page.getByRole('heading', { name: 'New word' })).toBeVisible();
    await page.getByRole('radio', { name: partOfSpeech }).click();
    await page.getByRole('button', { name: language }).click();
}

test.describe.serial('Autocomplete — type-ahead list (Slice E)', () => {
    let user: Account;

    test.beforeAll(async ({ request }) => {
        user = await registerAndVerify(request, 'Type Ahead User', ['English', 'German', 'Spanish']);
    });

    test.beforeEach(async ({ page }) => {
        await signIn(page, user);
    });

    test('a prefix lists both meanings of "See"; a click on "die See" fills that meaning', async ({ page }) => {
        await openCard(page, /Noun/, 'Deutsch');
        await typeAndOpenList(page, page.getByLabel('Singular nominative'), 'see');

        const list = page.getByRole('listbox');
        await expect(list.getByRole('option', { name: 'der See', exact: true })).toBeVisible();
        await list.getByRole('option', { name: 'die See', exact: true }).click();

        await expect(page.getByLabel('Singular nominative')).toHaveValue('See');
        await expect(page.getByRole('radio', { name: 'die', exact: true })).toBeChecked();
        await expect(page.getByLabel('Singular genitive')).toHaveValue('See');
        await expect(page.getByLabel('Plural nominative')).toHaveValue('Seen');
        // The footer reads the picked entry: no offer to overwrite it with the main sense.
        await expect(applied(page)).toBeVisible();
        await expect(useValues(page)).toHaveCount(0);
    });

    test('arrow keys and Enter pick a suggestion too', async ({ page }) => {
        await openCard(page, /Noun/, 'Deutsch');
        const field = page.getByLabel('Singular nominative');
        await typeAndOpenList(page, field, 'see');

        const derSee = page.getByRole('listbox').getByRole('option', { name: 'der See', exact: true });
        await expect(derSee).toBeVisible();
        // Down until "der See" is highlighted (its place depends on the lexicon loaded).
        for (let step = 0; step < 10 && (await derSee.getAttribute('data-highlighted')) === null; step++) {
            await field.press('ArrowDown');
        }
        await field.press('Enter');

        await expect(page.getByRole('radio', { name: 'der', exact: true })).toBeChecked();
        await expect(page.getByLabel('Singular genitive')).toHaveValue('Sees');
        await expect(applied(page)).toBeVisible();
    });

    test('a Spanish verb picked from the list is conjugated', async ({ page }) => {
        await openCard(page, /Verb/, 'Español');
        await page.getByLabel('Infinitive non-finite simple').pressSequentially('bail');
        await page.getByRole('listbox').getByRole('option', { name: 'bailar', exact: true }).click();

        await expect(page.getByLabel('Infinitive non-finite simple')).toHaveValue('bailar');
        // The first "Yo" field is the present tense.
        await expect(page.getByLabel('Yo').first()).toHaveValue('bailo');
        await expect(page.getByLabel('Gerund non-finite simple')).toHaveValue('bailando');
    });

    test('a whole word that is the only match: the list stays open, and a click on it fills the card', async ({ page }) => {
        await openCard(page, /Noun/, 'Deutsch');
        await page.getByLabel('Singular nominative').pressSequentially('Polizei');

        const option = page.getByRole('listbox').getByRole('option', { name: 'die Polizei', exact: true });
        await expect(option).toBeVisible();
        // Longer than the lookup pause: the list used to close by itself here.
        await page.waitForTimeout(1200);
        await expect(option).toBeVisible();

        await option.click();
        await expect(page.getByRole('radio', { name: 'die', exact: true })).toBeChecked();
        await expect(page.getByLabel('Plural nominative')).toHaveValue('Polizeien');
        await expect(applied(page)).toBeVisible();
    });

    test('a click outside closes the list and frees the button', async ({ page }) => {
        await openCard(page, /Noun/, 'Deutsch');
        await page.getByLabel('Singular nominative').pressSequentially('Polizei');
        await expect(page.getByRole('listbox')).toBeVisible();

        await clickUseValues(page);
        await expect(page.getByRole('listbox')).toHaveCount(0);
        await expect(page.getByRole('radio', { name: 'die', exact: true })).toBeChecked();
        await expect(page.getByLabel('Plural nominative')).toHaveValue('Polizeien');
    });
});
