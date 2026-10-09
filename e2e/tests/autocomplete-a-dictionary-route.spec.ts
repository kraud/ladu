import { test, expect, type Page } from '@playwright/test';
import { closePool, deleteUsersByEmail } from '../fixtures/db';
import { createdEmails, registerAndVerify, signIn, type Account } from '../fixtures/practice';

/**
 * Autocomplete through the one dictionary route — `GET /api/dictionary/:language/:pos/:query`
 * (`.context/plans/autocomplete-data-source-strategy.md` Slice A, step A3 gate).
 *
 * A signed-in user opens New word, picks a part of speech and one language, types the base
 * form, and uses the autocomplete values. Nothing is saved: the subject is the lookup.
 *
 *  1. German noun: gender and declension fill in (from the lexicon since Slice B2; see
 *     autocomplete-b-german-lexicon.spec.ts for the German lexicon cases).
 *  2. Spanish verb (library adapter): participle and present fill in.
 *  3. Spanish noun the word list does not know: the guessed gender comes as `partial`, with the
 *     "not fully sure" notice.
 *  4. Estonian adjective (Ekilex adapter, answered by the local stub): the plural fills in,
 *     and the stub received "väike" URL-encoded as UTF-8.
 *  5. An Estonian word the dictionary does not know: "we don't know this word".
 *
 * The Estonian cases need the e2e backend to use the stub: the repo-root .env must NOT set
 * EKILEX_API_URL (it would win over playwright.config.ts), and no dev backend may be
 * running already (`reuseExistingServer` would keep its environment).
 */

const EKI_STUB_URL = process.env.EKI_STUB_URL ?? 'http://localhost:4401';

test.afterAll(async () => {
    await deleteUsersByEmail(createdEmails);
    await closePool();
});

const useValues = (page: Page) => page.getByRole('button', { name: 'Use autocomplete values' });

/** New word → part of speech → one language card. */
async function openNewWord(page: Page, partOfSpeech: RegExp, language: string): Promise<void> {
    await page.goto('/addWord');
    await expect(page.getByRole('heading', { name: 'New word' })).toBeVisible();
    await page.getByRole('radio', { name: partOfSpeech }).click();
    await page.getByRole('button', { name: language }).click();
}

test.describe.serial('Autocomplete — one dictionary route (Slice A)', () => {
    let user: Account;

    test.beforeAll(async ({ request }) => {
        user = await registerAndVerify(request, 'Autocomplete User', ['English', 'Spanish', 'German', 'Estonian']);
    });

    test.beforeEach(async ({ page }) => {
        await signIn(page, user);
    });

    test('German noun: gender and declension fill in', async ({ page }) => {
        await openNewWord(page, /Noun/, 'Deutsch');
        await page.getByLabel('Singular nominative').fill('Haus');

        await useValues(page).click();
        await expect(page.getByRole('radio', { name: 'das', exact: true })).toBeChecked();
        await expect(page.getByLabel('Plural nominative')).toHaveValue('Häuser');
        await expect(page.getByLabel('Plural dative')).toHaveValue('Häusern');
        await expect(page.getByText('Autocomplete values applied')).toBeVisible();
    });

    test('Spanish verb: participle and present fill in', async ({ page }) => {
        await openNewWord(page, /Verb/, 'Español');
        await page.getByLabel('Infinitive non-finite simple').fill('bailar');

        await useValues(page).click();
        await expect(page.getByLabel('Participle non-finite simple')).toHaveValue('bailado');
        await expect(page.getByLabel('Yo').first()).toHaveValue('bailo');
    });

    test('Spanish noun the word list does not know: a guessed gender, with the "not fully sure" notice', async ({ page }) => {
        await openNewWord(page, /Noun/, 'Español');
        await page.getByLabel('Singular', { exact: true }).fill('zorplata');

        const notice = page.getByText("We're not fully sure, but here's our best guess.");
        await expect(notice).toBeVisible();
        await useValues(page).click();
        await expect(page.getByRole('radio', { name: 'la', exact: true })).toBeChecked();
        // The guess stays marked as a guess after it is applied.
        await expect(page.getByText('Autocomplete values applied')).toBeVisible();
        await expect(notice).toBeVisible();
    });

    // An adjective: Estonian adjectives always go to Ekilex (the local lexicon has none since Slice D2), so this
    // reaches the stub on every machine — a noun like "õun" may now be answered by a local full lexicon.
    test('Estonian adjective through the stub dictionary: the plural fills in, and the word reaches the service URL-encoded', async ({
        page,
        request,
    }) => {
        const before = ((await (await request.get(`${EKI_STUB_URL}/__requests`)).json()) as unknown[]).length;

        await openNewWord(page, /Adjective/, 'Eesti');
        await page.getByLabel('Positive degree').fill('väike');

        await useValues(page).click();
        await expect(page.getByLabel('Plural nominative')).toHaveValue('väikesed');

        const received = ((await (await request.get(`${EKI_STUB_URL}/__requests`)).json()) as { rawPath: string }[]).slice(before);
        expect(received, 'the backend did not call the stub — is EKILEX_API_URL set in the repo-root .env, or is a backend already running on :5001?').toContainEqual(
            expect.objectContaining({ rawPath: '/api/word/ids/v%C3%A4ike/eki/est' }),
        );
    });

    test('an Estonian word the dictionary does not know: "we don\'t know this word"', async ({ page }) => {
        await openNewWord(page, /Noun/, 'Eesti');
        await page.getByLabel('Singular nominative').fill('zorplata');

        await expect(page.getByText("Sorry, we don't know this word!")).toBeVisible();
        await expect(useValues(page)).toHaveCount(0);
    });
});
