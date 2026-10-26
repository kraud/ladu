import { test, expect, type Page } from '@playwright/test';
import { closeTypeAheadList } from '../fixtures/autocomplete';
import { closePool, deleteUsersByEmail } from '../fixtures/db';
import { createdEmails, registerAndVerify, signIn, type Account } from '../fixtures/practice';

/**
 * French word forms (`.context/plans/language-french.md`). Slice 4: the noun and the adjective.
 * Slice 5: the verb. Slice 6 adds the adverb, the conjunction and the preposition to this file.
 *
 *  1. A French noun: gender (le / la), singular, plural. It saves and shows in the words table.
 *  2. A French adjective: the four agreement forms, the "plus" comparative (derived and stored), the
 *     vowel form behind its box (beau → bel), and the position.
 *  3. A French verb with être: the infinitive, the participles, the group, and the passé composé with the
 *     conjugated auxiliary before each box. A reflexive verb shows the pronoun before the auxiliary.
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

test.describe.serial('French forms (slices 4 and 5: noun, adjective and verb)', () => {
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

    test('gender and regularity share one row, on a desktop and on a phone', async ({ page }) => {
        for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 800 }]) {
            await page.setViewportSize(viewport);
            await openNewWord(page, /Noun/);
            await page.getByRole('button', { name: 'Français' }).click();
            const gender = page.getByText('Gender', { exact: true }).last();
            const regularity = page.getByText('Regularity', { exact: true }).last();
            await expect(gender).toBeVisible();
            await expect(regularity).toBeVisible();
            const [g, r] = [await gender.boundingBox(), await regularity.boundingBox()];
            expect(Math.abs(g!.y - r!.y), `labels at ${viewport.width}px`).toBeLessThan(4);
            expect(r!.x).toBeGreaterThan(g!.x + g!.width - 1); // side by side, not stacked
        }
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
        // The superlative is locked and follows the comparative: "le " + "plus beau".
        await expect(page.getByTestId('derived-superlative')).toHaveValue('le plus beau');
        await expect(page.getByTestId('derived-superlative')).toHaveJSProperty('readOnly', true);

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
        await expect(page.getByTestId('derived-superlative')).toHaveText('le plus beau');
    });

    test('the "plus" box sits above the comparative and the superlative, which share one row on a desktop and on a phone', async ({ page }) => {
        for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 800 }]) {
            await page.setViewportSize(viewport);
            await openNewWord(page, /Adjective/);
            await page.getByRole('button', { name: 'Français' }).click();
            const box = page.getByRole('checkbox', { name: /Uses "plus"/ });
            const comparative = page.getByLabel('Comparative (male singular)', { exact: true });
            const superlative = page.getByLabel('Superlative (male singular)', { exact: true });
            await expect(box).toBeVisible();
            const [b, c, s] = [await box.boundingBox(), await comparative.boundingBox(), await superlative.boundingBox()];
            expect(b!.y + b!.height, `box above the row at ${viewport.width}px`).toBeLessThanOrEqual(c!.y);
            expect(Math.abs(c!.y - s!.y), `same row at ${viewport.width}px`).toBeLessThan(4);
            expect(s!.x).toBeGreaterThan(c!.x + c!.width - 1); // side by side, not stacked
        }
    });

    test('the superlative is empty with a placeholder until there is a comparative; a typed comparative feeds it', async ({ page }) => {
        await openNewWord(page, /Adjective/);
        await page.getByRole('button', { name: 'Français' }).click();
        const superlative = page.getByTestId('derived-superlative');
        await expect(superlative).toHaveValue('');
        await expect(superlative).toHaveAttribute('placeholder', 'Depends on the comparative');

        // An irregular comparative is typed (the "plus" box stays off); the superlative follows it.
        await page.getByLabel('Male singular', { exact: true }).fill('bon');
        await page.getByLabel('Comparative (male singular)', { exact: true }).fill('meilleur');
        await expect(superlative).toHaveValue('le meilleur');
    });

    test('a verb with être: the infinitive is required; the passé composé shows the auxiliary before the participle', async ({ page }) => {
        await openNewWord(page, /Verb/);

        await page.getByRole('button', { name: 'English' }).click();
        await page.locator('input[name="simplePresent1s"]').fill('go');
        await closeTypeAheadList(page);

        await page.getByRole('button', { name: 'Français' }).click();
        // The infinitive is the only required French field.
        await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
        await page.getByLabel('Infinitive', { exact: true }).fill('aller');
        await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();

        // The verb group takes the place of the regularity radio (checked in verbs.test.ts: the English card has one).
        await page.getByRole('radio', { name: '3e groupe', exact: true }).click();
        await page.getByLabel('Past participle', { exact: true }).fill('allé');
        await page.getByLabel('Present participle', { exact: true }).fill('allant');

        // No auxiliary chosen yet: nothing stands before the participle boxes.
        await expect(page.getByText('suis', { exact: true })).toHaveCount(0);
        const auxiliary = page.getByRole('radiogroup', { name: 'Auxiliary verb' });
        await auxiliary.getByRole('radio', { name: 'avoir' }).click();
        await expect(page.getByText('ai', { exact: true })).toBeVisible();
        await auxiliary.getByRole('radio', { name: 'être' }).click();
        await expect(page.getByText('suis', { exact: true })).toBeVisible();
        await expect(page.getByText('sommes', { exact: true })).toBeVisible();
        await expect(page.getByText('ai', { exact: true })).toHaveCount(0);

        await page.locator('input[name="indicativePresent1s"]').fill('vais');
        await page.locator('input[name="indicativeImperfect1s"]').fill('allais');
        await page.locator('input[name="indicativePerfect1s"]').fill('allé');
        await page.locator('input[name="indicativePerfect1pl"]').fill('allés');
        await page.locator('input[name="indicativeSimpleFuture1s"]').fill('irai');

        await saveAndOpen(page);
        await page.reload();
        await expect(page.getByText('Detailed view: Verb')).toBeVisible();
        await expect(page.getByText('aller', { exact: true })).toBeVisible();
        // The view shows the auxiliary with the participle that was typed.
        await expect(page.getByText('sommes allés')).toBeVisible();
        await expect(page.getByText('irai', { exact: true })).toBeVisible();

        await page.goto('/words');
        const row = page.getByRole('row', { name: /go/ });
        await expect(row).toContainText('aller');
    });

    test('a reflexive verb shows the pronoun before the verb, and before the auxiliary in the passé composé', async ({ page }) => {
        await openNewWord(page, /Verb/);
        await page.getByRole('button', { name: 'Français' }).click();
        await page.getByLabel('Infinitive', { exact: true }).fill('se laver');
        await page.getByRole('radiogroup', { name: 'Auxiliary verb' }).getByRole('radio', { name: 'être' }).click();

        // Nothing until the verb is "always reflexive".
        await expect(page.getByText('me suis', { exact: true })).toHaveCount(0);
        await page.getByRole('radio', { name: 'Always reflexive', exact: true }).click();
        await expect(page.getByText('me suis', { exact: true })).toBeVisible();
        await expect(page.getByText('suis me')).toHaveCount(0);
        await expect(page.getByText('nous sommes', { exact: true })).toBeVisible();
        // Present, imparfait and futur simple: the pronoun alone, before the verb.
        await expect(page.getByText('me', { exact: true })).toHaveCount(3);
    });

    test('on a desktop and on a phone, the first two verb meta rows keep two cells', async ({ page }) => {
        for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 800 }]) {
            await page.setViewportSize(viewport);
            await openNewWord(page, /Verb/);
            await page.getByRole('button', { name: 'Français' }).click();
            for (const [first, second] of [
                ['Infinitive', 'Auxiliary verb'],
                ['Past participle', 'Present participle'],
            ]) {
                const a = page.getByText(first, { exact: true }).last();
                const b = page.getByText(second, { exact: true }).last();
                await expect(a).toBeVisible();
                await expect(b).toBeVisible();
                const [boxA, boxB] = [await a.boundingBox(), await b.boundingBox()];
                expect(Math.abs(boxA!.y - boxB!.y), `${first} and ${second} at ${viewport.width}px`).toBeLessThan(4);
                expect(boxB!.x, `${first} before ${second} at ${viewport.width}px`).toBeGreaterThan(boxA!.x + boxA!.width - 1);
            }
        }
    });
});
