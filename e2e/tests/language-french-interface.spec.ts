import { test, expect } from '@playwright/test';
import { closePool, deleteUsersByEmail } from '../fixtures/db';
import { createdEmails, registerAndVerify, signIn } from '../fixtures/practice';

/**
 * French as an interface language (`.context/plans/language-french.md`, slice 3).
 *
 *  1. A visitor picks Français on a public route: the page, `<html lang>` and the choice survive a reload.
 *  2. A signed-in learner who also learns French (the server accepts French at registration) switches the
 *     interface to French: the shell, the Account page and the language count are French, and the choice
 *     is kept after a reload.
 *
 * The French strings are a first draft for a native speaker to review
 * (`.context/plans/language-french-strings.md`).
 */

test.afterAll(async () => {
    await deleteUsersByEmail(createdEmails);
    await closePool();
});

test.describe('French interface (slice 3)', () => {
    test('a visitor picks Français on a public route; the page, <html lang> and the choice persist', async ({ page }) => {
        await page.goto('/login');

        await page.getByRole('button', { name: /interface language/i }).click();
        await page.getByRole('menuitem', { name: 'Français' }).click();
        await expect(page.getByRole('heading', { name: 'Connexion à Ladu' })).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('lang', 'fr');

        await page.reload();
        await expect(page.getByRole('heading', { name: 'Connexion à Ladu' })).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    });

    test('a signed-in learner switches to French: the shell and the Account page are French', async ({ page, request }) => {
        const user = await registerAndVerify(request, 'Léa Martin', ['English', 'French']);
        await signIn(page, user);

        await page.getByRole('button', { name: /interface language/i }).click();
        await page.getByRole('menuitem', { name: 'Français' }).click();
        await expect(page.getByRole('heading', { name: /Bienvenue, Léa Martin/ })).toBeVisible();

        await page.getByRole('link', { name: 'Compte' }).click();
        await expect(page).toHaveURL('/user');
        await expect(page.getByRole('heading', { name: 'Compte' })).toBeVisible();
        // English + French of the five languages.
        await expect(page.getByText('2 sur 5 sélectionnées')).toBeVisible();

        await page.reload();
        await expect(page.getByRole('heading', { name: 'Compte' })).toBeVisible();
    });
});
