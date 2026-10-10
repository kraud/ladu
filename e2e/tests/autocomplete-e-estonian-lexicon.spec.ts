import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { clickUseValues } from '../fixtures/autocomplete';
import { closePool, deleteUsersByEmail } from '../fixtures/db';
import { createdEmails, registerAndVerify, signIn, type Account } from '../fixtures/practice';

/**
 * Estonian autocomplete: the local lexicon (Eesthetic) first, then the Ekilex API
 * (`.context/plans/autocomplete-data-source-strategy.md` Slice D gate). The `lexemes` table holds
 * the committed Estonian fixture in CI (`--if-empty`), or the full Eesthetic data locally;
 * "maja" and "tantsima" are in both. Ekilex is the local stub (e2e/fixtures/eki-stub), whose
 * request log tells whether the backend asked it.
 *
 *  1. A noun in the lexicon fills locally: Ekilex is not asked.
 *  2. A verb in the lexicon fills every person locally.
 *  3. Adjectives (Ekilex, D20): a one-word superlative fills the field; with only "kõige …" the
 *     new checkbox is checked and the superlative shows as read-only "kõige" + comparative.
 *  4. "Search verb in English" (step F3): the translation table gives the Estonian verb ("run" →
 *     "jooksma"), so Ekilex is not asked; a word the table lacks ("zorp", made up) goes to Ekilex.
 *
 * Nothing is saved: the subject is the lookup. Needs the stub, so no other backend may be
 * running on :5001 (see e2e/README.md, "Stub servers").
 */

const EKI_STUB_URL = process.env.EKI_STUB_URL ?? 'http://localhost:4401';

test.afterAll(async () => {
    await deleteUsersByEmail(createdEmails);
    await closePool();
});

const NO_ONE_WORD_SUPERLATIVE = 'No one-word superlative (kõige + comparative)';
// The stub's log is shared by every worker (other specs run in parallel), so a check looks only
// for requests about ITS OWN word, never for an empty log.
const stubLog = async (request: APIRequestContext) =>
    ((await (await request.get(`${EKI_STUB_URL}/__requests`)).json()) as { rawPath: string }[]).map((r) => r.rawPath);
const askedAbout = (paths: string[], word: string) => paths.filter((p) => p.includes(`/${encodeURIComponent(word)}/`) || p.endsWith(`/${encodeURIComponent(word)}`));

/** New word → part of speech → the Estonian card. */
async function openEstonian(page: Page, partOfSpeech: RegExp): Promise<void> {
    await page.goto('/addWord');
    await expect(page.getByRole('heading', { name: 'New word' })).toBeVisible();
    await page.getByRole('radio', { name: partOfSpeech }).click();
    await page.getByRole('button', { name: 'Eesti' }).click();
}

test.describe.serial('Autocomplete — Estonian: lexicon first, then Ekilex (Slice D)', () => {
    let user: Account;

    test.beforeAll(async ({ request }) => {
        user = await registerAndVerify(request, 'Estonian Lexicon User', ['English', 'Estonian']);
    });

    test.beforeEach(async ({ page }) => {
        await signIn(page, user);
    });

    test('a noun in the lexicon fills locally, without asking Ekilex', async ({ page, request }) => {
        const before = (await stubLog(request)).length;
        await openEstonian(page, /Noun/);
        await page.getByLabel('Singular nominative').fill('maja');

        await clickUseValues(page);
        await expect(page.getByLabel('Plural nominative')).toHaveValue('majad');
        await expect(page.getByLabel('Plural partitive')).toHaveValue('maju');
        expect(askedAbout((await stubLog(request)).slice(before), 'maja')).toEqual([]);
    });

    test('a verb in the lexicon fills every person', async ({ page, request }) => {
        const before = (await stubLog(request)).length;
        await openEstonian(page, /Verb/);
        await page.getByLabel('-ma infinitive').fill('tantsima');

        await clickUseValues(page);
        await expect(page.getByLabel('-da infinitive')).toHaveValue('tantsida');
        expect(askedAbout((await stubLog(request)).slice(before), 'tantsima')).toEqual([]);
    });

    test('an adjective with a one-word superlative fills it, the "kõige" box stays unchecked (D20)', async ({ page }) => {
        await openEstonian(page, /Adjective/);
        await page.getByLabel('Positive degree').fill('väike');

        await clickUseValues(page);
        await expect(page.getByLabel('Comparative degree')).toHaveValue('väiksem');
        await expect(page.getByLabel('Superlative degree')).toHaveValue('väikseim');
        await expect(page.getByRole('checkbox', { name: NO_ONE_WORD_SUPERLATIVE })).not.toBeChecked();
    });

    test('an adjective with only "kõige …" checks the box and shows the superlative read-only (D20)', async ({ page }) => {
        await openEstonian(page, /Adjective/);
        await page.getByLabel('Positive degree').fill('tore');

        await clickUseValues(page);
        await expect(page.getByRole('checkbox', { name: NO_ONE_WORD_SUPERLATIVE })).toBeChecked();
        const superlative = page.getByTestId('derived-ulivorre');
        await expect(superlative).toHaveValue('kõige toredam');
        await expect(superlative).toHaveAttribute('readonly', '');
    });

    test('search verb in English takes the verb from the translation table, without Ekilex', async ({ page, request }) => {
        const before = (await stubLog(request)).length;
        await openEstonian(page, /Verb/);
        await page.getByRole('checkbox', { name: 'Search verb in english' }).click();
        await page.getByLabel('-ma infinitive').fill('run');

        await clickUseValues(page);
        await expect(page.getByLabel('-ma infinitive')).toHaveValue('jooksma');
        await expect(page.getByLabel('-da infinitive')).toHaveValue('joosta');
        expect(askedAbout((await stubLog(request)).slice(before), 'run')).toEqual([]);
    });

    test('search verb in English: a word the table lacks goes to Ekilex', async ({ page, request }) => {
        const before = (await stubLog(request)).length;
        await openEstonian(page, /Verb/);
        await page.getByRole('checkbox', { name: 'Search verb in english' }).click();
        await page.getByLabel('-ma infinitive').fill('zorp');

        await clickUseValues(page);
        await expect(page.getByLabel('-da infinitive')).toHaveValue('tantsida');
        expect((await stubLog(request)).slice(before)).toContain('/api/meaning/search/zorp');
    });
});
