import { test, expect } from '@playwright/test';
import { closePool, deleteUsersByEmail } from '../fixtures/db';
import { API, authHeader, createdEmails, loginForToken, registerAndVerify, seedNouns, signIn } from '../fixtures/practice';

/**
 * Changing a saved practice configuration (picked in the "start now or change first" dialog), against the
 * real stack: the page title is the saved name, "Save configuration" is off until something changes, and
 * the save dialog is filled in with Cancel, "Save as copy" and "Update".
 */

const SHOT_DIR = process.env.E2E_SHOT_DIR;

test.afterAll(async () => {
    await deleteUsersByEmail(createdEmails);
    await closePool();
});

test('a saved configuration opens under its own name; Save waits for a change; Update and Save as copy', async ({ page, request }) => {
    const user = await registerAndVerify(request, 'Change Config User', ['English', 'German']);
    const token = await loginForToken(request, user);
    await seedNouns(request, token);
    const params = {
        languages: ['English', 'German'], partsOfSpeech: ['Noun'], amount: 12, type: 'Multiple-Choice', multiLang: 'Multi-Language',
        difficultyMC: 2, strictnessTI: 3, wordSelection: 'Random', excludeNative: false,
    };
    const created = await request.post(`${API}/api/practice/configs`, {
        headers: authHeader(token),
        data: { name: 'Morning drill', description: 'Before work', params, wordIds: null, tagIds: null },
    });
    expect(created.ok()).toBeTruthy();

    await signIn(page, user);
    await page.goto('/practice');
    await page.getByRole('button', { name: 'Saved configurations' }).click();
    await page.getByRole('button', { name: 'Use configuration Morning drill' }).click();
    await page.getByRole('button', { name: 'Change settings first' }).click();

    // The saved name is the title; nothing to save yet.
    await expect(page.getByRole('heading', { level: 1, name: 'Morning drill' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'New configuration' })).toHaveCount(0);
    const save = page.getByRole('button', { name: 'Save configuration' });
    await expect(save).toBeDisabled();
    if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/config-change-open.png` });

    // A change turns it on; changing it back turns it off again.
    const amount = page.getByLabel('Number of exercises');
    await amount.fill('7');
    await expect(save).toBeEnabled();
    await amount.fill('12');
    await expect(save).toBeDisabled();
    await amount.fill('7');
    await save.click();

    // The dialog has the saved data and three actions.
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Save changes' })).toBeVisible();
    await expect(dialog.getByLabel(/Name/)).toHaveValue('Morning drill');
    await expect(dialog.getByLabel(/Description/)).toHaveValue('Before work');
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Save as copy' })).toBeVisible();
    if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/config-change-dialog.png` });

    // Update: the saved configuration takes the new amount.
    await dialog.getByRole('button', { name: 'Update' }).click();
    await expect(page.getByText('Configuration updated.')).toBeVisible();
    await expect(save).toBeDisabled();
    const list = (await (await request.get(`${API}/api/practice/configs`, { headers: authHeader(token) })).json()) as { name: string; params: { amount: number } }[];
    expect(list.map((c) => [c.name, c.params.amount])).toEqual([['Morning drill', 7]]);

    // Save as copy: a second configuration; the first stays as it is.
    await amount.fill('9');
    await save.click();
    await dialog.getByLabel(/Name/).fill('Morning drill (9)');
    await dialog.getByRole('button', { name: 'Save as copy' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Morning drill (9)' })).toBeVisible();
    const both = (await (await request.get(`${API}/api/practice/configs`, { headers: authHeader(token) })).json()) as { name: string; params: { amount: number } }[];
    expect(Object.fromEntries(both.map((c) => [c.name, c.params.amount]))).toEqual({ 'Morning drill': 7, 'Morning drill (9)': 9 });
});
