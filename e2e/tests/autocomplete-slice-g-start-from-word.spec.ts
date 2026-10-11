import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { closePool, deleteUsersByEmail } from '../fixtures/db';
import { createdEmails, registerAndVerify, signIn, type Account } from '../fixtures/practice';

/**
 * "Start from a word" on /addWord (`.context/plans/autocomplete-slice-g-one-term-to-word.md`, Slice G
 * gate). The `lexemes` and `lexeme_translations` tables hold the committed fixtures in CI, or the full
 * data locally; every word below is in both. The sense lists differ between the two (the full data has
 * more senses), so a sense is found by its label, never by position.
 *
 *  1. English start, "house — human abode": the preview shows the account languages only, the draft
 *     opens as a Noun with one filled card per language, and the Word saves. ("house", "Haus" and
 *     "casa" are in the committed lexicon fixtures, so every card is complete in CI too.)
 *  2. German start, "die See — sea": the draft chooses the right homograph by gender (genitive "See",
 *     not "Sees"), and the footer shows the values as applied (no offer to overwrite).
 *  3. The Estonian gap: "lake — a kind of coloring agent" has no Estonian word in the table, so the
 *     preview shows the Ekilex word "lakk" (stub), and the Estonian card fills with it.
 *  4. The manual path is unchanged: the part-of-speech list is still there, under the section.
 *
 * Set E2E_SHOT_DIR to save screenshots of the section, the sense list and the preview.
 */

const EKI_STUB_URL = process.env.EKI_STUB_URL ?? 'http://localhost:4401';
const SHOT_DIR = process.env.E2E_SHOT_DIR;

test.afterAll(async () => {
    await deleteUsersByEmail(createdEmails);
    await closePool();
});

// The stub's log is shared by every worker, so a check looks only for requests about ITS OWN word.
const stubLog = async (request: APIRequestContext) =>
    ((await (await request.get(`${EKI_STUB_URL}/__requests`)).json()) as { rawPath: string }[]).map((r) => r.rawPath);

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
    let estonianUser: Account;

    test.beforeAll(async ({ request }) => {
        user = await registerAndVerify(request, 'Start Word User', ['English', 'German', 'Spanish']);
        estonianUser = await registerAndVerify(request, 'Start Word Estonian', ['English', 'German', 'Estonian']);
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
        await expect(preview.getByRole('listitem')).toHaveCount(3);
        await expect(page.getByTestId('preview-row-Estonian')).toHaveCount(0);
        await expect(page.getByTestId('preview-row-German')).toContainText('Haus');
        await expect(page.getByTestId('preview-row-Spanish')).toContainText('casa');
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

    test('German start: "die See" gives the right homograph, and the footer shows it as applied', async ({ page }) => {
        await signIn(page, user);
        await page.goto('/addWord');
        await page.getByTestId('start-language').click();
        await page.getByRole('option', { name: 'Deutsch' }).click();

        await pickSense(page, 'See', 'die See', 'sea');
        await page.getByRole('button', { name: 'Create draft' }).click();
        await expect(page.getByRole('heading', { name: 'New Noun' })).toBeVisible();

        await expect(page.getByRole('radio', { name: 'die', exact: true })).toBeChecked();
        await expect(page.getByLabel('Singular nominative')).toHaveValue('See');
        // "die See" has the genitive "See"; "der See" would have "Sees".
        await expect(page.getByLabel('Singular genitive')).toHaveValue('See');
        await expect(page.getByText('Autocomplete values applied').first()).toBeVisible();
        await expect(page.getByRole('button', { name: 'Use autocomplete values' })).toHaveCount(0);
    });

    test('the Estonian gap: the preview shows the Ekilex word, and the Estonian card fills with it', async ({ page, request }) => {
        await signIn(page, estonianUser);
        await page.goto('/addWord');

        await pickSense(page, 'lak', 'lake', 'a kind of coloring agent');
        const estonian = page.getByTestId('preview-row-Estonian');
        await expect(estonian).toContainText('from Ekilex');
        await expect(estonian).toContainText('lakk');
        expect((await stubLog(request)).some((path) => path.endsWith('/api/meaning/search/lake'))).toBe(true);

        await page.getByRole('button', { name: 'Create draft' }).click();
        await expect(page.getByRole('heading', { name: 'New Noun' })).toBeVisible();
        await expect(page.getByLabel('Singular nominative').nth(1)).toHaveValue('lakk');
        await expect(page.getByLabel('Plural nominative').nth(1)).not.toHaveValue('');
    });

    test('the manual way is unchanged: a part of speech from the list opens the empty form', async ({ page }) => {
        await signIn(page, user);
        await page.goto('/addWord');
        await page.getByRole('radio', { name: /Noun/ }).click();

        await expect(page.getByRole('heading', { name: 'New Noun' })).toBeVisible();
        await expect(page.getByTestId('start-from-word')).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'English' })).toBeVisible(); // the "add language" chips
    });
});
