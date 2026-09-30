import { test, expect, type Page } from '@playwright/test';
import { closePool, deleteUsersByEmail } from '../fixtures/db';
import {
    API,
    answerCard,
    authHeader,
    configure,
    createdEmails,
    currentPrompt,
    finishSession,
    goOn,
    loginForToken,
    registerAndVerify,
    seedNouns,
    signIn,
    startSession,
    TRANSLATION,
    type Account,
    type Answer,
} from '../fixtures/practice';

/**
 * Phase 5 — practice (exercises + performance), against the real stack
 * (`.context/plans/phase-5-practice.md` Slice 9 gate).
 *
 * One account with six English/German nouns, driven in the real UI. A session gives one
 * exercise per word in a random direction, so a "form" is a prompt (word + direction):
 *
 *  1. Typed session (3 exercises): one right, one "almost" (capitals only), one
 *     wrong. A reload in the middle keeps the same card. The results show the
 *     score (almost counts as correct) and the almost-correct note.
 *  2. Sessions with all six words, repeated until an earlier form comes back: every
 *     card is checked against what was answered before — a known form shows its saved
 *     last attempts, a knowledge score and the date; a form never asked is "New".
 *     "Mastered" on a translation sets the pill, and it stays on that form.
 *  3. A multiple-choice session: the right and the wrong option.
 *  4. Review -> select two words -> Practice -> only those words appear.
 *  5. Security (API): a second account cannot save an answer for the first
 *     account's word, and cannot generate exercises from it.
 *
 * The prompt is read from the screen and the answer looked up in `TRANSLATION`,
 * so the run does not depend on which cards the server picks. Runs against
 * `keelapp_v2_dev`; every account is deleted in `afterAll` (words, performances
 * and saved practice cascade off `users`).
 */

test.afterAll(async () => {
    await deleteUsersByEmail(createdEmails);
    await closePool();
});

const indicator = (page: Page) => page.getByTestId('indicator');
const attempts = (page: Page) => indicator(page).getByRole('list', { name: 'Last attempts' });

test.describe.serial('Phase 5 — practice', () => {
    let owner: Account;
    let other: Account;
    let ownerToken: string;
    let wordIds: Record<string, string>;
    /** What session 1 answered, by prompt. */
    const firstRound = new Map<string, Answer>();
    /** Every answer given so far, by form (prompt): `true` = counted as correct. The indicator must show exactly this. */
    const history = new Map<string, boolean[]>();
    const remember = (prompt: string, result: Answer) =>
        history.set(prompt, [...(history.get(prompt) ?? []), result !== 'wrong']);

    test.beforeAll(async ({ request }) => {
        owner = await registerAndVerify(request, 'Practice Owner');
        other = await registerAndVerify(request, 'Practice Other');
        ownerToken = await loginForToken(request, owner);
        wordIds = await seedNouns(request, ownerToken);
    });

    test('a typed session: right, almost, wrong; a reload keeps the card; the results show the score', async ({ page }) => {
        await signIn(page, owner);
        await page.getByRole('link', { name: 'practice' }).click();
        await expect(page).toHaveURL(/\/practice/);

        await test.step('the set-up starts with the documented defaults', async () => {
            await expect(page.getByLabel('Number of exercises')).toHaveValue('10');
            await expect(page.getByRole('button', { name: 'Type the answer', pressed: true })).toBeVisible();
            await expect(page.getByRole('button', { name: 'Noun', pressed: true })).toBeVisible();
        });

        await configure(page, { amount: 3, answer: 'Type the answer', languages: 'Different languages' });
        await startSession(page);

        await test.step('card 1: the right answer', async () => {
            {
                const prompt = await answerCard(page, 'right');
                firstRound.set(prompt, 'right');
                remember(prompt, 'right');
            }
            await expect(page.getByRole('status').filter({ hasText: 'Correct' }).first()).toBeVisible();
            await goOn(page);
        });

        await test.step('a reload on card 2 opens the same card', async () => {
            await expect(page.getByRole('heading', { name: 'Exercise 2 of 3' })).toBeVisible();
            const before = await currentPrompt(page);
            await page.reload();
            await expect(page.getByRole('heading', { name: 'Exercise 2 of 3' })).toBeVisible();
            expect(await currentPrompt(page)).toBe(before);
        });

        await test.step('card 2: almost (capitals only) counts as correct', async () => {
            {
                const prompt = await answerCard(page, 'almost');
                firstRound.set(prompt, 'almost');
                remember(prompt, 'almost');
            }
            await expect(page.getByText('Almost correct')).toBeVisible();
            await goOn(page);
        });

        await test.step('card 3: wrong, with the correct answer shown', async () => {
            const prompt = await answerCard(page, 'wrong');
            firstRound.set(prompt, 'wrong');
            remember(prompt, 'wrong');
            await expect(page.getByText(`Correct answer: ${TRANSLATION[prompt]}`)).toBeVisible();
            await goOn(page);
        });

        await test.step('the results: 2 of 3 correct, with the almost note', async () => {
            await expect(page.getByRole('heading', { name: 'Session results' })).toBeVisible();
            await expect(page.getByTestId('score')).toHaveText('2 of 3');
            await expect(page.getByText('includes 1 almost correct')).toBeVisible();
        });
    });

    test('the saved attempts show on re-entry; Mastered sets the status', async ({ page }) => {
        await signIn(page, owner);
        await page.goto('/practice');
        await configure(page, { amount: 6, answer: 'Type the answer', languages: 'Different languages' });

        let masteredForm: string | null = null;
        let checkedKnown = 0;

        // One session per round: all six words. Stop once a form answered before has come back and was checked.
        for (let round = 1; round <= 5 && checkedKnown === 0; round++) {
            if (round > 1) {
                await page.getByRole('button', { name: 'Change settings' }).first().click();
                await configure(page, { amount: 6, answer: 'Type the answer', languages: 'Different languages' });
            }
            await startSession(page);
            await expect(page.getByRole('heading', { name: 'Exercise 1 of 6' })).toBeVisible();

            for (let index = 0; index < 6; index++) {
                const prompt = await currentPrompt(page);
                const before = history.get(prompt);

                if (before) {
                    // Known form: not "New"; the stored attempts (the last four) are on the indicator, oldest first.
                    const window = before.slice(-4);
                    await expect(indicator(page)).not.toContainText('New');
                    await expect(indicator(page)).toContainText('Last practiced');
                    await expect(attempts(page).getByText('Right', { exact: true })).toHaveCount(window.filter(Boolean).length);
                    await expect(attempts(page).getByText('Wrong', { exact: true })).toHaveCount(window.filter((ok) => !ok).length);
                    checkedKnown++;
                } else {
                    await expect(indicator(page)).toContainText('New');
                }
                if (prompt === masteredForm) await expect(page.getByTestId('status')).toContainText('Mastered');

                await answerCard(page, 'right');
                remember(prompt, 'right');

                if (masteredForm === null) {
                    await test.step('Mastered on the first translation', async () => {
                        await page.getByRole('button', { name: 'Mastered', exact: true }).click();
                        const dialog = page.getByRole('alertdialog');
                        await expect(dialog.getByText(/as mastered\?$/)).toBeVisible();
                        await dialog.getByRole('button', { name: 'Mastered', exact: true }).click();
                        await expect(page.getByTestId('status')).toContainText('Mastered');
                        masteredForm = prompt;
                    });
                }
                // The new attempt is stored: the answered card shows it as the last one.
                await expect(attempts(page).getByText('Right', { exact: true }).last()).toBeVisible();
                await goOn(page);
            }
            await expect(page.getByTestId('score')).toHaveText('6 of 6');
        }

        expect(masteredForm).not.toBeNull();
        expect(checkedKnown).toBeGreaterThan(0);
    });

    test('a multiple-choice session: the right and the wrong option', async ({ page }) => {
        await signIn(page, owner);
        await page.goto('/practice');
        await configure(page, { amount: 2, answer: 'Choose the answer', languages: 'Different languages' });
        await startSession(page);

        await answerCard(page, 'right');
        await expect(page.locator('[data-state="right"]')).toHaveCount(1);
        await goOn(page);

        await answerCard(page, 'wrong');
        await expect(page.locator('[data-state="wrong"]')).toHaveCount(1);
        await expect(page.locator('[data-state="right"]')).toHaveCount(1);
        await goOn(page);

        await expect(page.getByTestId('score')).toHaveText('1 of 2');
    });

    test('Review -> select two words -> Practice: only those words appear', async ({ page }) => {
        await signIn(page, owner);
        await page.getByRole('link', { name: 'review' }).click();
        await expect(page).toHaveURL('/review');

        await page.getByRole('row', { name: /Apple/ }).getByRole('checkbox').click();
        await page.getByRole('row', { name: /Banana/ }).getByRole('checkbox').click();
        await page.getByRole('button', { name: 'Practice', exact: true }).click();

        await expect(page).toHaveURL(/\/practice/);
        await expect(page.getByText('Practice with 2 selected words')).toBeVisible();

        await configure(page, { amount: 4, answer: 'Type the answer', languages: 'Different languages' });
        await startSession(page);
        const answered = await finishSession(page, () => 'right');

        expect(answered.length).toBeGreaterThan(0);
        for (const { prompt } of answered) expect(['Apple', 'Apfel', 'Banana', 'Banane']).toContain(prompt);
        // The results list the words of the pre-selection.
        await expect(page.getByTestId('score')).toHaveText(`${answered.length} of ${answered.length}`);
    });

    test('security: a second account cannot save an answer for, or generate from, the first account\'s word', async ({ request }) => {
        const otherToken = await loginForToken(request, other);

        const word = await request.get(`${API}/api/words/${wordIds.Apple}`, { headers: authHeader(ownerToken) });
        const translations = ((await word.json()) as { translations: Array<{ id: string; language: string }> }).translations;
        const german = translations.find((t) => t.language === 'German')!;

        // The owner can.
        const own = await request.post(`${API}/api/exercises/answers`, {
            headers: authHeader(ownerToken),
            data: { translationId: german.id, caseName: 'singularNominativDE', result: 'correct' },
        });
        expect(own.status()).toBe(200);

        // The other account gets "not found" — the same answer as for an id that does not exist.
        const foreign = await request.post(`${API}/api/exercises/answers`, {
            headers: authHeader(otherToken),
            data: { translationId: german.id, caseName: 'singularNominativDE', result: 'correct' },
        });
        expect(foreign.status()).toBe(404);

        const generate = await request.post(`${API}/api/exercises/generate`, {
            headers: authHeader(otherToken),
            data: {
                languages: ['English', 'German'],
                partsOfSpeech: ['Noun'],
                amount: 5,
                type: 'Text-Input',
                multiLang: 'Multi-Language',
                wordIds: [wordIds.Apple],
            },
        });
        expect(generate.status()).toBe(200);
        expect(((await generate.json()) as { exercises: unknown[] }).exercises).toEqual([]);
    });
});
