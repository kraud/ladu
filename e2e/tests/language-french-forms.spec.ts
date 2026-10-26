import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { closeTypeAheadList } from '../fixtures/autocomplete';
import { closePool, deleteUsersByEmail } from '../fixtures/db';
import {
    API,
    authHeader,
    configure,
    createdEmails,
    currentPrompt,
    goOn,
    loginForToken,
    registerAndVerify,
    signIn,
    startSession,
    type Account,
} from '../fixtures/practice';

/**
 * French word forms (`.context/plans/language-french.md`). Slice 4: the noun and the adjective.
 * Slice 5: the verb. Slice 6: the adverb, the conjunction and the preposition.
 *
 *  1. A French noun: gender (le / la), singular, plural. It saves and shows in the words table.
 *  2. A French adjective: the four agreement forms, the "plus" comparative (derived and stored), the
 *     vowel form behind its box (beau → bel), and the position.
 *  3. A French verb with être: the infinitive, the participles, the group, and the passé composé with the
 *     conjugated auxiliary before each box. A reflexive verb shows the pronoun before the auxiliary.
 *  4. A French adverb: the "plus" box derives the comparative and the superlative; an irregular adverb
 *     (bien → mieux → le mieux) is typed; "Non-gradable" hides the degrees.
 *  5. A French conjunction: a pair (soit … soit) and the mood select with the conditional.
 *  6. A French preposition: the word and the position ("durant" can follow the noun).
 *  7. Practice with French (slice 7): words in English, Spanish, German and French. Cross-language cards
 *     between French and Spanish, and between French and German, with no English card; the gender
 *     drill of a noun; the tense card, the participle drill and the auxiliary / group drills of a verb.
 *
 * No autocomplete runs for French yet (slices 8 to 10).
 */

test.afterAll(async () => {
    await deleteUsersByEmail(createdEmails);
    await closePool();
});

/** New word → the part of speech. */
async function openNewWord(page: Page, partOfSpeech: RegExp): Promise<void> {
    await page.goto('/addWord');
    await expect(page.getByRole('heading', { name: 'New word' })).toBeVisible();
    await page.getByRole('radio', { name: partOfSpeech }).click();
}

async function saveAndOpen(page: Page): Promise<void> {
    const save = page.getByRole('button', { name: 'Save' });
    await expect(save).toBeEnabled();
    await save.click();
    await expect(page.getByText('Word was created successfully')).toBeVisible();
    await page.getByRole('button', { name: 'Click here to see the new word' }).click();
    await expect(page).toHaveURL(/\/word\/.+/);
}

test.describe.serial('French forms (slices 4 to 6: noun, adjective, verb, adverb, conjunction and preposition)', () => {
    let user: Account;

    test.beforeAll(async ({ request }) => {
        user = await registerAndVerify(request, 'Léa Martin', ['English', 'French']);
    });

    test.beforeEach(async ({ page }) => {
        await signIn(page, user);
    });

    test('a noun with its gender, singular and plural saves, survives a reload and shows in the words table', async ({ page }) => {
        await openNewWord(page, /Noun/);

        await page.getByRole('button', { name: 'English' }).click();
        await page.getByLabel('Singular', { exact: true }).first().fill('horse');
        await closeTypeAheadList(page);

        await page.getByRole('button', { name: 'Français' }).click();
        // Exact match: "le" would also match the "le/la" option.
        await page.getByRole('radio', { name: 'le', exact: true }).click();
        await page.getByLabel('Singular', { exact: true }).last().fill('cheval');
        await page.getByLabel('Plural', { exact: true }).last().fill('chevaux');

        await saveAndOpen(page);
        await page.reload();
        await expect(page.getByText('Detailed view: Noun')).toBeVisible();
        await expect(page.getByText('cheval', { exact: true })).toBeVisible();
        await expect(page.getByText('chevaux', { exact: true })).toBeVisible();

        // The French cell shows the word and its gender chip.
        await page.goto('/words');
        const row = page.getByRole('row', { name: /horse/ });
        await expect(row).toContainText('cheval');
        await expect(row).toContainText('le');
    });

    test('gender and regularity share one row, on a desktop and on a phone', async ({ page }) => {
        for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 800 }]) {
            await page.setViewportSize(viewport);
            await openNewWord(page, /Noun/);
            await page.getByRole('button', { name: 'Français' }).click();
            const gender = page.getByText('Gender', { exact: true }).last();
            const regularity = page.getByText('Regularity', { exact: true }).last();
            await expect(gender).toBeVisible();
            await expect(regularity).toBeVisible();
            const [g, r] = [await gender.boundingBox(), await regularity.boundingBox()];
            expect(Math.abs(g!.y - r!.y), `labels at ${viewport.width}px`).toBeLessThan(4);
            expect(r!.x).toBeGreaterThan(g!.x + g!.width - 1); // side by side, not stacked
        }
    });

    test('the noun cannot be saved before the gender is chosen', async ({ page }) => {
        await openNewWord(page, /Noun/);
        await page.getByRole('button', { name: 'English' }).click();
        await page.getByLabel('Singular', { exact: true }).first().fill('table');
        await closeTypeAheadList(page);
        await page.getByRole('button', { name: 'Français' }).click();
        await page.getByLabel('Singular', { exact: true }).last().fill('table');
        await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();

        await page.getByRole('radio', { name: 'la', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();
    });

    test('an adjective: agreement forms, the "plus" comparative, the vowel form and the position', async ({ page }) => {
        await openNewWord(page, /Adjective/);

        await page.getByRole('button', { name: 'English' }).click();
        await page.getByLabel('Positive', { exact: true }).fill('beautiful');
        await closeTypeAheadList(page);

        await page.getByRole('button', { name: 'Français' }).click();
        await page.getByLabel('Male singular', { exact: true }).fill('beau');
        await page.getByLabel('Female singular', { exact: true }).fill('belle');
        await page.getByLabel('Male plural', { exact: true }).fill('beaux');
        await page.getByLabel('Female plural', { exact: true }).fill('belles');

        // The "plus" box derives the comparative from the masculine singular.
        await page.getByRole('checkbox', { name: /Uses "plus"/ }).click();
        await expect(page.getByTestId('derived-comparative')).toHaveValue('plus beau');
        // The superlative is locked and follows the comparative: "le " + "plus beau".
        await expect(page.getByTestId('derived-superlative')).toHaveValue('le plus beau');
        await expect(page.getByTestId('derived-superlative')).toHaveJSProperty('readOnly', true);

        // The vowel form is hidden until its box is on.
        await expect(page.getByLabel('Form before a vowel', { exact: true })).toHaveCount(0);
        await page.getByRole('checkbox', { name: /Has a form before a vowel/ }).click();
        await page.getByLabel('Form before a vowel', { exact: true }).fill('bel');

        await page.getByRole('radio', { name: 'Before the noun', exact: true }).click();

        await saveAndOpen(page);
        await page.reload();
        await expect(page.getByText('Detailed view: Adjective')).toBeVisible();
        await expect(page.getByText('belle', { exact: true })).toBeVisible();
        await expect(page.getByText('bel', { exact: true })).toBeVisible();
        // The checkbox is stored; the view shows the comparative it stands for.
        await expect(page.getByTestId('derived-comparative')).toHaveText('plus beau');
        await expect(page.getByTestId('derived-superlative')).toHaveText('le plus beau');
    });

    test('the "plus" box sits above the comparative and the superlative, which share one row on a desktop and on a phone', async ({ page }) => {
        for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 800 }]) {
            await page.setViewportSize(viewport);
            await openNewWord(page, /Adjective/);
            await page.getByRole('button', { name: 'Français' }).click();
            const box = page.getByRole('checkbox', { name: /Uses "plus"/ });
            const comparative = page.getByLabel('Comparative (male singular)', { exact: true });
            const superlative = page.getByLabel('Superlative (male singular)', { exact: true });
            await expect(box).toBeVisible();
            const [b, c, s] = [await box.boundingBox(), await comparative.boundingBox(), await superlative.boundingBox()];
            expect(b!.y + b!.height, `box above the row at ${viewport.width}px`).toBeLessThanOrEqual(c!.y);
            expect(Math.abs(c!.y - s!.y), `same row at ${viewport.width}px`).toBeLessThan(4);
            expect(s!.x).toBeGreaterThan(c!.x + c!.width - 1); // side by side, not stacked
        }
    });

    test('the superlative is empty with a placeholder until there is a comparative; a typed comparative feeds it', async ({ page }) => {
        await openNewWord(page, /Adjective/);
        await page.getByRole('button', { name: 'Français' }).click();
        const superlative = page.getByTestId('derived-superlative');
        await expect(superlative).toHaveValue('');
        await expect(superlative).toHaveAttribute('placeholder', 'Depends on the comparative');

        // An irregular comparative is typed (the "plus" box stays off); the superlative follows it.
        await page.getByLabel('Male singular', { exact: true }).fill('bon');
        await page.getByLabel('Comparative (male singular)', { exact: true }).fill('meilleur');
        await expect(superlative).toHaveValue('le meilleur');
    });

    test('a verb with être: the infinitive is required; the passé composé shows the auxiliary before the participle', async ({ page }) => {
        await openNewWord(page, /Verb/);

        await page.getByRole('button', { name: 'English' }).click();
        await page.locator('input[name="simplePresent1s"]').fill('go');
        await closeTypeAheadList(page);

        await page.getByRole('button', { name: 'Français' }).click();
        // The infinitive is the only required French field.
        await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
        await page.getByLabel('Infinitive', { exact: true }).fill('aller');
        await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();

        // The verb group takes the place of the regularity radio (checked in verbs.test.ts: the English card has one).
        await page.getByRole('radio', { name: '3e groupe', exact: true }).click();
        await page.getByLabel('Past participle', { exact: true }).fill('allé');
        await page.getByLabel('Present participle', { exact: true }).fill('allant');

        // No auxiliary chosen yet: nothing stands before the participle boxes.
        await expect(page.getByText('suis', { exact: true })).toHaveCount(0);
        const auxiliary = page.getByRole('radiogroup', { name: 'Auxiliary verb' });
        await auxiliary.getByRole('radio', { name: 'avoir' }).click();
        await expect(page.getByText('ai', { exact: true })).toBeVisible();
        await auxiliary.getByRole('radio', { name: 'être' }).click();
        await expect(page.getByText('suis', { exact: true })).toBeVisible();
        await expect(page.getByText('sommes', { exact: true })).toBeVisible();
        await expect(page.getByText('ai', { exact: true })).toHaveCount(0);

        await page.locator('input[name="indicativePresent1s"]').fill('vais');
        await page.locator('input[name="indicativeImperfect1s"]').fill('allais');
        await page.locator('input[name="indicativePerfect1s"]').fill('allé');
        await page.locator('input[name="indicativePerfect1pl"]').fill('allés');
        await page.locator('input[name="indicativeSimpleFuture1s"]').fill('irai');

        await saveAndOpen(page);
        await page.reload();
        await expect(page.getByText('Detailed view: Verb')).toBeVisible();
        await expect(page.getByText('aller', { exact: true })).toBeVisible();
        // The view shows the auxiliary with the participle that was typed.
        await expect(page.getByText('sommes allés')).toBeVisible();
        await expect(page.getByText('irai', { exact: true })).toBeVisible();

        await page.goto('/words');
        const row = page.getByRole('row', { name: /go/ });
        await expect(row).toContainText('aller');
    });

    test('a reflexive verb shows the pronoun before the verb, and before the auxiliary in the passé composé', async ({ page }) => {
        await openNewWord(page, /Verb/);
        await page.getByRole('button', { name: 'Français' }).click();
        await page.getByLabel('Infinitive', { exact: true }).fill('se laver');
        await page.getByRole('radiogroup', { name: 'Auxiliary verb' }).getByRole('radio', { name: 'être' }).click();

        // Nothing until the verb is "always reflexive".
        await expect(page.getByText('me suis', { exact: true })).toHaveCount(0);
        await page.getByRole('radio', { name: 'Always reflexive', exact: true }).click();
        await expect(page.getByText('me suis', { exact: true })).toBeVisible();
        await expect(page.getByText('suis me')).toHaveCount(0);
        await expect(page.getByText('nous sommes', { exact: true })).toBeVisible();
        // Present, imparfait and futur simple: the pronoun alone, before the verb.
        await expect(page.getByText('me', { exact: true })).toHaveCount(3);
    });

    test('on a desktop and on a phone, the first two verb meta rows keep two cells', async ({ page }) => {
        for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 800 }]) {
            await page.setViewportSize(viewport);
            await openNewWord(page, /Verb/);
            await page.getByRole('button', { name: 'Français' }).click();
            for (const [first, second] of [
                ['Infinitive', 'Auxiliary verb'],
                ['Past participle', 'Present participle'],
            ]) {
                const a = page.getByText(first, { exact: true }).last();
                const b = page.getByText(second, { exact: true }).last();
                await expect(a).toBeVisible();
                await expect(b).toBeVisible();
                const [boxA, boxB] = [await a.boundingBox(), await b.boundingBox()];
                expect(Math.abs(boxA!.y - boxB!.y), `${first} and ${second} at ${viewport.width}px`).toBeLessThan(4);
                expect(boxB!.x, `${first} before ${second} at ${viewport.width}px`).toBeGreaterThan(boxA!.x + boxA!.width - 1);
            }
        }
    });

    test('an adverb with the "plus" box: the comparative and the superlative are derived, locked and saved', async ({ page }) => {
        await openNewWord(page, /Adverb/);

        await page.getByRole('button', { name: 'English' }).click();
        await page.getByRole('radio', { name: 'Non-gradable', exact: true }).first().click();
        await page.getByLabel('Adverb', { exact: true }).first().fill('quickly');
        await closeTypeAheadList(page);

        await page.getByRole('button', { name: 'Français' }).click();
        // The radio and the word are required: nothing saves without them.
        await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
        await page.getByRole('radio', { name: 'Gradable', exact: true }).last().click();
        await page.getByLabel('Adverb', { exact: true }).last().fill('vite');
        await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();

        await page.getByRole('checkbox', { name: /Uses "plus"/ }).click();
        await expect(page.getByTestId('derived-comparative')).toHaveValue('plus vite');
        await expect(page.getByTestId('derived-superlative')).toHaveValue('le plus vite');
        await expect(page.getByTestId('derived-superlative')).toHaveJSProperty('readOnly', true);

        await saveAndOpen(page);
        await page.reload();
        await expect(page.getByText('Detailed view: Adverb')).toBeVisible();
        await expect(page.getByTestId('derived-comparative')).toHaveText('plus vite');
        await expect(page.getByTestId('derived-superlative')).toHaveText('le plus vite');

        await page.goto('/words');
        await expect(page.getByRole('row', { name: /quickly/ })).toContainText('vite');
    });

    test('an irregular adverb is typed (bien → mieux): the superlative follows it; "Non-gradable" hides the degrees', async ({ page }) => {
        await openNewWord(page, /Adverb/);
        await page.getByRole('button', { name: 'Français' }).click();
        const superlative = page.getByTestId('derived-superlative');
        // Empty and locked, with a placeholder, while there is no comparative.
        await expect(superlative).toHaveValue('');
        await expect(superlative).toHaveAttribute('placeholder', 'Depends on the comparative');

        await page.getByLabel('Adverb', { exact: true }).last().fill('bien');
        await page.getByLabel('Comparative', { exact: true }).fill('mieux');
        await expect(superlative).toHaveValue('le mieux');

        // The degrees and the box go away for a non-gradable adverb, and the page keeps the word.
        await page.getByRole('radio', { name: 'Non-gradable', exact: true }).last().click();
        await expect(page.getByLabel('Comparative', { exact: true })).toHaveCount(0);
        await expect(page.getByTestId('derived-superlative')).toHaveCount(0);
        await expect(page.getByRole('checkbox', { name: /Uses "plus"/ })).toHaveCount(0);
        await expect(page.getByLabel('Adverb', { exact: true }).last()).toHaveValue('bien');
    });

    test('the adverb "plus" box sits above the comparative and the superlative, which share one row on a desktop and on a phone', async ({ page }) => {
        for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 800 }]) {
            await page.setViewportSize(viewport);
            await openNewWord(page, /Adverb/);
            await page.getByRole('button', { name: 'Français' }).click();
            const box = page.getByRole('checkbox', { name: /Uses "plus"/ });
            const comparative = page.getByLabel('Comparative', { exact: true });
            const superlative = page.getByLabel('Superlative', { exact: true });
            await expect(box).toBeVisible();
            const [b, c, s] = [await box.boundingBox(), await comparative.boundingBox(), await superlative.boundingBox()];
            expect(b!.y + b!.height, `box above the row at ${viewport.width}px`).toBeLessThanOrEqual(c!.y);
            expect(Math.abs(c!.y - s!.y), `same row at ${viewport.width}px`).toBeLessThan(4);
            expect(s!.x).toBeGreaterThan(c!.x + c!.width - 1); // side by side, not stacked
        }
    });

    test('a conjunction pair (soit … soit) and a subordinating conjunction with the conditional mood', async ({ page }) => {
        await openNewWord(page, /Conjunction/);

        await page.getByRole('button', { name: 'English' }).click();
        await page.getByLabel('Conjunction', { exact: true }).first().fill('either');
        await closeTypeAheadList(page);

        await page.getByRole('button', { name: 'Français' }).click();
        await page.getByLabel('Conjunction', { exact: true }).last().fill('soit');
        await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();

        // The second part shows, and is required, only while "Paired" is on.
        await expect(page.getByLabel('Second part', { exact: true })).toHaveCount(0);
        await page.getByRole('checkbox', { name: /Paired/ }).last().click();
        await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
        await page.getByLabel('Second part', { exact: true }).last().fill('soit');
        await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();

        // The mood shows for a subordinating conjunction only, with the conditional as a fourth value.
        const selects = await page.getByRole('combobox').count();
        await page.getByRole('radio', { name: 'Subordinating', exact: true }).last().click();
        await expect(page.getByRole('combobox')).toHaveCount(selects + 1);
        const mood = page.getByRole('combobox').nth(selects);
        await mood.click();
        await expect(page.getByRole('option')).toHaveText(['—', 'Indicative', 'Subjunctive', 'Conditional', 'Depends on meaning']);
        await page.getByRole('option', { name: 'Conditional' }).click();
        await expect(mood).toContainText('Conditional');
        await page.getByRole('radio', { name: 'Coordinating', exact: true }).last().click();
        await expect(page.getByRole('combobox')).toHaveCount(selects);

        await saveAndOpen(page);
        await page.reload();
        await expect(page.getByText('Detailed view: Conjunction')).toBeVisible();
        await expect(page.getByText('soit', { exact: true }).first()).toBeVisible();

        await page.goto('/words');
        await expect(page.getByRole('row', { name: /either/ })).toContainText('soit');
    });

    test('a preposition: the word, and the position ("durant" can follow the noun)', async ({ page }) => {
        await openNewWord(page, /Preposition/);

        await page.getByRole('button', { name: 'English' }).click();
        await page.getByLabel('Preposition', { exact: true }).first().fill('during');
        await closeTypeAheadList(page);

        await page.getByRole('button', { name: 'Français' }).click();
        // Only the word is required; au, aux, du and des are a general rule for "à" and "de": no field for them.
        await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
        await page.getByLabel('Preposition', { exact: true }).last().fill('durant');
        await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();
        await expect(page.getByLabel(/article/i)).toHaveCount(0);

        await page.getByRole('radio', { name: 'Before or after the noun', exact: true }).last().click();
        // A re-click clears an optional radio, as for the other languages.
        await page.getByRole('radio', { name: 'Before or after the noun', exact: true }).last().click();
        await expect(page.getByRole('radio', { name: 'Before or after the noun', exact: true }).last()).not.toBeChecked();
        await page.getByRole('radio', { name: 'After the noun', exact: true }).last().click();

        await saveAndOpen(page);
        await page.reload();
        await expect(page.getByText('Detailed view: Preposition')).toBeVisible();
        await expect(page.getByText('durant', { exact: true })).toBeVisible();
        await expect(page.getByText('After the noun', { exact: true })).toBeVisible();

        await page.goto('/words');
        await expect(page.getByRole('row', { name: /during/ })).toContainText('durant');
    });
});

// ---- Practice with French (slice 7) -------------------------------------------------------------------------
// The words are made through the API in four languages. A card shows its two languages and its prompt, so the
// test reads them from the screen and looks the answer up: it does not depend on the direction the server picks.

type NativeName = 'English' | 'Español' | 'Deutsch' | 'Français';
type Forms = Record<NativeName, string>;
const SIGNED_NAME: Record<string, NativeName> = { English: 'English', Spanish: 'Español', German: 'Deutsch', French: 'Français' };
const ALL_LANGUAGES = ['English', 'Spanish', 'German', 'French'];

const NOUNS: Array<{ forms: Forms; gender: string }> = [
    { forms: { English: 'horse', Español: 'caballo', Deutsch: 'Pferd', Français: 'cheval' }, gender: 'le' },
    { forms: { English: 'house', Español: 'casa', Deutsch: 'Haus', Français: 'maison' }, gender: 'la' },
];

/** The present and the past (1st person singular) of "to go". French "past" is the imparfait (review log M3). */
const GO_PRESENT: Forms = { English: 'go', Español: 'voy', Deutsch: 'gehe', Français: 'vais' };
const GO_PAST: Forms = { English: 'went', Español: 'fui', Deutsch: 'ging', Français: 'allais' };

async function createWord(request: APIRequestContext, token: string, partOfSpeech: string, translations: unknown[]) {
    const res = await request.post(`${API}/api/words`, { headers: authHeader(token), data: { partOfSpeech, translations } });
    expect(res.ok()).toBeTruthy();
}

/** The language names on the open card: the prompt's and the answer's. */
async function cardLanguages(page: Page): Promise<{ from: NativeName; to: NativeName }> {
    const article = page.locator('article');
    const name = async (index: number) => ((await article.locator('section').nth(index).locator('span').first().innerText()).split('·')[0] ?? '').trim() as NativeName;
    return { from: await name(0), to: await name(1) };
}

/** The prompt of a verb card has the pronoun in its own span: the value is the last text node. */
async function promptValue(page: Page): Promise<string> {
    return ((await page.getByTestId('prompt').evaluate((el) => el.lastChild?.textContent ?? '')) as string).trim();
}

/** Selects exactly these languages in the set-up (the chips are toggles; the set-up remembers the last choice). */
async function keepLanguages(page: Page, keep: NativeName[]): Promise<void> {
    const group = page.getByRole('group', { name: 'Languages' });
    for (const name of ['English', 'Español', 'Deutsch', 'Français'] as NativeName[]) {
        const chip = group.getByRole('button', { name, exact: true });
        if (((await chip.getAttribute('aria-pressed')) === 'true') !== keep.includes(name)) await chip.click();
    }
}

/** Types the answer, sends it and checks that the card says "Correct". */
async function typeCorrectAnswer(page: Page, answer: string): Promise<void> {
    await page.getByLabel('Your answer').fill(answer);
    await page.getByLabel('Your answer').press('Enter');
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Correct' }).first()).toBeVisible();
}

test.describe.serial('French practice (slice 7)', () => {
    let nounUser: Account;
    let verbUser: Account;

    test.beforeAll(async ({ request }) => {
        nounUser = await registerAndVerify(request, 'Noémie Petit', ALL_LANGUAGES);
        verbUser = await registerAndVerify(request, 'Hugo Bernard', ALL_LANGUAGES);
        const nounToken = await loginForToken(request, nounUser);
        for (const { forms, gender } of NOUNS) {
            await createWord(request, nounToken, 'Noun', [
                { language: 'English', cases: [{ caseName: 'singularEN', word: forms.English }] },
                { language: 'Spanish', cases: [{ caseName: 'singularES', word: forms.Español }] },
                { language: 'German', cases: [{ caseName: 'singularNominativDE', word: forms.Deutsch }] },
                { language: 'French', cases: [{ caseName: 'singularFR', word: forms.Français }, { caseName: 'genderFR', word: gender }] },
            ]);
        }
        const verbToken = await loginForToken(request, verbUser);
        await createWord(request, verbToken, 'Verb', [
            { language: 'English', cases: [{ caseName: 'simplePresent1sEN', word: GO_PRESENT.English }, { caseName: 'simplePast1sEN', word: GO_PAST.English }] },
            {
                language: 'Spanish',
                cases: [
                    { caseName: 'infinitiveNonFiniteSimpleES', word: 'ir' },
                    { caseName: 'indicativePresent1sES', word: GO_PRESENT.Español },
                    { caseName: 'indicativePerfectSimplePast1sES', word: GO_PAST.Español },
                ],
            },
            {
                language: 'German',
                cases: [
                    { caseName: 'infinitiveDE', word: 'gehen' },
                    { caseName: 'indicativePresent1sDE', word: GO_PRESENT.Deutsch },
                    { caseName: 'indicativeSimplePast1sDE', word: GO_PAST.Deutsch },
                ],
            },
            {
                language: 'French',
                cases: [
                    { caseName: 'infinitiveFR', word: 'aller' },
                    { caseName: 'auxVerbFR', word: 'être' },
                    { caseName: 'verbGroupFR', word: '3e groupe' },
                    { caseName: 'pastParticipleFR', word: 'allé' },
                    { caseName: 'indicativePresent1sFR', word: GO_PRESENT.Français },
                    { caseName: 'indicativeImperfect1sFR', word: GO_PAST.Français },
                ],
            },
        ]);
    });

    /** Answers `count` cross-language cards between the kept languages, from the screen. */
    async function answerCrossLanguage(page: Page, kept: NativeName[], words: Forms[], count: number, valueOf: (page: Page) => Promise<string>) {
        await page.goto('/practice');
        await configure(page, { amount: count, answer: 'Type the answer', languages: 'Different languages' });
        await keepLanguages(page, kept);
        await startSession(page);
        const seen = new Set<NativeName>();
        for (let i = 0; i < count; i++) {
            const { from, to } = await cardLanguages(page);
            expect(kept, `card ${i + 1} is between the kept languages`).toEqual(expect.arrayContaining([from, to]));
            seen.add(from);
            seen.add(to);
            const prompt = await valueOf(page);
            const entry = words.find((forms) => forms[from] === prompt);
            expect(entry, `"${prompt}" (${from}) is one of the seeded words`).toBeDefined();
            await typeCorrectAnswer(page, entry![to]);
            await goOn(page);
        }
        await expect(page.getByRole('heading', { name: 'Session results' })).toBeVisible();
        await expect(page.getByTestId('score')).toHaveText(`${count} of ${count}`);
        await page.getByRole('button', { name: 'Finish' }).click(); // leaves the results: the next session starts from the set-up
        return seen;
    }

    test('nouns: cards between French and Spanish, and between French and German, with no English card', async ({ page }) => {
        await signIn(page, nounUser);
        const seen = await answerCrossLanguage(page, ['Français', 'Español'], NOUNS.map((n) => n.forms), 2, currentPrompt);
        expect([...seen].sort()).toEqual(['Español', 'Français']);

        const second = await answerCrossLanguage(page, ['Français', 'Deutsch'], NOUNS.map((n) => n.forms), 2, currentPrompt);
        expect([...second].sort()).toEqual(['Deutsch', 'Français']);
    });

    test('nouns: the gender drill asks for the article (le, la, le/la) of a French noun', async ({ page }) => {
        await signIn(page, nounUser);
        await page.goto('/practice');
        await configure(page, { amount: 2, answer: 'Choose the answer', languages: 'Same language' });
        await keepLanguages(page, ['Français']);
        await startSession(page);
        for (let i = 0; i < 2; i++) {
            const prompt = await currentPrompt(page);
            const noun = NOUNS.find((n) => n.forms.Français === prompt);
            expect(noun, `"${prompt}" is a seeded French noun`).toBeDefined();
            await expect(page.getByText('What is the gender of this word?')).toBeVisible();
            const choices = page.getByRole('group', { name: 'Choose the answer' });
            await expect(choices.getByRole('button')).toHaveCount(3);
            await choices.getByRole('button', { name: noun!.gender, exact: true }).click();
            await expect(page.getByText('Saved', { exact: true })).toBeVisible();
            await expect(page.getByRole('status').filter({ hasText: 'Correct' }).first()).toBeVisible();
            await goOn(page);
        }
        await expect(page.getByTestId('score')).toHaveText('2 of 2');
    });

    test('a verb: the present and the past (the imparfait) between French and German, and between French and Spanish', async ({ page }) => {
        const verbForms = [GO_PRESENT, GO_PAST];
        await signIn(page, verbUser);
        const seen = await answerCrossLanguage(page, ['Français', 'Deutsch'], verbForms, 2, promptValue);
        expect([...seen].sort()).toEqual(['Deutsch', 'Français']);
        const second = await answerCrossLanguage(page, ['Français', 'Español'], verbForms, 2, promptValue);
        expect([...second].sort()).toEqual(['Español', 'Français']);
    });

    test('a verb: the past participle is typed; the auxiliary and the group are chosen', async ({ page }) => {
        await signIn(page, verbUser);
        await page.goto('/practice');

        await configure(page, { amount: 1, answer: 'Type the answer', languages: 'Same language' });
        await keepLanguages(page, ['Français']);
        await startSession(page);
        expect(await currentPrompt(page)).toBe('aller');
        await expect(page.getByText('What is the past participle of this verb?')).toBeVisible();
        await expect(page.getByLabel('Your answer')).toHaveAttribute('placeholder', 'Type the past participle…');
        await typeCorrectAnswer(page, 'allé');
        await goOn(page);
        await expect(page.getByTestId('score')).toHaveText('1 of 1');
        await page.getByRole('button', { name: 'Finish' }).click();

        await page.goto('/practice');
        await configure(page, { amount: 1, answer: 'Choose the answer', languages: 'Same language' });
        await keepLanguages(page, ['Français']);
        await startSession(page);
        // One of the two French multiple-choice drills: the auxiliary or the group.
        const choices = page.getByRole('group', { name: 'Choose the answer' });
        const asksAuxiliary = await page.getByText('Which auxiliary verb does this verb use?').isVisible();
        if (asksAuxiliary) {
            await expect(choices.getByRole('button')).toHaveCount(2);
            await choices.getByRole('button', { name: 'être', exact: true }).click();
        } else {
            await expect(page.getByText('Which group does this verb belong to?')).toBeVisible();
            await expect(choices.getByRole('button')).toHaveCount(3);
            await choices.getByRole('button', { name: '3e groupe', exact: true }).click();
        }
        await expect(page.getByText('Saved', { exact: true })).toBeVisible();
        await expect(page.getByRole('status').filter({ hasText: 'Correct' }).first()).toBeVisible();
    });
});
