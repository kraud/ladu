import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { closePool, deleteUsersByEmail } from '../fixtures/db';
import {
    API,
    authHeader,
    configure,
    createdEmails,
    currentPrompt,
    goOn,
    loginForToken,
    position,
    registerAndVerify,
    signIn,
    startSession,
} from '../fixtures/practice';

/**
 * Mastered language pairs, against the real stack (`.context/features/practice.md` §A.3, decision D8).
 *
 * One account with English, German and Spanish, and four nouns in all three languages. The user
 * marks English and Spanish as a mastered pair on the Account page, and the pair is still there
 * after a reload. Then a multi-language Practice session, with 12 cards asked, answered wrong on
 * purpose so the screen shows the correct answer: the two sides of a card tell which pair it combines.
 *
 * A session takes every exercise of the pool once, so its length is words x open pairs: 4 x 3 = 12
 * without the mastered pair, 4 x 2 = 8 with it. The result is exact, not a matter of chance: 8
 * cards, 4 between English and German, 4 between German and Spanish, none between English and
 * Spanish. The save rules (2 different languages, only selected languages, at least one open pair)
 * are owned by the backend and frontend tests.
 *
 * Runs against `keelapp_e2e`; the account is deleted in `afterAll`.
 */

test.afterAll(async () => {
    await deleteUsersByEmail(createdEmails);
    await closePool();
});

/** English -> [German, Spanish] of the seeded nouns. */
const WORDS: Record<string, [string, string]> = {
    Apple: ['Apfel', 'manzana'],
    Banana: ['Banane', 'plátano'],
    Dog: ['Hund', 'perro'],
    Egg: ['Ei', 'huevo'],
};

/** Which language a word on a card is in. */
const LANGUAGE_OF = new Map<string, 'English' | 'German' | 'Spanish'>(
    Object.entries(WORDS).flatMap(([en, [de, es]]) => [
        [en, 'English'] as const,
        [de, 'German'] as const,
        [es, 'Spanish'] as const,
    ]),
);

async function seedTrilingualNouns(request: APIRequestContext, token: string) {
    for (const [english, [german, spanish]] of Object.entries(WORDS)) {
        const res = await request.post(`${API}/api/words`, {
            headers: authHeader(token),
            data: {
                partOfSpeech: 'Noun',
                translations: [
                    { language: 'English', cases: [{ caseName: 'singularEN', word: english }] },
                    { language: 'German', cases: [{ caseName: 'singularNominativDE', word: german }] },
                    { language: 'Spanish', cases: [{ caseName: 'singularES', word: spanish }] },
                ],
            },
        });
        expect(res.ok()).toBeTruthy();
    }
}

/** Answers the open card wrong, reads the correct answer the screen shows, and goes on. Returns both sides of the card. */
async function answerWrongAndRead(page: Page): Promise<{ prompt: string; solution: string }> {
    const prompt = await currentPrompt(page);
    await page.getByLabel('Your answer').fill('zzzz');
    await page.getByLabel('Your answer').press('Enter');
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    const shown = (await page.getByText(/^Correct answer: /).innerText()).trim();
    await goOn(page);
    return { prompt, solution: shown.replace(/^Correct answer: /, '') };
}

test('a mastered pair set on the Account page keeps its two languages apart in Practice', async ({ page, request }) => {
    const user = await registerAndVerify(request, 'Pairs User', ['English', 'German', 'Spanish']);
    await seedTrilingualNouns(request, await loginForToken(request, user));

    await signIn(page, user);

    await test.step('Account: add the pair English & Español and save; it is still there after a reload', async () => {
        await page.getByRole('link', { name: 'Account' }).click();
        await expect(page).toHaveURL('/user');
        await expect(page.getByText('No pairs')).toBeVisible();

        await page.getByRole('button', { name: 'Edit languages' }).click();
        await page.getByRole('combobox', { name: 'First language' }).click();
        await page.getByRole('option', { name: 'English' }).click();
        await page.getByRole('combobox', { name: 'Second language' }).click();
        await page.getByRole('option', { name: 'Español' }).click();
        await page.getByRole('button', { name: 'Add pair' }).click();
        await expect(page.getByRole('button', { name: 'Remove the pair English & Español' })).toBeVisible();
        await page.getByRole('button', { name: 'Save' }).click();

        await expect(page.getByText('User data updated successfully!')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Edit languages' })).toBeVisible();
        await page.reload();
        await expect(page.getByText('English & Español')).toBeVisible();
    });

    const cards: Array<{ prompt: string; solution: string }> = [];
    await test.step('Practice: 12 cards asked, the 8 exercises of the two open pairs given', async () => {
        await page.getByRole('link', { name: 'practice' }).click();
        await expect(page).toHaveURL(/\/practice/);
        await configure(page, { amount: 12, answer: 'Type the answer', languages: 'Different languages' });
        await startSession(page);

        for (;;) {
            const { current, total } = await position(page);
            cards.push(await answerWrongAndRead(page));
            if (current === total) break;
        }
        await expect(page.getByRole('heading', { name: 'Session results' })).toBeVisible();
    });

    await test.step('4 cards for each open pair, none between English and Spanish', async () => {
        const pairs = cards.map(({ prompt, solution }) => {
            const sides = [LANGUAGE_OF.get(prompt), LANGUAGE_OF.get(solution)];
            expect(sides, `the card "${prompt}" -> "${solution}" has a known language on each side`).not.toContain(undefined);
            return [...(sides as string[])].sort().join(' & ');
        });
        expect(pairs.filter((pair) => pair === 'English & German')).toHaveLength(4);
        expect(pairs.filter((pair) => pair === 'German & Spanish')).toHaveLength(4);
        expect(pairs.filter((pair) => pair === 'English & Spanish')).toHaveLength(0);
        expect(cards).toHaveLength(8);
    });
});
