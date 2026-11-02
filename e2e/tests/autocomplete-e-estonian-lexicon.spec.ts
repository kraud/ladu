import { EKI_STUB_URL } from '../fixtures/env';
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { clickUseValues } from '../fixtures/autocomplete';
import { closePool, deleteUsersByEmail } from '../fixtures/db';
import { createdEmails, registerAndVerify, signIn, type Account } from '../fixtures/practice';

/**
 * Estonian autocomplete: the local lexicon (Eesthetic) first, then the Ekilex API
 * (`.context/research/autocomplete-data-source-strategy.md` Slice D gate). The `lexemes` table holds
 * the committed Estonian fixture in CI (`--if-empty`), or the full Eesthetic data locally;
 * "maja" and "tantsima" are in both. Ekilex is the local stub (e2e/fixtures/eki-stub), whose
 * request log tells whether the backend asked it.
 *
 *  1. A verb in the lexicon fills every person locally.
 *
 * Removed in the test prune pass (`.context/plans/test-prune-pass.md`): the noun (Ekilex
 * is not asked) and the two adjective cases (D20). `backend/tests/dictionary.test.js` and
 * `TranslationCard.test.tsx` own them.
 *
 * Nothing is saved: the subject is the lookup. Needs the stub: the e2e backend points at it
 * (see e2e/README.md, "Stub servers").
 */


test.afterAll(async () => {
    await deleteUsersByEmail(createdEmails);
    await closePool();
});

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

    test('a verb in the lexicon fills every person', async ({ page, request }) => {
        const before = (await stubLog(request)).length;
        await openEstonian(page, /Verb/);
        await page.getByLabel('-ma infinitive').fill('tantsima');

        await clickUseValues(page);
        await expect(page.getByLabel('-da infinitive')).toHaveValue('tantsida');
        expect(askedAbout((await stubLog(request)).slice(before), 'tantsima')).toEqual([]);
    });

});
