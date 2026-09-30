/**
 * Shared helpers for the practice specs (`phase-5-practice.spec.ts`,
 * `phase-5-5-saved-practice.spec.ts`): accounts, seeded words, sign-in, and a
 * driver that answers cards. Accounts are registered and verified straight
 * through the API (no inbox), but every sign-in goes through the real form.
 *
 * Words are seeded as English + German nouns with only their singular forms, so
 * the only exercise of a word is "English singular <-> German singular". A session
 * gives one exercise per word, and its direction is random (the server shuffles the
 * languages). So the spec always reads the prompt from the screen and looks the
 * answer up in `TRANSLATION`; it never assumes which card, or which direction, comes.
 */
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { getVerifyToken } from './db';

export const API = process.env.E2E_API_URL ?? 'http://localhost:5001';

export interface Account {
    name: string;
    username: string;
    email: string;
    password: string;
}

const run = Date.now();
let seq = 0;

/** Emails of every account made through `registerAndVerify`, for `deleteUsersByEmail` in `afterAll`. */
export const createdEmails: string[] = [];

export async function registerAndVerify(
    request: APIRequestContext,
    name: string,
    languages: string[] = ['English', 'German'],
): Promise<Account> {
    const account: Account = {
        name,
        username: `prac${run}${++seq}`,
        email: `e2e-${run}-prac-${++seq}@ladu.test`,
        password: 'password123',
    };
    createdEmails.push(account.email);

    const res = await request.post(`${API}/api/users`, { data: { ...account, languages, uiLanguage: 'English' } });
    expect(res.status()).toBe(201);
    const { userId, token } = await getVerifyToken(account.email);
    expect((await request.get(`${API}/api/users/${userId}/verify/${token}`)).ok()).toBeTruthy();
    return account;
}

export async function loginForToken(request: APIRequestContext, account: Account): Promise<string> {
    const res = await request.post(`${API}/api/users/login`, {
        data: { email: account.email, password: account.password },
    });
    expect(res.ok()).toBeTruthy();
    return ((await res.json()) as { token: string }).token;
}

export const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

/** English word -> German word of the seeded nouns. */
export const WORDS: Record<string, string> = {
    Apple: 'Apfel',
    Banana: 'Banane',
    Carrot: 'Karotte',
    Dog: 'Hund',
    Egg: 'Ei',
    Fish: 'Fisch',
};

/** Both directions: what to type for a prompt. */
export const TRANSLATION: Record<string, string> = {
    ...WORDS,
    ...Object.fromEntries(Object.entries(WORDS).map(([en, de]) => [de, en])),
};

/** Seeds one English + German noun (singular forms only). Returns the word id. */
export async function createNoun(request: APIRequestContext, token: string, english: string, german: string) {
    const res = await request.post(`${API}/api/words`, {
        headers: authHeader(token),
        data: {
            partOfSpeech: 'Noun',
            translations: [
                { language: 'English', cases: [{ caseName: 'singularEN', word: english }] },
                { language: 'German', cases: [{ caseName: 'singularNominativDE', word: german }] },
            ],
        },
    });
    expect(res.ok()).toBeTruthy();
    return ((await res.json()) as { id: string }).id;
}

/** Seeds the six nouns of `WORDS`. Returns the word ids by English word. */
export async function seedNouns(request: APIRequestContext, token: string): Promise<Record<string, string>> {
    const ids: Record<string, string> = {};
    for (const [en, de] of Object.entries(WORDS)) ids[en] = await createNoun(request, token, en, de);
    return ids;
}

export async function signIn(page: Page, account: Account): Promise<void> {
    await page.goto('/login');
    await page.getByLabel('Email').fill(account.email);
    await page.getByLabel('Password').fill(account.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('heading', { name: new RegExp(`Welcome, ${account.name}`) })).toBeVisible();
}

/** Settings on the set-up screen. Everything not given stays as it is. */
export async function configure(
    page: Page,
    settings: { amount?: number; answer?: 'Type the answer' | 'Choose the answer' | 'Mixed'; languages?: 'Different languages' | 'Same language' | 'Mixed' },
): Promise<void> {
    if (settings.amount !== undefined) await page.getByLabel('Number of exercises').fill(String(settings.amount));
    if (settings.answer) await page.getByRole('button', { name: settings.answer, exact: true }).click();
    if (settings.languages) await page.getByRole('button', { name: settings.languages, exact: true }).click();
}

/** Starts a session and waits for its first card. */
export async function startSession(page: Page): Promise<void> {
    await page.getByRole('button', { name: 'Start session' }).click();
    await expect(page.getByRole('heading', { name: /^Exercise 1 of \d+$/ })).toBeVisible();
}

/** The word on the screen that the user must translate. */
export async function currentPrompt(page: Page): Promise<string> {
    return (await page.getByTestId('prompt').innerText()).trim();
}

/** "Exercise 2 of 3" -> { current: 2, total: 3 } */
export async function position(page: Page): Promise<{ current: number; total: number }> {
    const text = (await page.getByRole('heading', { name: /^Exercise \d+ of \d+$/ }).innerText()).trim();
    const [, current, total] = /^Exercise (\d+) of (\d+)$/.exec(text)!;
    return { current: Number(current), total: Number(total) };
}

export type Answer = 'right' | 'almost' | 'wrong';

/** What a typed answer should be for the wanted result (strictness 2, the default: only capitals are forgiven). */
export function typedAnswer(prompt: string, want: Answer): string {
    const expected = TRANSLATION[prompt];
    if (!expected) throw new Error(`unknown prompt "${prompt}"`);
    return want === 'right' ? expected : want === 'almost' ? expected.toLowerCase() : 'zzzz';
}

/**
 * Answers the open card and waits until the answer is stored on the server.
 * Typed card: types. Choice card: clicks the option. Returns the prompt it answered.
 */
export async function answerCard(page: Page, want: Answer): Promise<string> {
    const prompt = await currentPrompt(page);
    const typed = typedAnswer(prompt, want);
    const choices = page.getByRole('group', { name: 'Choose the answer' });
    if (await choices.count()) {
        // The accessible name of an option is its text (the number key hint is hidden from it).
        const expected = TRANSLATION[prompt]!;
        if (want === 'wrong') {
            const names = (await choices.getByRole('button').allInnerTexts()).map((text) => text.replace(/^\s*\d\s*/, '').trim());
            const wrong = names.find((name) => name !== expected);
            await choices.getByRole('button', { name: wrong, exact: true }).click();
        } else {
            await choices.getByRole('button', { name: expected, exact: true }).click();
        }
    } else {
        await page.getByLabel('Your answer').fill(typed);
        await page.getByLabel('Your answer').press('Enter');
    }
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    return prompt;
}

/** From the current card to the next one (or to "See results" on the last). */
export async function goOn(page: Page): Promise<void> {
    const { current, total } = await position(page);
    if (current === total) await page.getByRole('button', { name: 'See results' }).click();
    else await page.getByRole('button', { name: 'Next' }).click();
}

/** Answers every remaining card (right, unless `plan` says otherwise for that prompt), ending on the results screen. */
export async function finishSession(page: Page, plan: (prompt: string, index: number) => Answer = () => 'right') {
    const answered: Array<{ prompt: string; result: Answer }> = [];
    for (;;) {
        const { current, total } = await position(page);
        const result = plan(await currentPrompt(page), current - 1);
        const prompt = await answerCard(page, result);
        answered.push({ prompt, result });
        await goOn(page);
        if (current === total) break;
    }
    await expect(page.getByRole('heading', { name: 'Session results' })).toBeVisible();
    return answered;
}
