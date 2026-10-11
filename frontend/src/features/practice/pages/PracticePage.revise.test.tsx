import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '@/test/render';
import { server } from '@/test/msw/server';
import { makeWordHandlers, type SeedWord } from '@/test/msw/wordHandlers';
import { makeConfig, makeExercise, makePracticeHandlers } from '@/test/msw/practiceHandlers';
import { chooseChangeSettingsFirst, leaveNewConfiguration } from '@/test/practiceTabs';
import { futureToken } from '@/test/tokens';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { Lang, PartOfSpeech } from '@/ts/enums';
import { usePracticeSessionStore } from '../sessionStore';

/**
 * Changing a saved configuration (picked in the "start now or change first" dialog): the page shows its name,
 * "Save configuration" waits for a change, and the save dialog has the saved name filled in with Cancel,
 * "Save as copy" and "Update".
 */

const SESSION = {
    id: 'u1', name: 'Kai Rebane', email: 'kai@example.com', username: 'kai',
    languages: ['English', 'Spanish'], uiLanguage: 'English', nativeLanguage: null, verified: true, token: futureToken(),
};

const noun: SeedWord = {
    id: 'w1', user: 'u1', partOfSpeech: PartOfSpeech.noun,
    translations: [{ language: Lang.EN, cases: [{ caseName: 'singularEN', word: 'house' }] }],
};

function setUp() {
    server.use(...makeWordHandlers({ callerId: 'u1', seed: [noun] }).handlers);
    const fake = makePracticeHandlers({
        exercises: [makeExercise()],
        configs: [makeConfig({ name: 'Morning drill', description: 'Before work' })],
    });
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

async function openToChange(user: ReturnType<typeof userEvent.setup>) {
    await renderApp({ initialEntry: '/practice', session: SESSION });
    await user.click(await screen.findByRole('button', { name: 'Use configuration Morning drill' }));
    await chooseChangeSettingsFirst();
    await screen.findByRole('heading', { name: 'Morning drill' });
}

const saveButton = () => screen.getByRole('button', { name: 'Save configuration' });
/** Changes one setting: the number of exercises (12 in the saved configuration). */
async function changeAmount(user: ReturnType<typeof userEvent.setup>, value: string) {
    const field = screen.getByLabelText('Number of exercises');
    await user.clear(field);
    await user.type(field, value);
}

describe('PracticePage — changing a saved configuration', () => {
    it('shows the saved name as the title, and "Save configuration" is off until something changes', async () => {
        setUp();
        const user = userEvent.setup();
        await openToChange(user);

        expect(screen.queryByRole('heading', { name: 'New configuration' })).not.toBeInTheDocument();
        expect(saveButton()).toBeDisabled();

        await changeAmount(user, '7');
        expect(saveButton()).toBeEnabled();

        // Back to the saved value: nothing differs again.
        await changeAmount(user, '12');
        expect(saveButton()).toBeDisabled();
    });

    it('the dialog is filled in with the saved name and description, with Cancel, "Save as copy" and "Update"', async () => {
        setUp();
        const user = userEvent.setup();
        await openToChange(user);
        await changeAmount(user, '7');
        await user.click(saveButton());

        const dialog = await screen.findByRole('dialog');
        expect(within(dialog).getByRole('heading', { name: 'Save changes' })).toBeInTheDocument();
        expect(within(dialog).getByLabelText(/Name/)).toHaveValue('Morning drill');
        expect(within(dialog).getByLabelText(/Description/)).toHaveValue('Before work');
        const buttons = within(dialog).getAllByRole('button').map((button) => button.textContent);
        expect(buttons).toEqual(expect.arrayContaining(['Cancel', 'Save as copy', 'Update']));

        await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('"Update" replaces the saved configuration with the new settings; the title keeps its name and Save waits again', async () => {
        const fake = setUp();
        const user = userEvent.setup();
        await openToChange(user);
        await changeAmount(user, '7');
        await user.click(saveButton());

        const dialog = await screen.findByRole('dialog');
        const name = within(dialog).getByLabelText(/Name/);
        await user.clear(name);
        await user.type(name, 'Evening drill');
        await user.click(within(dialog).getByRole('button', { name: 'Update' }));

        await waitFor(() => expect(fake.state.configBodies).toHaveLength(1));
        const { method, id, body } = fake.state.configBodies[0] as { method: string; id: string; body: { name: string; params: { amount: number } } };
        expect([method, id, body.name, body.params.amount]).toEqual(['PUT', 'cfg-seed', 'Evening drill', 7]);
        expect(await screen.findByRole('heading', { name: 'Evening drill' })).toBeInTheDocument();
        await waitFor(() => expect(saveButton()).toBeDisabled());
    });

    it('"Save as copy" makes a new configuration and leaves the original; a name that is taken stays an error', async () => {
        const fake = setUp();
        const user = userEvent.setup();
        await openToChange(user);
        await changeAmount(user, '7');
        await user.click(saveButton());

        // The same name: the copy is refused, the dialog stays open.
        let dialog = await screen.findByRole('dialog');
        await user.click(within(dialog).getByRole('button', { name: 'Save as copy' }));
        expect(await within(dialog).findByText('You already have a configuration with this name.')).toBeInTheDocument();

        const name = within(dialog).getByLabelText(/Name/);
        await user.clear(name);
        await user.type(name, 'Morning drill 2');
        await user.click(within(dialog).getByRole('button', { name: 'Save as copy' }));

        await waitFor(() => expect(fake.state.configs.map((config) => config.name).sort()).toEqual(['Morning drill', 'Morning drill 2']));
        const original = fake.state.configs.find((config) => config.name === 'Morning drill')!;
        expect(original.params.amount).toBe(12); // untouched
        expect(await screen.findByRole('heading', { name: 'Morning drill 2' })).toBeInTheDocument();
        dialog = screen.queryByRole('dialog') as HTMLElement;
        expect(dialog).toBeNull();
    });

    it('leaving the view ends the change: a new configuration has the plain title and a Save button that works', async () => {
        setUp();
        const user = userEvent.setup();
        await openToChange(user);
        await leaveNewConfiguration();
        await user.click(await screen.findByRole('button', { name: 'New configuration' }));

        expect(await screen.findByRole('heading', { name: 'New configuration' })).toBeInTheDocument();
        expect(saveButton()).toBeEnabled();
    });
});
