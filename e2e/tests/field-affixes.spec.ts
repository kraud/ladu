import { test, expect, type Locator, type Page } from '@playwright/test';
import { closePool, deleteUsersByEmail } from '../fixtures/db';
import { createdEmails, registerAndVerify, signIn } from '../fixtures/practice';

/**
 * A prefix or suffix of a text field (the German superlative's "am", the auxiliary "habe", a reflexive
 * pronoun) stands inside the input's box, so every input of a form is the same width whatever the
 * affix. Measured in a real browser: the outer box of each field (the input itself, or the box that
 * holds the affixes and the input) has one width per column.
 */

const SHOT_DIR = process.env.E2E_SHOT_DIR;

test.afterAll(async () => {
    await deleteUsersByEmail(createdEmails);
    await closePool();
});

/** The width of what the user sees as the field: the box that holds the affixes, else the input. */
async function outerWidth(input: Locator): Promise<number> {
    const box = input.locator('xpath=..');
    const affixed = (await box.evaluate((el) => el.classList.contains('rounded-md') && el.tagName === 'DIV')) as boolean;
    return (await (affixed ? box : input).boundingBox())!.width;
}

async function openGermanCard(page: Page, partOfSpeech: RegExp): Promise<void> {
    await page.goto('/addWord');
    await page.getByRole('radio', { name: partOfSpeech }).click();
    await page.getByRole('button', { name: 'Deutsch' }).click();
}

test('affixed inputs are as wide as plain ones (German adjective and verb)', async ({ page, request }) => {
    const user = await registerAndVerify(request, 'Affix User', ['English', 'German']);
    await page.setViewportSize({ width: 1600, height: 1000 });
    await signIn(page, user);

    // Adjective: "Comparative" is plain, "Superlative" has the prefix "am".
    await openGermanCard(page, /Adjective/);
    const superlative = page.getByLabel('Superlative', { exact: true });
    await expect(superlative.locator('xpath=..').getByText('am', { exact: true })).toBeVisible();
    const [plain, affixed] = [await outerWidth(page.getByLabel('Comparative', { exact: true })), await outerWidth(superlative)];
    expect(Math.abs(plain - affixed)).toBeLessThan(1.5);
    // The typed text goes in the input, not in the prefix.
    await superlative.fill('besten');
    await expect(superlative).toHaveValue('besten');
    if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/affix-adjective.png` });

    // Verb: the perfect and future columns have an auxiliary in front ("habe", "werde"); every person
    // input of the card has one width.
    await openGermanCard(page, /Verb/);
    await page.getByRole('radio', { name: 'haben', exact: true }).click(); // the auxiliary shows once it is chosen
    await expect(page.getByText('habe', { exact: true }).first()).toBeVisible();
    const inputs = page.locator('input[data-slot="input"]');
    const widths: number[] = [];
    for (let i = 1; i < (await inputs.count()); i++) widths.push(await outerWidth(inputs.nth(i))); // 0 = the infinitive
    expect(new Set(widths.map((w) => Math.round(w))).size, `widths: ${widths.map(Math.round).join(', ')}`).toBe(1);
    if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/affix-verb.png`, fullPage: true });
});
