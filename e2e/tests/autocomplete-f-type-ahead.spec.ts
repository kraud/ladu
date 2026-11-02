import { test, expect, type Locator, type Page } from '@playwright/test';
import { closePool, deleteUsersByEmail } from '../fixtures/db';
import { createdEmails, registerAndVerify, signIn, type Account } from '../fixtures/practice';

/**
 * The type-ahead list on the autocomplete query field (`.context/research/autocomplete-data-source-strategy.md`
 * Slice E gate, decision D21). The `lexemes` table holds the committed fixtures in CI, or the full
 * lexicon locally; every word below is in both. The list order differs between the two (the full
 * lexicon has more words), so the checks find options by name, never by position.
 *
 *  1. A prefix lists the homograph "See" once per meaning; a click on "die See" fills the card
 *     with that meaning (not the main sense der See), and the footer shows it as applied.
 *
 * Removed in the test prune pass (`.context/plans/test-prune-pass.md`): arrow keys and
 * Enter, the Spanish pick, the whole-word list and the click outside. `TranslationCard.test.tsx`
 * owns them.
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

});
