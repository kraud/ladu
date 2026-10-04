/**
 * Practice's set-up screen has three tabs (Ongoing sessions is the default). A test that
 * works with the settings, or the saved configurations, opens that tab first.
 */
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

export async function openNewConfigurationTab() {
    await userEvent.click(await screen.findByRole('tab', { name: 'New configuration' }));
}

export async function openConfigurationsTab() {
    await userEvent.click(await screen.findByRole('tab', { name: 'Saved configurations' }));
}

export async function openSessionsTab() {
    await userEvent.click(await screen.findByRole('tab', { name: 'Ongoing sessions' }));
}

/** A selected saved configuration asks "start now or change first": take the second way. */
export async function chooseChangeSettingsFirst() {
    await userEvent.click(await screen.findByRole('button', { name: 'Change settings first' }));
}
