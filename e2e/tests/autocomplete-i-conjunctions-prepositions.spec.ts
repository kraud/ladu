import { test, expect, type Page } from '@playwright/test';
import { clickUseValues, closeTypeAheadList } from '../fixtures/autocomplete';
import { closePool, deleteUsersByEmail } from '../fixtures/db';
import { API, authHeader, createdEmails, loginForToken, registerAndVerify, signIn, type Account } from '../fixtures/practice';

/**
 * Conjunctions and prepositions in English, Spanish, German and Estonian
 * (`.context/plans/conjunctions-prepositions.md`, Slice 4 gate). The `lexemes` and `lexeme_translations`
 * tables hold the committed fixtures in CI, or the full data locally; every word below is in both. The
 * Estonian words come from the Ekilex stub (`fixtures/eki-stub/server.ts`).
 *
 *  1. German conjunctions: "und" is marked coordinating; "weil" has no type (Wiktionary marks it both);
 *     "sowohl ... als auch" and "weder … noch" fill the first part, the "Paired" box and the second part.
 *  2. Spanish "para que" is subordinating and shows the verb mood, which can be picked and cleared again.
 *  3. English "because" is subordinating; "neither … nor" is a pair.
 *  4. German prepositions: "nach" is before or after the noun with the dative; "wegen" has the dative and the
 *     genitive; the contractions box shows three forms on ONE row, on a desktop and on a phone.
 *  5. Estonian: a conjunction ("kuigi") fills the word; "pärast" fills the position and a case for each position;
 *     the position hides the case that does not apply; the series box shows two forms in a 50-50 row; the word
 *     saves, and the property values are not searchable while the written forms are.
 *  6. "Start from a word": the Conjunction type, "because", one meaning, a draft with a filled card per language.
 */

test.afterAll(async () => {
    await deleteUsersByEmail(createdEmails);
    await closePool();
});

/** New word → part of speech → the card for `language` (its native name). */
async function openCard(page: Page, partOfSpeech: RegExp, language: string): Promise<void> {
    await page.goto('/addWord');
    await expect(page.getByRole('heading', { name: 'New word' })).toBeVisible();
    await page.getByRole('radio', { name: partOfSpeech }).click();
    await page.getByRole('button', { name: language }).click();
}

/** Types a whole word, then the button fills the card (`clickUseValues` closes the type-ahead list first). */
async function typeAndFill(page: Page, fieldLabel: string, word: string): Promise<void> {
    await page.getByLabel(fieldLabel, { exact: true }).pressSequentially(word);
    await clickUseValues(page);
}

/**
 * Types a whole word whose lookup adds nothing to the typed word (only the word itself comes back): there is no
 * button to press, and the footer says the values are applied.
 */
async function typeWordOnly(page: Page, fieldLabel: string, word: string): Promise<void> {
    await page.getByLabel(fieldLabel, { exact: true }).pressSequentially(word);
    await closeTypeAheadList(page);
    await expect(page.getByText('Autocomplete values applied')).toBeVisible();
}

/** The vertical start and the width of each box, to check that fields share a row. */
async function boxes(page: Page, labels: string[]): Promise<{ y: number; width: number }[]> {
    return Promise.all(
        labels.map(async (label) => {
            const box = await page.getByLabel(label, { exact: true }).boundingBox();
            if (!box) throw new Error(`"${label}" has no box`);
            return { y: Math.round(box.y), width: Math.round(box.width) };
        })
    );
}

test.describe.serial('Autocomplete — conjunctions and prepositions (conjunctions plan, slice 4)', () => {
    let user: Account;

    test.beforeAll(async ({ request }) => {
        user = await registerAndVerify(request, 'Function Word User', ['English', 'German', 'Spanish', 'Estonian']);
    });

    test.beforeEach(async ({ page }) => {
        await signIn(page, user);
    });

    test('German conjunctions: a marked type, no type for "weil", and pairs split into their two parts', async ({ page }) => {
        await openCard(page, /Conjunction/, 'Deutsch');
        await typeAndFill(page, 'Conjunction', 'und');
        await expect(page.getByRole('radio', { name: 'Coordinating', exact: true })).toBeChecked();

        // "weil" is marked both coordinating and subordinating, so the data decides nothing: both radios stay empty.
        await openCard(page, /Conjunction/, 'Deutsch');
        await typeWordOnly(page, 'Conjunction', 'weil');
        await expect(page.getByRole('radio', { name: 'Coordinating', exact: true })).not.toBeChecked();
        await expect(page.getByRole('radio', { name: 'Subordinating', exact: true })).not.toBeChecked();
        await expect(page.getByLabel('Second part', { exact: true })).toHaveCount(0);

        await openCard(page, /Conjunction/, 'Deutsch');
        await typeAndFill(page, 'Conjunction', 'sowohl ... als auch');
        await expect(page.getByLabel('Conjunction', { exact: true })).toHaveValue('sowohl');
        await expect(page.getByRole('checkbox', { name: /Paired/ })).toBeChecked();
        await expect(page.getByLabel('Second part', { exact: true })).toHaveValue('als auch');
        await expect(page.getByRole('radio', { name: 'Coordinating', exact: true })).toBeChecked();

        // The translation table writes a pair with "…"; the lexicon has no such entry, so the pair is split by rule.
        await openCard(page, /Conjunction/, 'Deutsch');
        await typeAndFill(page, 'Conjunction', 'weder … noch');
        await expect(page.getByLabel('Conjunction', { exact: true })).toHaveValue('weder');
        await expect(page.getByRole('checkbox', { name: /Paired/ })).toBeChecked();
        await expect(page.getByLabel('Second part', { exact: true })).toHaveValue('noch');
    });

    test('Spanish "para que" is subordinating and shows the verb mood, which can be picked and cleared', async ({ page }) => {
        await openCard(page, /Conjunction/, 'Español');
        // The page has selects of its own ("Start from a word"); the card's selects come after them.
        const pageSelects = await page.getByRole('combobox').count();
        await typeAndFill(page, 'Conjunction', 'para que');
        await expect(page.getByRole('radio', { name: 'Subordinating', exact: true })).toBeChecked();

        await expect(page.getByRole('combobox')).toHaveCount(pageSelects + 1); // the mood shows for a subordinating conjunction
        const mood = page.getByRole('combobox').nth(pageSelects);
        await expect(mood).toContainText('—');
        await mood.click();
        await page.getByRole('option', { name: 'Subjunctive' }).click();
        await expect(mood).toContainText('Subjunctive');
        await mood.click();
        await page.getByRole('option', { name: '—' }).click();
        await expect(mood).toContainText('—');

        // A re-click clears an optional radio.
        await page.getByRole('radio', { name: 'Subordinating', exact: true }).click();
        await expect(page.getByRole('radio', { name: 'Subordinating', exact: true })).not.toBeChecked();
        await expect(page.getByRole('combobox')).toHaveCount(pageSelects);
    });

    test('English "because" is subordinating, and "neither … nor" is a pair', async ({ page }) => {
        await openCard(page, /Conjunction/, 'English');
        await typeAndFill(page, 'Conjunction', 'because');
        await expect(page.getByRole('radio', { name: 'Subordinating', exact: true })).toBeChecked();

        await openCard(page, /Conjunction/, 'English');
        await typeAndFill(page, 'Conjunction', 'neither … nor');
        await expect(page.getByLabel('Conjunction', { exact: true })).toHaveValue('neither');
        await expect(page.getByRole('checkbox', { name: /Paired/ })).toBeChecked();
        await expect(page.getByLabel('Second part', { exact: true })).toHaveValue('nor');
    });

    test('German prepositions: the position and the cases fill, and the contractions share one row', async ({ page }) => {
        await openCard(page, /Preposition/, 'Deutsch');
        await typeAndFill(page, 'Preposition', 'nach');
        await expect(page.getByRole('radio', { name: 'Before or after the noun', exact: true })).toBeChecked();
        await expect(page.getByRole('checkbox', { name: 'Dative', exact: true })).toBeChecked();
        await expect(page.getByRole('checkbox', { name: 'Accusative', exact: true })).not.toBeChecked();

        await openCard(page, /Preposition/, 'Deutsch');
        await typeAndFill(page, 'Preposition', 'wegen');
        await expect(page.getByRole('radio', { name: 'Before the noun', exact: true })).toBeChecked();
        await expect(page.getByRole('checkbox', { name: 'Dative', exact: true })).toBeChecked();
        await expect(page.getByRole('checkbox', { name: 'Genitive', exact: true })).toBeChecked();

        // The contractions: hidden until the box is ticked, then three forms on one row. On a phone too.
        const forms = ['With “dem” (e.g. zum)', 'With “der” (e.g. zur)', 'With “das” (e.g. ins)'];
        await expect(page.getByLabel(forms[0], { exact: true })).toHaveCount(0);
        await page.getByRole('checkbox', { name: /Contracts with the article/ }).click();
        for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
            await page.setViewportSize(viewport);
            const [dem, der, das] = await boxes(page, forms);
            expect(der.y, `der on the row of dem at ${viewport.width}px`).toBe(dem.y);
            expect(das.y, `das on the row of dem at ${viewport.width}px`).toBe(dem.y);
        }

        // The position and the cases are listed in a column: the three case boxes sit one under the other.
        await page.setViewportSize({ width: 1280, height: 900 });
        const dative = await page.getByRole('checkbox', { name: 'Dative', exact: true }).boundingBox();
        const genitive = await page.getByRole('checkbox', { name: 'Genitive', exact: true }).boundingBox();
        expect(genitive!.y).toBeGreaterThan(dative!.y);
    });

    test('Estonian conjunction and preposition: the Ekilex answers fill, the position hides a case, and the word saves', async ({ page, request }) => {
        await openCard(page, /Conjunction/, 'Eesti');
        await typeWordOnly(page, 'Conjunction', 'kuigi');
        await expect(page.getByLabel('Conjunction', { exact: true })).toHaveValue('kuigi');
        await expect(page.getByRole('checkbox', { name: /Paired/ })).not.toBeChecked();

        await openCard(page, /Preposition/, 'Eesti');
        await typeAndFill(page, 'Preposition', 'pärast');
        await expect(page.getByRole('radio', { name: 'Before or after the noun', exact: true })).toBeChecked();
        // The page has selects of its own ("Start from a word"); the card's two case selects come after them.
        const pageSelects = (await page.getByRole('combobox').count()) - 2;
        const caseSelect = (index: number) => page.getByRole('combobox').nth(pageSelects + index);
        await expect(caseSelect(0)).toContainText('Partitive');
        await expect(caseSelect(1)).toContainText('Genitive');

        // The position decides which case applies.
        await page.getByRole('radio', { name: 'After the noun', exact: true }).click();
        await expect(page.getByRole('combobox')).toHaveCount(pageSelects + 1);
        await expect(caseSelect(0)).toContainText('Genitive');
        await page.getByRole('radio', { name: 'Before the noun', exact: true }).click();
        await expect(page.getByRole('combobox')).toHaveCount(pageSelects + 1);
        await expect(caseSelect(0)).toContainText('Partitive');
        await page.getByRole('radio', { name: 'Before or after the noun', exact: true }).click();
        await expect(page.getByRole('combobox')).toHaveCount(pageSelects + 2);

        // The series box shows the two directions in a 50-50 row, on a desktop and on a phone.
        const directions = ['Where to (e.g. sisse)', 'Where from (e.g. seest)'];
        await expect(page.getByLabel(directions[0], { exact: true })).toHaveCount(0);
        await page.getByRole('checkbox', { name: /Has a where-to/ }).click();
        for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
            await page.setViewportSize(viewport);
            const [to, from] = await boxes(page, directions);
            // The row is checked by the tops of the two labels. The inputs can differ in height from each other when
            // one label wraps to two lines (a wide font on a phone: the CI browser), and that is not a different row.
            const [toLabel, fromLabel] = await Promise.all(directions.map((label) => page.getByText(label, { exact: true }).boundingBox()));
            expect(Math.round(fromLabel!.y), `from on the row of to at ${viewport.width}px`).toBe(Math.round(toLabel!.y));
            expect(Math.abs(from.width - to.width), `equal widths at ${viewport.width}px`).toBeLessThanOrEqual(2);
        }
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.getByLabel(directions[0], { exact: true }).fill('sisse');
        await page.getByLabel(directions[1], { exact: true }).fill('seest');

        // A second translation, then save.
        await page.getByRole('button', { name: 'English' }).click();
        await page.getByLabel('Preposition', { exact: true }).last().fill('after');
        await page.getByRole('button', { name: 'Save' }).click();
        await expect(page.getByText('Word was created successfully')).toBeVisible();
        await page.getByRole('button', { name: 'Click here to see the new word' }).click();
        await expect(page).toHaveURL(/\/word\/.+/);
        await page.reload();
        await expect(page.getByText('Detailed view: Preposition')).toBeVisible();
        await expect(page.getByText('pärast', { exact: true })).toBeVisible();
        await expect(page.getByText('seest', { exact: true })).toBeVisible();

        // Search finds the written forms, never the properties (position, cases).
        const token = await loginForToken(request, user);
        const search = async (q: string) =>
            ((await (await request.get(`${API}/api/words/simple?q=${encodeURIComponent(q)}`, { headers: authHeader(token) })).json()) as { items: unknown[] }).items;
        expect(await search('seest')).toHaveLength(1);
        expect(await search('Partitive')).toHaveLength(0);
        expect(await search('Before or after')).toHaveLength(0);
    });

});

// An account without Estonian: the preview then shows English, German and Spanish only.
test.describe.serial('Start from a word — conjunctions (conjunctions plan, slice 4)', () => {
    let startUser: Account;

    test.beforeAll(async ({ request }) => {
        startUser = await registerAndVerify(request, 'Function Word Start', ['English', 'German', 'Spanish']);
    });

    test.beforeEach(async ({ page }) => {
        await signIn(page, startUser);
    });

    test('a conjunction, "because", fills one card per language', async ({ page }) => {
        await page.goto('/addWord');
        await expect(page.getByTestId('start-from-word')).toBeVisible();
        await page.getByTestId('start-language').click();
        await page.getByRole('option', { name: 'EN', exact: true }).click();
        await page.getByTestId('start-pos').click();
        await page.getByRole('option', { name: 'Conjunction' }).click();

        await page.getByTestId('start-word-input').pressSequentially('becau');
        await expect(page.getByTestId('sense-list')).toBeVisible();
        await page.getByTestId('sense-list').getByRole('option').filter({ hasText: 'because' }).filter({ hasText: 'for the reason that' }).first().click();
        await expect(page.getByTestId('sense-preview')).toBeVisible();
        await expect(page.getByTestId('preview-card-German')).toContainText('weil');
        await expect(page.getByTestId('preview-card-Spanish')).toContainText('porque');
        await expect(page.getByTestId('preview-card-Estonian')).toHaveCount(0); // not an account language

        await page.getByRole('button', { name: 'Create draft' }).click();
        await expect(page.getByRole('heading', { name: 'New Conjunction' })).toBeVisible();
        await expect(page.getByLabel('Conjunction', { exact: true }).first()).toHaveValue('because');
        await expect(page.getByLabel('Conjunction', { exact: true }).nth(1)).toHaveValue('porque');
        await expect(page.getByLabel('Conjunction', { exact: true }).nth(2)).toHaveValue('weil');
        // "because" is marked subordinating in the English lexicon.
        await expect(page.getByRole('radio', { name: 'Subordinating', exact: true }).first()).toBeChecked();

        await page.getByRole('button', { name: 'Save word' }).click();
        await expect(page.getByText('Word was created successfully')).toBeVisible();
    });
});
