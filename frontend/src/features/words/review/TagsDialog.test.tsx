import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/msw/server';
import { makeTagHandlers } from '@/test/msw/tagHandlers';
import { futureToken } from '@/test/tokens';
import type { WordTagRef } from '../types';
import { TagsDialog } from './TagsDialog';

const SESSION = {
    id: 'u1',
    name: 'Kai Rebane',
    email: 'kai@example.com',
    username: 'kai',
    languages: ['English'],
    uiLanguage: 'English',
    nativeLanguage: null,
    verified: true,
    token: futureToken(),
};

const kitchen: WordTagRef = { id: 'tag-1', label: 'Kitchen', visibility: 'Private', authorId: 'u1' };
const garage: WordTagRef = { id: 'tag-2', label: 'Garage', visibility: 'Public', authorId: 'u1' };

function setUp() {
    const fake = makeTagHandlers({
        callerId: 'u1',
        seedTags: [
            { id: 'tag-1', authorId: 'u1', label: 'Kitchen', visibility: 'Private' },
            { id: 'tag-2', authorId: 'u1', label: 'Garage', visibility: 'Public' },
            { id: 'tag-3', authorId: 'u1', label: 'Office', visibility: 'Private' },
        ],
    });
    server.use(...fake.handlers);
    return fake;
}

describe('TagsDialog', () => {
    it('lists the tags and offers no Edit button for a word that is not the user\'s own', () => {
        setUp();
        renderWithProviders(<TagsDialog wordId="w1" tags={[kitchen, garage]} canEdit={false} onClose={vi.fn()} />, {
            session: SESSION,
        });
        expect(screen.getByText('Kitchen')).toBeInTheDocument();
        expect(screen.getByText('Garage')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: 'Close' }).length).toBeGreaterThan(0);
    });

    it('says so when the word has no tags', () => {
        setUp();
        renderWithProviders(<TagsDialog wordId="w1" tags={[]} canEdit onClose={vi.fn()} />, { session: SESSION });
        expect(screen.getByText('This word has no tags.')).toBeInTheDocument();
    });

    it('Edit shows the × and the add box; Cancel goes back to display mode', async () => {
        setUp();
        const user = userEvent.setup();
        renderWithProviders(<TagsDialog wordId="w1" tags={[kitchen]} canEdit onClose={vi.fn()} />, { session: SESSION });

        await user.click(screen.getByRole('button', { name: 'Edit' }));
        expect(screen.getByRole('button', { name: 'Remove tag Kitchen' })).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Search tags to add…')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

        await user.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(screen.queryByRole('button', { name: 'Remove tag Kitchen' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    });

    it('Save links the added tag, then closes', async () => {
        const fake = setUp();
        const onClose = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(<TagsDialog wordId="w1" tags={[kitchen]} canEdit onClose={onClose} />, { session: SESSION });

        await user.click(screen.getByRole('button', { name: 'Edit' }));
        await user.click(screen.getByPlaceholderText('Search tags to add…'));
        await user.click(await screen.findByRole('option', { name: /Office/ }));
        await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(onClose).toHaveBeenCalled());
        expect(fake.requests).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ path: '/tags/links', body: { tagIds: ['tag-3'], wordIds: ['w1'] } }),
            ]),
        );
    });
});
