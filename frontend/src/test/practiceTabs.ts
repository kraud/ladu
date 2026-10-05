/**
 * Practice's set-up screen has two tabs (Ongoing sessions is the default) and a "New configuration"
 * button that opens the settings view. A test that works with the settings, or the saved
 * configurations, opens that view or tab first.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/** Opens the New configuration view; does nothing when it is open already (words from Review open it). */
export async function openNewConfigurationTab() {
    const newButton = () => screen.queryByRole('button', { name: 'New configuration' });
    await waitFor(() => expect(newButton() ?? screen.queryByRole('button', { name: 'Back to Practice' })).not.toBeNull());
    const button = newButton();
    if (button) await userEvent.click(button);
}

export async function leaveNewConfiguration() {
    await userEvent.click(await screen.findByRole('button', { name: 'Back to Practice' }));
}

/** The tabs are hidden in the New configuration view: go back to them first when it is open. */
async function showTabs() {
    const back = screen.queryByRole('button', { name: 'Back to Practice' });
    if (back) await userEvent.click(back);
}

export async function openConfigurationsTab() {
    await showTabs();
    await userEvent.click(await screen.findByRole('tab', { name: 'Saved configurations' }));
}

export async function openSessionsTab() {
    await showTabs();
    await userEvent.click(await screen.findByRole('tab', { name: 'Ongoing sessions' }));
}

/** A selected saved configuration asks "start now or change first": take the second way. */
export async function chooseChangeSettingsFirst() {
    await userEvent.click(await screen.findByRole('button', { name: 'Change settings first' }));
}
