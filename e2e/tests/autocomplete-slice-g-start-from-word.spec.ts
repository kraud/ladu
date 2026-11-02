import { test, expect, type Page } from '@playwright/test';
import { closePool, deleteUsersByEmail } from '../fixtures/db';
import { createdEmails, registerAndVerify, signIn, type Account } from '../fixtures/practice';

/**
 * "Start from a word" on /addWord (`.context/research/autocomplete-data-source-strategy.md (section "Slice G")`, Slice G
 * gate). The `lexemes` and `lexeme_translations` tables hold the committed fixtures in CI, or the full
 * data locally; every word below is in both. The sense lists differ between the two (the full data has
 * more senses), so a sense is found by its label, never by position.
 *
 *  1. English start, "house — human abode": the preview shows the account languages only, the draft
 *     opens as a Noun with one filled card per language, and the Word saves. ("house", "Haus" and
 *     "casa" are in the committed lexicon fixtures, so every card is complete in CI too.)
 *
 * Removed in the test prune pass (`.context/plans/test-prune-pass.md`): the German "die See"
 * start, the Estonian gap, the manual path and the layout. `StartFromWord.test.tsx`,
 * `AddWordPage.test.tsx` and `backend/tests/dictionary.test.js` own them.
 *
 * Set E2E_SHOT_DIR to save screenshots of the section, the sense list and the preview.
 */

const SHOT_DIR = process.env.E2E_SHOT_DIR;

test.afterAll(async () => {
    await deleteUsersByEmail(createdEmails);
    await closePool();
});

async function shot(page: Page, name: string): Promise<void> {
    if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/${name}.png` });
}

const wordField = (page: Page) => page.getByTestId('start-word-input');
const senseOption = (page: Page, ...texts: string[]) =>
    texts
        .reduce((options, text) => options.filter({ hasText: text }), page.getByTestId('sense-list').getByRole('option'))
        .first();

/** Types `text` in the start field and picks the sense line that contains all of `lineTexts`. */
async function pickSense(page: Page, text: string, ...lineTexts: string[]): Promise<void> {
    await wordField(page).pressSequentially(text);
    await expect(page.getByTestId('sense-list')).toBeVisible();
    await shot(page, `sense-list-${text}`);
    await senseOption(page, ...lineTexts).click();
    await expect(page.getByTestId('sense-preview')).toBeVisible();
}

test.describe.serial('Autocomplete — start from a word (Slice G)', () => {
    let user: Account;

    test.beforeAll(async ({ request }) => {
        user = await registerAndVerify(request, 'Start Word User', ['English', 'German', 'Spanish']);
    });

    test('English start: the preview shows the account languages, the draft fills three cards, and the Word saves', async ({ page }) => {
        await signIn(page, user);
        await page.goto('/addWord');
        await expect(page.getByTestId('start-from-word')).toBeVisible();
        await expect(page.getByRole('radio', { name: /Verb/ })).toBeVisible(); // the manual list is still under the section
        await shot(page, 'gate');

        await pickSense(page, 'hou', 'house', 'human abode');
        const preview = page.getByTestId('sense-preview');
        // Only the account languages, the start language first. Estonian is not on this account.
        await expect(preview.getByRole('group')).toHaveCount(3);
        await expect(page.getByTestId('preview-card-Estonian')).toHaveCount(0);
        await expect(page.getByTestId('preview-card-German')).toContainText('Haus');
        await expect(page.getByTestId('preview-card-Spanish')).toContainText('casa');
        await shot(page, 'preview');

        await page.getByRole('button', { name: 'Create draft' }).click();
        await expect(page.getByRole('heading', { name: 'New Noun' })).toBeVisible();
        await expect(page.getByTestId('start-from-word')).toHaveCount(0);

        // One filled card per language: English first (the start language), then Spanish, German.
        await expect(page.getByLabel('Singular', { exact: true }).first()).toHaveValue('house');
        await expect(page.getByLabel('Singular', { exact: true }).nth(1)).toHaveValue('casa');
        await expect(page.getByLabel('Singular nominative')).toHaveValue('Haus');
        await expect(page.getByRole('radio', { name: 'das', exact: true })).toBeChecked();
        await shot(page, 'draft-form');

        await page.getByRole('button', { name: 'Save word' }).click();
        await expect(page.getByText('Word was created successfully')).toBeVisible();
    });

});
