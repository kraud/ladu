import { test, expect, type Page } from '@playwright/test';
import { closePool, deleteUsersByEmail } from '../fixtures/db';
import { createdEmails, registerAndVerify, signIn, type Account } from '../fixtures/practice';

/**
 * Two radio groups of a verb card: Spanish regularity + reflexivity, French verb group + reflexivity.
 * On a desktop they share one row; on a phone one stands under the other (`layout.stackOnMobile`).
 * Also: the Estonian verb card has no "Search verb in English" box any more.
 */

test.afterAll(async () => {
    await deleteUsersByEmail(createdEmails);
    await closePool();
});

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 375, height: 800 };

async function openVerbCard(page: Page, button: string): Promise<void> {
    await page.goto('/addWord');
    await expect(page.getByRole('heading', { name: 'New word' })).toBeVisible();
    await page.getByRole('radio', { name: /Verb/ }).click();
    await page.getByRole('button', { name: button }).click();
}

async function labelBoxes(page: Page, first: string, second: string) {
    const a = page.getByText(first, { exact: true }).last();
    const b = page.getByText(second, { exact: true }).last();
    await expect(a).toBeVisible();
    await expect(b).toBeVisible();
    return { a: (await a.boundingBox())!, b: (await b.boundingBox())! };
}

test.describe.serial('Verb cards: radio rows and the Estonian card', () => {
    let user: Account;

    test.beforeAll(async ({ request }) => {
        user = await registerAndVerify(request, 'Rosa Verb', ['Spanish', 'French', 'Estonian']);
    });

    test.beforeEach(async ({ page }) => {
        await signIn(page, user);
    });

    for (const [name, button, first, second] of [
        ['Spanish', 'Español', 'Regularity', 'Reflexivity'],
        ['French', 'Français', 'Verb group', 'Reflexivity'],
    ] as const) {
        test(`${name}: ${first} and ${second} share a row on a desktop and stack on a phone`, async ({ page }) => {
            await page.setViewportSize(DESKTOP);
            await openVerbCard(page, button);
            const wide = await labelBoxes(page, first, second);
            expect(Math.abs(wide.a.y - wide.b.y), 'same row on a desktop').toBeLessThan(4);
            expect(wide.b.x, 'side by side on a desktop').toBeGreaterThan(wide.a.x + wide.a.width - 1);

            await page.setViewportSize(PHONE);
            await openVerbCard(page, button);
            const narrow = await labelBoxes(page, first, second);
            expect(narrow.b.y, 'the second group is below the first on a phone').toBeGreaterThan(narrow.a.y + narrow.a.height);
        });
    }

    test('the Estonian verb card has no "Search verb in English" box', async ({ page }) => {
        await openVerbCard(page, 'Eesti');
        await expect(page.getByLabel('-ma infinitive')).toBeVisible();
        await expect(page.getByRole('checkbox')).toHaveCount(0);
    });
});
