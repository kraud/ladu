import { test, expect, type Page } from '@playwright/test';
import { closeTypeAheadList } from '../fixtures/autocomplete';
import { closePool, deleteUsersByEmail } from '../fixtures/db';
import { createdEmails, registerAndVerify, signIn, type Account } from '../fixtures/practice';

/**
 * French word forms (`.context/plans/language-french.md`). Slice 4: the noun and the adjective.
 * Slices 5 and 6 add the verb, the adverb, the conjunction and the preposition to this file.
 *
 *  1. A French noun: gender (le / la), singular, plural. It saves and shows in the words table.
 *  2. A French adjective: the four agreement forms, the "plus" comparative (derived and stored), the
 *     vowel form behind its box (beau → bel), and the position.
 *
 * No autocomplete runs for French yet (slices 8 to 10).
 */

test.afterAll(async () => {
    await deleteUsersByEmail(createdEmails);
    await closePool();
});

/** New word → the part of speech. */
async function openNewWord(page: Page, partOfSpeech: RegExp): Promise<void> {
    await page.goto('/addWord');
    await expect(page.getByRole('heading', { name: 'New word' })).toBeVisible();
    await page.getByRole('radio', { name: partOfSpeech }).click();
}

async function saveAndOpen(page: Page): Promise<void> {
    const save = page.getByRole('button', { name: 'Save' });
    await expect(save).toBeEnabled();
    await save.click();
    await expect(page.getByText('Word was created successfully')).toBeVisible();
    await page.getByRole('button', { name: 'Click here to see the new word' }).click();
    await expect(page).toHaveURL(/\/word\/.+/);
}

test.describe.serial('French forms (slice 4: noun and adjective)', () => {
    let user: Account;

    test.beforeAll(async ({ request }) => {
        user = await registerAndVerify(request, 'Léa Martin', ['English', 'French']);
    });

    test.beforeEach(async ({ page }) => {
        await signIn(page, user);
    });

    test('a noun with its gender, singular and plural saves, survives a reload and shows in the words table', async ({ page }) => {
        await openNewWord(page, /Noun/);

        await page.getByRole('button', { name: 'English' }).click();
        await page.getByLabel('Singular', { exact: true }).first().fill('horse');
        await closeTypeAheadList(page);

        await page.getByRole('button', { name: 'Français' }).click();
        // Exact match: "le" would also match the "le/la" option.
        await page.getByRole('radio', { name: 'le', exact: true }).click();
        await page.getByLabel('Singular', { exact: true }).last().fill('cheval');
        await page.getByLabel('Plural', { exact: true }).last().fill('chevaux');

        await saveAndOpen(page);
        await page.reload();
        await expect(page.getByText('Detailed view: Noun')).toBeVisible();
        await expect(page.getByText('cheval', { exact: true })).toBeVisible();
        await expect(page.getByText('chevaux', { exact: true })).toBeVisible();

        // The French cell shows the word and its gender chip.
        await page.goto('/words');
        const row = page.getByRole('row', { name: /horse/ });
        await expect(row).toContainText('cheval');
        await expect(row).toContainText('le');
    });

    test('the noun cannot be saved before the gender is chosen', async ({ page }) => {
        await openNewWord(page, /Noun/);
        await page.getByRole('button', { name: 'English' }).click();
        await page.getByLabel('Singular', { exact: true }).first().fill('table');
        await closeTypeAheadList(page);
        await page.getByRole('button', { name: 'Français' }).click();
        await page.getByLabel('Singular', { exact: true }).last().fill('table');
        await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();

        await page.getByRole('radio', { name: 'la', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();
    });

    test('an adjective: agreement forms, the "plus" comparative, the vowel form and the position', async ({ page }) => {
        await openNewWord(page, /Adjective/);

        await page.getByRole('button', { name: 'English' }).click();
        await page.getByLabel('Positive', { exact: true }).fill('beautiful');
        await closeTypeAheadList(page);

        await page.getByRole('button', { name: 'Français' }).click();
        await page.getByLabel('Male singular', { exact: true }).fill('beau');
        await page.getByLabel('Female singular', { exact: true }).fill('belle');
        await page.getByLabel('Male plural', { exact: true }).fill('beaux');
        await page.getByLabel('Female plural', { exact: true }).fill('belles');

        // The "plus" box derives the comparative from the masculine singular.
        await page.getByRole('checkbox', { name: /Uses "plus"/ }).click();
        await expect(page.getByTestId('derived-comparative')).toHaveValue('plus beau');

        // The vowel form is hidden until its box is on.
        await expect(page.getByLabel('Form before a vowel', { exact: true })).toHaveCount(0);
        await page.getByRole('checkbox', { name: /Has a form before a vowel/ }).click();
        await page.getByLabel('Form before a vowel', { exact: true }).fill('bel');

        await page.getByRole('radio', { name: 'Before the noun', exact: true }).click();

        await saveAndOpen(page);
        await page.reload();
        await expect(page.getByText('Detailed view: Adjective')).toBeVisible();
        await expect(page.getByText('belle', { exact: true })).toBeVisible();
        await expect(page.getByText('bel', { exact: true })).toBeVisible();
        // The checkbox is stored; the view shows the comparative it stands for.
        await expect(page.getByTestId('derived-comparative')).toHaveText('plus beau');
    });
});
