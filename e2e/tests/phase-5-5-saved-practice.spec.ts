import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { closePool, deleteUsersByEmail, expirePracticeSessions } from '../fixtures/db';
import {
    API,
    answerCard,
    authHeader,
    configure,
    createdEmails,
    currentPrompt,
    goOn,
    loginForToken,
    position,
    registerAndVerify,
    seedNouns,
    signIn,
    startSession,
    TRANSLATION,
    type Account,
} from '../fixtures/practice';

/**
 * Phase 5.5 — saved practice configurations and sessions, against the real stack
 * (`.context/plans/phase-5-5-saved-practice.md` Slice 5 gate).
 *
 * One account with six English/German nouns, driven in the real UI:
 *
 *  1. Configurations: save the settings on screen with a name and a description; a
 *     duplicate name (any letter case) is refused; one tap on the row fills the form
 *     again after a fresh visit; edit renames it; delete asks first.
 *  2. Configurations with words: from Review select two words, save; delete one word;
 *     loading it shows the small "some words are missing" banner and practices only
 *     the word that is left.
 *  2b. Configurations with tags: pick a tag in the sidebar (it is not offered again), save; the
 *     configuration stores the tag; loading it brings the tag back; when the tag is deleted,
 *     loading falls back to the saved words and shows the "some words are missing" banner.
 *  2c. Selecting a configuration asks "start now or change first"; "Start session" opens the first
 *     exercise without the settings screen.
 *  3. Sessions: answer a card, leave with "Save session and leave"; the list shows it;
 *     resume opens the same card with the answer kept; leaving again updates the SAME
 *     saved session (still one row); finishing removes it; "Leave session and delete"
 *     saves nothing.
 *  4. Limits (API + UI): the 11th saved session replaces the oldest, so 10 remain; an
 *     expired session disappears from the list.
 *  5. Privacy (API): a second account sees none of it, and gets 404 for every id.
 *
 * The prompt is read from the screen and the answer looked up in `TRANSLATION`, so the
 * run does not depend on which cards the server picks. Runs against `keelapp_v2_dev`;
 * every account is deleted in `afterAll` (configurations and sessions cascade off `users`).
 */

test.afterAll(async () => {
    await deleteUsersByEmail(createdEmails);
    await closePool();
});

const configRow = (page: Page, name: string) => page.getByRole('button', { name: `Use configuration ${name}` });
/**
 * The set-up screen has two tabs (Ongoing sessions is the default, then Saved configurations) and a
 * "New configuration" button that opens the settings view; that view hides the tabs, with an arrow back.
 */
const showTabs = async (page: Page) => {
    const back = page.getByRole('button', { name: 'Back to Practice' });
    if (await back.isVisible()) await back.click();
};
const openSessionsTab = async (page: Page) => {
    await showTabs(page);
    await page.getByRole('tab', { name: 'Ongoing sessions' }).click();
};
const openConfigurationsTab = async (page: Page) => {
    await showTabs(page);
    await page.getByRole('tab', { name: 'Saved configurations' }).click();
};
const openNewConfigurationTab = async (page: Page) => {
    const open = page.getByRole('button', { name: 'New configuration' });
    if (await open.isVisible()) await open.click();
};
/** Selecting a saved configuration asks "start now or change first"; these tests take the second way. */
const loadConfig = async (page: Page, name: string) => {
    await configRow(page, name).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Change settings first' }).click();
};
const sessionRows = (page: Page) => page.getByRole('button', { name: /^Resume session with / });

/** A minimal valid session snapshot for seeding the API (the shape the frontend stores). */
function snapshot(tag: string) {
    const exercise = {
        key: `k-${tag}`,
        type: 'Text-Input',
        multiLang: true,
        partOfSpeech: 'Noun',
        wordId: 'w',
        translationId: 't',
        prompt: { language: 'English', caseName: 'singularEN', value: 'Apple' },
        answer: { language: 'German', caseName: 'singularNominativDE', value: 'Apfel' },
        performance: null,
    };
    return {
        userId: 'seed',
        params: { languages: ['English', 'German'], amount: 1, tag },
        wordIds: null,
        preselected: null,
        requested: 1,
        exercises: [exercise],
        answers: [null],
        current: 0,
        view: 'exercises',
        returnToResults: false,
    };
}

async function saveSessionViaApi(request: APIRequestContext, token: string, tag: string): Promise<string> {
    const res = await request.post(`${API}/api/practice/sessions`, { headers: authHeader(token), data: { snapshot: snapshot(tag) } });
    expect(res.status()).toBe(201);
    return ((await res.json()) as { id: string }).id;
}

async function savedSessions(request: APIRequestContext, token: string) {
    const res = await request.get(`${API}/api/practice/sessions`, { headers: authHeader(token) });
    expect(res.ok()).toBeTruthy();
    return (await res.json()) as Array<{ id: string; summary: { answered: number; total: number } }>;
}

async function leaveWith(page: Page, button: 'Save session and leave' | 'Leave session and delete') {
    await page.getByRole('button', { name: 'Leave session' }).click();
    await page.getByRole('dialog').getByRole('button', { name: button }).click();
}

test.describe.serial('Phase 5.5 — saved practice', () => {
    let owner: Account;
    let other: Account;
    let ownerToken: string;
    let wordIds: Record<string, string>;
    /** Ids collected on the way, for the privacy test. */
    let configId = '';
    let sessionId = '';

    test.beforeAll(async ({ request }) => {
        owner = await registerAndVerify(request, 'Saved Owner');
        other = await registerAndVerify(request, 'Saved Other');
        ownerToken = await loginForToken(request, owner);
        wordIds = await seedNouns(request, ownerToken);
    });

    test('configurations: save, refuse a duplicate name, load, edit, delete', async ({ page }) => {
        await signIn(page, owner);
        await page.goto('/practice');
        await openConfigurationsTab(page);
        await expect(page.getByText(/You have no saved configurations/)).toBeVisible();

        await test.step('save the settings on screen', async () => {
            await configure(page, { amount: 7, answer: 'Choose the answer', languages: 'Different languages' });
            await page.getByRole('button', { name: 'Save configuration' }).click();
            const dialog = page.getByRole('dialog');
            await dialog.getByLabel(/Name/).fill('Morning drill');
            await dialog.getByLabel('Description (optional)').fill('Seven quick choices');
            await dialog.getByRole('button', { name: 'Save', exact: true }).click();

            await expect(page.getByText('Configuration saved.')).toBeVisible();
            await openConfigurationsTab(page);
            await expect(configRow(page, 'Morning drill')).toBeVisible();
            await expect(configRow(page, 'Morning drill')).toContainText('Seven quick choices');
            await expect(configRow(page, 'Morning drill')).toContainText('7');
            await expect(configRow(page, 'Morning drill')).toContainText('exercises');
            // Saving never starts a session.
            await expect(page.getByRole('heading', { name: 'Practice', level: 1 })).toBeVisible();
        });

        await test.step('the same name is refused, in any letter case', async () => {
            await openNewConfigurationTab(page);
            await page.getByRole('button', { name: 'Save configuration' }).click();
            const dialog = page.getByRole('dialog');
            await dialog.getByLabel(/Name/).fill('MORNING DRILL');
            await dialog.getByRole('button', { name: 'Save', exact: true }).click();
            await expect(dialog.getByText('You already have a configuration with this name.')).toBeVisible();
            await dialog.getByRole('button', { name: 'Cancel' }).click();
        });

        await test.step('a fresh visit starts from the defaults; one tap on the row fills the form', async () => {
            // Nothing was started, so nothing is remembered: this is the default set-up.
            await page.goto('/practice');
            await openNewConfigurationTab(page);
            await expect(page.getByLabel('Number of exercises')).toHaveValue('10');
            await expect(page.getByRole('button', { name: 'Type the answer', pressed: true })).toBeVisible();

            await openConfigurationsTab(page);
            await loadConfig(page, 'Morning drill');
            // Loading switches to the New configuration view, where the settings are.
            await expect(page.getByLabel('Number of exercises')).toHaveValue('7');
            await expect(page.getByRole('button', { name: 'Choose the answer', pressed: true })).toBeVisible();
            await expect(page.getByRole('button', { name: 'Different languages', pressed: true })).toBeVisible();
            await expect(page).toHaveURL(/n=7/);
        });

        await test.step('edit renames it and keeps its settings', async () => {
            await openConfigurationsTab(page);
            await page.getByRole('button', { name: 'Edit configuration Morning drill' }).click();
            const dialog = page.getByRole('dialog');
            await dialog.getByLabel(/Name/).fill('Evening drill');
            await dialog.getByRole('button', { name: 'Save', exact: true }).click();
            await expect(page.getByText('Configuration updated.')).toBeVisible();
            await expect(configRow(page, 'Evening drill')).toContainText('7');
            await expect(configRow(page, 'Evening drill')).toContainText('exercises');
            await expect(configRow(page, 'Morning drill')).toHaveCount(0);
        });

        await test.step('delete asks first', async () => {
            await page.getByRole('button', { name: 'Delete configuration Evening drill' }).click();
            await expect(page.getByText('Delete "Evening drill"?')).toBeVisible();
            await page.getByRole('button', { name: 'Cancel' }).click();
            await expect(configRow(page, 'Evening drill')).toBeVisible();

            await page.getByRole('button', { name: 'Delete configuration Evening drill' }).click();
            await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
            await expect(page.getByText('Configuration deleted.')).toBeVisible();
            await expect(page.getByText(/You have no saved configurations/)).toBeVisible();
        });
    });

    test('a configuration with words: a deleted word is reported, and only the word that is left is practised', async ({ page, request }) => {
        await signIn(page, owner);
        await page.getByRole('link', { name: 'words', exact: true }).click();
        await expect(page).toHaveURL('/words');

        await page.getByRole('row', { name: /Apple/ }).getByRole('checkbox').click();
        await page.getByRole('row', { name: /Banana/ }).getByRole('checkbox').click();
        await page.getByRole('button', { name: 'Practice', exact: true }).click();
        await expect(page.getByText('Practice with 2 selected words')).toBeVisible();

        await configure(page, { amount: 2, answer: 'Type the answer', languages: 'Different languages' });
        await page.getByRole('button', { name: 'Save configuration' }).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog.getByText('This configuration includes 2 selected words.')).toBeVisible();
        await dialog.getByLabel(/Name/).fill('Two fruits');
        await dialog.getByRole('button', { name: 'Save', exact: true }).click();
        await openConfigurationsTab(page);
        await expect(configRow(page, 'Two fruits')).toContainText('2 selected words');

        const list = await request.get(`${API}/api/practice/configs`, { headers: authHeader(ownerToken) });
        configId = ((await list.json()) as Array<{ id: string }>)[0]!.id;

        await test.step('Banana is deleted', async () => {
            const res = await request.delete(`${API}/api/words/${wordIds.Banana}`, { headers: authHeader(ownerToken) });
            expect(res.ok()).toBeTruthy();
        });

        await test.step('loading the configuration shows the banner and one word', async () => {
            await page.goto('/practice');
            await openConfigurationsTab(page);
            await expect(configRow(page, 'Two fruits')).toContainText('Some words are missing');
            await loadConfig(page, 'Two fruits');

            await expect(page.getByText('Some words of this configuration are not available now.')).toBeVisible();
            await expect(page.getByText('Practice with 1 selected word')).toBeVisible();
            await expect(page.getByLabel('Number of exercises')).toHaveValue('2');
        });

        await test.step('the session has exactly the word that is left', async () => {
            await startSession(page);
            await expect(page.getByRole('heading', { name: 'Exercise 1 of 1' })).toBeVisible();
            expect(['Apple', 'Apfel']).toContain(await currentPrompt(page));
        });
    });

    test('a configuration with tags: saved with the tag, loaded back; a deleted tag falls back to the saved words', async ({ page, request }) => {
        // Banana was deleted by the test before; Apple and Carrot are still there.
        const created = await request.post(`${API}/api/tags`, {
            headers: authHeader(ownerToken),
            data: { label: 'Snacks', visibility: 'Private', wordIds: [wordIds.Apple, wordIds.Carrot] },
        });
        expect(created.ok()).toBeTruthy();
        const tagId = ((await created.json()) as { id: string }).id;

        await signIn(page, owner);
        await page.goto('/practice');
        await openNewConfigurationTab(page);

        await test.step('pick the tag; it is not offered again', async () => {
            await page.getByPlaceholder('Filter by tag…').click();
            await page.getByRole('option', { name: /Snacks/ }).click();
            await page.keyboard.press('Escape');
            await expect(page.getByText('Practice with 2 selected words')).toBeVisible();

            await page.getByPlaceholder('Filter by tag…').click();
            await expect(page.getByRole('option', { name: /Snacks/ })).toHaveCount(0);
            await page.keyboard.press('Escape');
        });

        await test.step('save: the dialog says the tag is saved too', async () => {
            await page.getByRole('button', { name: 'Save configuration' }).click();
            const dialog = page.getByRole('dialog');
            await expect(dialog.getByText(/includes the words of 1 tag/)).toBeVisible();
            await dialog.getByLabel(/Name/).fill('Snack drill');
            await dialog.getByRole('button', { name: 'Save', exact: true }).click();
            await expect(page.getByText('Configuration saved.')).toBeVisible();

            const list = await request.get(`${API}/api/practice/configs`, { headers: authHeader(ownerToken) });
            const saved = ((await list.json()) as Array<{ name: string; tagIds: string[] | null; wordIds: string[] | null }>).find(
                (config) => config.name === 'Snack drill',
            );
            expect(saved?.tagIds).toEqual([tagId]);
            expect([...(saved?.wordIds ?? [])].sort()).toEqual([wordIds.Apple, wordIds.Carrot].sort());
        });

        await test.step('a fresh visit: loading the configuration brings the tag back', async () => {
            await page.goto('/practice');
            await openConfigurationsTab(page);
            await loadConfig(page, 'Snack drill');
            await expect(page.getByRole('region', { name: 'Snacks' })).toBeVisible();
            await expect(page.getByText('Practice with 2 selected words')).toBeVisible();
            await expect(page.getByText('Some words of this configuration are not available now.')).toHaveCount(0);
        });

        await test.step('the tag is deleted: loading falls back to the saved words, with the banner', async () => {
            const gone = await request.delete(`${API}/api/tags/${tagId}`, { headers: authHeader(ownerToken) });
            expect(gone.ok()).toBeTruthy();

            await page.goto('/practice');
            await openConfigurationsTab(page);
            await loadConfig(page, 'Snack drill');
            await expect(page.getByText('Some words of this configuration are not available now.')).toBeVisible();
            await expect(page.getByText('Practice with 2 selected words')).toBeVisible();
            await expect(page.getByRole('region', { name: 'Snacks' })).toHaveCount(0);
        });

        await test.step('"Start session" in the dialog skips the settings and opens the first exercise', async () => {
            await page.goto('/practice');
            await openConfigurationsTab(page);
            await configRow(page, 'Snack drill').click();
            await page.getByRole('dialog').getByRole('button', { name: 'Start session' }).click();

            // The tag is gone, so the saved words (Apple, Carrot) are used.
            await expect(page.getByRole('heading', { name: /^Exercise 1 of \d+$/ })).toBeVisible();
            expect(['Apple', 'Apfel', 'Carrot', 'Karotte']).toContain(await currentPrompt(page));
        });

        // Leave nothing behind: later tests count the owner's configurations.
        const list = await request.get(`${API}/api/practice/configs`, { headers: authHeader(ownerToken) });
        const mine = ((await list.json()) as Array<{ id: string; name: string }>).find((config) => config.name === 'Snack drill');
        expect(mine).toBeDefined();
        expect((await request.delete(`${API}/api/practice/configs/${mine!.id}`, { headers: authHeader(ownerToken) })).status()).toBe(204);
    });

    test('sessions: save and leave, resume, leave again (same row), finish; leave and delete saves nothing', async ({ page, request }) => {
        // The "Session saved" toast (bottom centre, 5 s) covers the next click target; Playwright waits it out. ~15 s in all.
        test.slow();
        await signIn(page, owner);
        await page.goto('/practice');
        await openSessionsTab(page);
        await expect(page.getByText(/You have no saved sessions/)).toBeVisible();

        await test.step('answer one card, go on, save and leave', async () => {
            await configure(page, { amount: 3, answer: 'Type the answer', languages: 'Different languages' });
            await startSession(page);
            await answerCard(page, 'right');
            await goOn(page);
            await expect(page.getByRole('heading', { name: 'Exercise 2 of 3' })).toBeVisible();

            await page.getByRole('button', { name: 'Leave session' }).click();
            await expect(page.getByRole('dialog').getByText(/up to 10 saved sessions for 7 days/)).toBeVisible();
            await page.getByRole('dialog').getByRole('button', { name: 'Save session and leave' }).click();

            await expect(page.getByText('Session saved. You can resume it from the set-up screen.')).toBeVisible();
            await openSessionsTab(page);
            await expect(sessionRows(page)).toHaveCount(1);
            await expect(sessionRows(page).first()).toContainText('1 of 3');
            await expect(sessionRows(page).first()).toContainText(/Expires on/);
        });

        await test.step('the saved session is on the server, with a summary built there', async () => {
            const [saved] = await savedSessions(request, ownerToken);
            expect(saved!.summary).toMatchObject({ answered: 1, total: 3 });
            sessionId = saved!.id;
        });

        await test.step('resume opens the same card; the first answer is kept', async () => {
            await sessionRows(page).first().click();
            await expect(page.getByRole('heading', { name: 'Exercise 2 of 3' })).toBeVisible();
            // The saved copy stays while the session is open.
            expect(await savedSessions(request, ownerToken)).toHaveLength(1);

            await page.getByRole('button', { name: 'Previous' }).click();
            await expect(page.getByRole('heading', { name: 'Exercise 1 of 3' })).toBeVisible();
            await expect(page.getByLabel('Your answer')).toHaveValue(TRANSLATION[await currentPrompt(page)]!);
            await goOn(page);
        });

        await test.step('leaving again updates the same saved session', async () => {
            await answerCard(page, 'wrong');
            await goOn(page);
            await leaveWith(page, 'Save session and leave');

            await openSessionsTab(page);
            await expect(sessionRows(page)).toHaveCount(1);
            await expect(sessionRows(page).first()).toContainText('2 of 3');
            const saved = await savedSessions(request, ownerToken);
            expect(saved).toHaveLength(1);
            expect(saved[0]!.id).toBe(sessionId);
            expect(saved[0]!.summary.answered).toBe(2);
        });

        await test.step('finishing the resumed session removes the saved copy', async () => {
            await sessionRows(page).first().click();
            await expect(page.getByRole('heading', { name: /^Exercise \d of 3$/ })).toBeVisible();
            // Open cards only: the answered ones keep their answers.
            for (;;) {
                const { current, total } = await position(page);
                const answeredAlready = await page.getByText('Saved', { exact: true }).count();
                if (!answeredAlready) await answerCard(page, 'right');
                await goOn(page);
                if (current === total) break;
            }
            await expect(page.getByRole('heading', { name: 'Session results' })).toBeVisible();
            await expect.poll(async () => (await savedSessions(request, ownerToken)).length).toBe(0);
        });

        await test.step('"Leave session and delete" saves nothing', async () => {
            await page.getByRole('button', { name: 'Change settings' }).first().click();
            await configure(page, { amount: 2, answer: 'Type the answer', languages: 'Different languages' });
            await startSession(page);
            await answerCard(page, 'right');
            await leaveWith(page, 'Leave session and delete');

            await expect(page.getByRole('heading', { name: 'Practice', level: 1 })).toBeVisible();
            await openSessionsTab(page);
            await expect(page.getByText(/You have no saved sessions/)).toBeVisible();
            expect(await savedSessions(request, ownerToken)).toHaveLength(0);
        });
    });

    test('limits: the 11th saved session replaces the oldest; an expired session disappears', async ({ page, request }) => {
        const ids: string[] = [];
        for (let i = 1; i <= 11; i++) ids.push(await saveSessionViaApi(request, ownerToken, `s${i}`));

        await test.step('10 remain, and the first one is the one that went', async () => {
            const saved = await savedSessions(request, ownerToken);
            expect(saved).toHaveLength(10);
            const kept = saved.map((s) => s.id);
            expect(kept).not.toContain(ids[0]);
            expect(kept).toContain(ids[10]);
        });

        await signIn(page, owner);
        await page.goto('/practice');
        await openSessionsTab(page);
        await test.step('the list shows the 10', async () => {
            await expect(sessionRows(page)).toHaveCount(10);
        });

        await test.step('the user can delete one to manage the list', async () => {
            await page.getByRole('button', { name: /^Delete session with / }).first().click();
            await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
            await expect(page.getByText('Session deleted.')).toBeVisible();
            await expect(sessionRows(page)).toHaveCount(9);
        });

        await test.step('after 7 days they are gone (expiry moved to the past in the database)', async () => {
            expect(await expirePracticeSessions(owner.email)).toBe(9);
            expect(await savedSessions(request, ownerToken)).toHaveLength(0);
            await page.goto('/practice');
            await openSessionsTab(page);
            await expect(page.getByText(/You have no saved sessions/)).toBeVisible();
        });
    });

    test('privacy: a second account sees none of it and gets 404 for every id', async ({ request }) => {
        // A session and a configuration of the owner to try to reach.
        sessionId = await saveSessionViaApi(request, ownerToken, 'private');
        const otherToken = await loginForToken(request, other);
        const bob = authHeader(otherToken);

        expect(await savedSessions(request, otherToken)).toEqual([]);
        const configs = await request.get(`${API}/api/practice/configs`, { headers: bob });
        expect(await configs.json()).toEqual([]);

        expect((await request.get(`${API}/api/practice/sessions/${sessionId}`, { headers: bob })).status()).toBe(404);
        expect(
            (await request.put(`${API}/api/practice/sessions/${sessionId}`, { headers: bob, data: { snapshot: snapshot('x') } })).status(),
        ).toBe(404);
        expect((await request.delete(`${API}/api/practice/sessions/${sessionId}`, { headers: bob })).status()).toBe(404);

        expect((await request.get(`${API}/api/practice/configs/${configId}/words`, { headers: bob })).status()).toBe(404);
        expect((await request.delete(`${API}/api/practice/configs/${configId}`, { headers: bob })).status()).toBe(404);

        // Still there for the owner.
        expect(await savedSessions(request, ownerToken)).toHaveLength(1);
        const mine = await request.get(`${API}/api/practice/configs`, { headers: authHeader(ownerToken) });
        expect(((await mine.json()) as unknown[]).length).toBe(1);
    });
});
