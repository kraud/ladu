import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '@/test/render';
import { server } from '@/test/msw/server';
import { makeWordHandlers, type SeedWord } from '@/test/msw/wordHandlers';
import { makeTagHandlers } from '@/test/msw/tagHandlers';
import { makeExercise, makePracticeHandlers } from '@/test/msw/practiceHandlers';
import { openNewConfigurationTab } from '@/test/practiceTabs';
import { mockMobileViewport } from '@/test/viewport';
import { futureToken } from '@/test/tokens';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { Lang, PartOfSpeech } from '@/ts/enums';
import { usePracticeSessionStore } from '../sessionStore';

const SESSION = {
    id: 'u1',
    name: 'Kai Rebane',
    email: 'kai@example.com',
    username: 'kai',
    languages: ['English', 'Spanish'],
    uiLanguage: 'English',
    nativeLanguage: null,
    verified: true,
    token: futureToken(),
};

const kitchen = { id: 'tag-1', label: 'Kitchen', visibility: 'Private' as const, authorId: 'u1' };
const travel = { id: 'tag-2', label: 'Travel', visibility: 'Private' as const, authorId: 'u1' };
const nouns = { id: 'tag-3', label: 'Only nouns', visibility: 'Private' as const, authorId: 'u1' };

const noun = (id: string, label: string, tags: (typeof kitchen)[] = []): SeedWord => ({
    id,
    user: 'u1',
    partOfSpeech: PartOfSpeech.noun,
    translations: [{ language: Lang.EN, cases: [{ caseName: 'singularEN', word: label }] }],
    tags,
});
const verb = (id: string, label: string, tags: (typeof kitchen)[] = []): SeedWord => ({
    id,
    user: 'u1',
    partOfSpeech: PartOfSpeech.verb,
    translations: [{ language: Lang.EN, cases: [{ caseName: 'simplePresent1sEN', word: label }] }],
    tags,
});

/**
 * house + run in Kitchen; run + cat in Travel (run is in both); house + cat in "Only nouns";
 * dog in none; the tag "Empty" has no words.
 */
function setUp() {
    server.use(
        ...makeTagHandlers({
            callerId: 'u1',
            seedTags: [
                { id: 'tag-1', authorId: 'u1', label: 'Kitchen', visibility: 'Private', wordIds: ['w1', 'w2'] },
                { id: 'tag-2', authorId: 'u1', label: 'Travel', visibility: 'Private', wordIds: ['w2', 'w3'] },
                { id: 'tag-3', authorId: 'u1', label: 'Only nouns', visibility: 'Private', wordIds: ['w1', 'w3'] },
                { id: 'tag-4', authorId: 'u1', label: 'Empty', visibility: 'Private', wordIds: [] },
            ],
        }).handlers,
    );
    server.use(
        ...makeWordHandlers({
            callerId: 'u1',
            seed: [
                noun('w1', 'house', [kitchen, nouns]),
                verb('w2', 'run', [kitchen, travel]),
                noun('w3', 'cat', [travel, nouns]),
                noun('w4', 'dog'),
            ],
        }).handlers,
    );
    const fake = makePracticeHandlers({ exercises: [makeExercise()] });
    server.use(...fake.handlers);
    return fake;
}

beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
});

afterEach(() => {
    useAuthStore.getState().clearSession();
    usePracticeSessionStore.getState().clear();
    useUiStore.getState().setPracticePreselection(null);
    useUiStore.getState().setSidebarCollapsed('practice', false);
});

async function renderSetUp() {
    const result = await renderApp({ initialEntry: '/practice', session: SESSION });
    await openNewConfigurationTab();
    return result;
}

/** Types in the tag search and picks the tag. */
async function pickTag(user: ReturnType<typeof userEvent.setup>, label: string) {
    const panel = screen.getByRole('complementary');
    await user.click(within(panel).getByPlaceholderText('Filter by tag…'));
    await user.click(await screen.findByRole('option', { name: new RegExp(label) }));
    // Close the list of matches: while it is open the rest of the page is hidden from the accessibility tree.
    await user.keyboard('{Escape}');
}

describe('PracticePage — choosing words by tag', () => {
    it('starts as a collapsed rail; opened, it says all words are used and offers the tag search', async () => {
        const user = userEvent.setup();
        setUp();
        useUiStore.getState().setSidebarCollapsed('practice', true);
        await renderSetUp();

        const rail = await screen.findByRole('complementary');
        expect(within(rail).queryByPlaceholderText('Filter by tag…')).not.toBeInTheDocument();

        await user.click(within(rail).getByRole('button', { name: 'Expand sidebar' }));
        const panel = screen.getByRole('complementary');
        expect(within(panel).getByText('No words selected. All your words are used.')).toBeInTheDocument();
        expect(within(panel).getByPlaceholderText('Filter by tag…')).toBeInTheDocument();
    });

    it('a picked tag becomes a folded container with its name and word count, not a chip in the search box', async () => {
        const user = userEvent.setup();
        setUp();
        await renderSetUp();
        await pickTag(user, 'Kitchen');

        const container = await screen.findByRole('region', { name: 'Kitchen' });
        const header = within(container).getByRole('button', { name: /^Kitchen/ });
        expect(header).toHaveAttribute('aria-expanded', 'false');
        await waitFor(() => expect(within(container).getByText('(2)')).toBeInTheDocument());
        expect(within(container).queryByText('house')).not.toBeInTheDocument();
        // No chip inside the search box.
        expect(within(screen.getByRole('complementary')).queryByRole('button', { name: 'Remove Kitchen' })).not.toBeInTheDocument();
        // With a tag chosen, the note is gone.
        expect(screen.queryByText('No words selected. All your words are used.')).not.toBeInTheDocument();
    });

    it('opens and folds a container to show its words', async () => {
        const user = userEvent.setup();
        setUp();
        await renderSetUp();
        await pickTag(user, 'Kitchen');

        const container = await screen.findByRole('region', { name: 'Kitchen' });
        await user.click(within(container).getByRole('button', { name: /^Kitchen/ }));
        expect(await within(container).findByText('house')).toBeInTheDocument();
        expect(within(container).getByText('run')).toBeInTheDocument();

        await user.click(within(container).getByRole('button', { name: /^Kitchen/ }));
        expect(within(container).queryByText('house')).not.toBeInTheDocument();
    });

    it('several tags give one combined list, each word once', async () => {
        const user = userEvent.setup();
        setUp();
        await renderSetUp();
        await pickTag(user, 'Kitchen');
        await pickTag(user, 'Travel');

        // house, run (in both tags), cat: three words.
        expect(await screen.findByText('Practice with 3 selected words')).toBeInTheDocument();
        expect(screen.getAllByRole('region').filter((r) => ['Kitchen', 'Travel'].includes(r.getAttribute('aria-label') ?? ''))).toHaveLength(2);
    });

    it('removing a tag removes its container and its words', async () => {
        const user = userEvent.setup();
        setUp();
        await renderSetUp();
        await pickTag(user, 'Kitchen');
        await pickTag(user, 'Travel');
        await screen.findByText('Practice with 3 selected words');

        await user.click(screen.getByRole('button', { name: 'Remove tag Kitchen' }));
        expect(screen.queryByRole('region', { name: 'Kitchen' })).not.toBeInTheDocument();
        expect(await screen.findByText('Practice with 2 selected words')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Remove tag Travel' }));
        expect(await screen.findByText('No words selected. All your words are used.')).toBeInTheDocument();
    });

    it('picking the same tag again adds nothing', async () => {
        const user = userEvent.setup();
        setUp();
        await renderSetUp();
        await pickTag(user, 'Kitchen');
        await screen.findByRole('region', { name: 'Kitchen' });
        await pickTag(user, 'Kitchen');
        expect(screen.getAllByRole('region', { name: 'Kitchen' })).toHaveLength(1);
    });

    it('the tags\' words limit the word types, and Start sends exactly their ids', async () => {
        const user = userEvent.setup();
        const fake = setUp();
        await renderSetUp();
        await pickTag(user, 'Travel'); // run (verb) + cat (noun)
        await screen.findByText('Practice with 2 selected words');

        // Both types are present, so both stay pickable; no word of "dog" (no tag) is sent.
        await user.click(screen.getByRole('button', { name: 'Start session' }));
        await screen.findByText('Exercise 1 of 1');
        const ids = fake.state.generateBodies[0]!.wordIds as string[];
        expect([...ids].sort()).toEqual(['w2', 'w3']);
    });

    it('a word type that none of the tags\' words has cannot stay selected, and comes back when the tag goes', async () => {
        const user = userEvent.setup();
        setUp();
        await renderSetUp();
        expect(screen.getByRole('button', { name: 'Verb', pressed: true })).toBeInTheDocument();

        await pickTag(user, 'Only nouns');
        await screen.findByText('Practice with 2 selected words');
        const verbChip = screen.getByRole('button', { name: 'Verb' });
        expect(verbChip).toBeDisabled();
        expect(verbChip).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByRole('button', { name: 'Noun', pressed: true })).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Remove tag Only nouns' }));
        expect(await screen.findByRole('button', { name: 'Verb', pressed: true })).toBeEnabled();
    });

    it('Start and Save are blocked, with the reason, when the chosen tags have no words', async () => {
        const user = userEvent.setup();
        setUp();
        await renderSetUp();
        await pickTag(user, 'Empty');

        expect(await screen.findByText('The chosen tags have no words.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Start session' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Save configuration' })).toBeDisabled();

        await user.click(screen.getByRole('button', { name: 'Remove tag Empty' }));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Start session' })).toBeEnabled());
    });

    it('the word marks follow the settings: a type the user unselects shows the tag\'s words as not used', async () => {
        const user = userEvent.setup();
        setUp();
        await renderSetUp();
        await pickTag(user, 'Kitchen'); // house (noun) + run (verb)
        await user.click(await screen.findByRole('button', { name: /^Kitchen/ }));
        const container = screen.getByRole('region', { name: 'Kitchen' });
        await within(container).findByText('house');

        await user.click(screen.getByRole('button', { name: 'Verb', pressed: true }));
        expect(within(container).getByText('run').closest('li')).toHaveAttribute('data-used', 'false');
        expect(within(container).getByText('house').closest('li')).toHaveAttribute('data-used', 'true');
    });

    it('takes every page of a big tag, not only the first 100 words', async () => {
        const user = userEvent.setup();
        setUp();
        const big = { id: 'tag-9', label: 'Big', visibility: 'Private' as const, authorId: 'u1' };
        const many = Array.from({ length: 105 }, (_, i) => noun(`b${i}`, `word${i}`, [big]));
        server.use(
            ...makeTagHandlers({
                callerId: 'u1',
                seedTags: [{ id: 'tag-9', authorId: 'u1', label: 'Big', visibility: 'Private', wordIds: many.map((w) => w.id!) }],
            }).handlers,
            ...makeWordHandlers({ callerId: 'u1', seed: many }).handlers,
        );
        await renderSetUp();
        await pickTag(user, 'Big');

        expect(await screen.findByText('Practice with 105 selected words')).toBeInTheDocument();
    });

    it('with words from Review there is no tag search', async () => {
        setUp();
        useUiStore.getState().setPracticePreselection([{ id: 'w4', partOfSpeech: PartOfSpeech.noun, label: 'dog', languages: ['EN'] }]);
        await renderApp({ initialEntry: '/practice', session: SESSION });

        const panel = await screen.findByRole('complementary');
        expect(within(panel).getByText('dog')).toBeInTheDocument();
        expect(within(panel).queryByPlaceholderText('Filter by tag…')).not.toBeInTheDocument();
    });

    it('on a phone the "Selected words" button opens the tag picker, also with nothing chosen', async () => {
        mockMobileViewport();
        const user = userEvent.setup();
        setUp();
        await renderSetUp();

        await user.click(await screen.findByRole('button', { name: 'Selected words (0)' }));
        const menu = await screen.findByRole('dialog');
        expect(within(menu).getByPlaceholderText('Filter by tag…')).toBeInTheDocument();
    });
});
