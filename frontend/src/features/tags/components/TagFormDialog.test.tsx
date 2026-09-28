import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/msw/server';
import { makeTagHandlers } from '@/test/msw/tagHandlers';
import { makeWordHandlers, type SeedWord } from '@/test/msw/wordHandlers';
import { futureToken } from '@/test/tokens';
import { PartOfSpeech, Lang } from '@/ts/enums';
import { TagFormDialog } from './TagFormDialog';
import type { TagSummary } from '../types';

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

function verbSeed(label: string, id: string): SeedWord {
    return {
        id,
        user: SESSION.id,
        partOfSpeech: PartOfSpeech.verb,
        translations: [{ language: Lang.EN, cases: [{ caseName: 'simplePresent1sEN', word: label }] }],
    };
}

function makeTag(overrides: Partial<TagSummary> = {}): TagSummary {
    return {
        id: 'tag-1',
        label: 'Kitchen',
        description: 'Words about the kitchen',
        visibility: 'Public',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        author: { id: SESSION.id, username: SESSION.username },
        wordCount: 0,
        followerCount: 0,
        isOwner: true,
        isFollowing: false,
        isAvailable: true,
        sourceTag: null,
        ...overrides,
    };
}

function useHandlers({ seedTags = [], seedWords = [] }: { seedTags?: any[]; seedWords?: SeedWord[] } = {}) {
    const tagFake = makeTagHandlers({ callerId: SESSION.id, seedTags });
    const wordFake = makeWordHandlers({ callerId: SESSION.id, seed: seedWords });
    server.use(...tagFake.handlers, ...wordFake.handlers);
    return { tagFake, wordFake };
}

describe('TagFormDialog — create', () => {
    it('shows an inline error and does not submit when the label is blank', async () => {
        useHandlers();
        const user = userEvent.setup();
        const onSaved = vi.fn();
        renderWithProviders(
            <TagFormDialog open onOpenChange={vi.fn()} mode="create" onSaved={onSaved} />,
            { session: SESSION },
        );

        await user.click(screen.getByRole('button', { name: 'Create tag' }));
        expect(screen.getByText('Label is required.')).toBeInTheDocument();
        expect(onSaved).not.toHaveBeenCalled();
    });

    it('creates a Public tag by default and calls onSaved', async () => {
        const { tagFake } = useHandlers();
        const user = userEvent.setup();
        const onSaved = vi.fn();
        const onOpenChange = vi.fn();
        renderWithProviders(
            <TagFormDialog open onOpenChange={onOpenChange} mode="create" onSaved={onSaved} />,
            { session: SESSION },
        );

        await user.type(screen.getByLabelText(/Label/), 'Kitchen');
        await user.click(screen.getByRole('button', { name: 'Create tag' }));

        await waitFor(() => expect(onSaved).toHaveBeenCalled());
        expect(onOpenChange).toHaveBeenCalledWith(false);
        const created = [...tagFake.store.values()][0];
        expect(created.label).toBe('Kitchen');
        expect(created.visibility).toBe('Public');
    });

    it('switching to Private sends Private visibility', async () => {
        const { tagFake } = useHandlers();
        const user = userEvent.setup();
        renderWithProviders(<TagFormDialog open onOpenChange={vi.fn()} mode="create" />, { session: SESSION });

        await user.type(screen.getByLabelText(/Label/), 'Secret');
        await user.click(screen.getByRole('radio', { name: /Private/ }));
        await user.click(screen.getByRole('button', { name: 'Create tag' }));

        await waitFor(() => expect(tagFake.store.size).toBe(1));
        expect([...tagFake.store.values()][0].visibility).toBe('Private');
    });

    it('shows an inline conflict error for a label already in use, without closing', async () => {
        useHandlers({ seedTags: [{ authorId: SESSION.id, label: 'Kitchen', visibility: 'Public' }] });
        const user = userEvent.setup();
        const onOpenChange = vi.fn();
        renderWithProviders(<TagFormDialog open onOpenChange={onOpenChange} mode="create" />, { session: SESSION });

        await user.type(screen.getByLabelText(/Label/), 'Kitchen');
        await user.click(screen.getByRole('button', { name: 'Create tag' }));

        expect(await screen.findByText('You already have a tag with this label.')).toBeInTheDocument();
        expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });

    it('picking a word in the embedded WordPicker includes it in the create request', async () => {
        const { tagFake } = useHandlers({ seedWords: [verbSeed('run', 'w1')] });
        const user = userEvent.setup();
        renderWithProviders(<TagFormDialog open onOpenChange={vi.fn()} mode="create" />, { session: SESSION });

        await user.type(screen.getByLabelText(/Label/), 'Verbs');
        const row = (await screen.findByText('run')).closest('tr') as HTMLElement;
        await user.click(row);
        expect(screen.getByText('1 selected')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Create tag' }));
        await waitFor(() => expect(tagFake.store.size).toBe(1));
        expect([...tagFake.store.values()][0].wordIds.has('w1')).toBe(true);
    });
});

describe('TagFormDialog — edit', () => {
    it('seeds the fields from the given tag and has no word picker', async () => {
        useHandlers();
        renderWithProviders(
            <TagFormDialog open onOpenChange={vi.fn()} mode="edit" tag={makeTag()} />,
            { session: SESSION },
        );

        expect(screen.getByDisplayValue('Kitchen')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Words about the kitchen')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
        expect(screen.queryByText(/Add words now/)).not.toBeInTheDocument();
    });

    it('submits the edited label via updateTag', async () => {
        const { tagFake } = useHandlers({
            seedTags: [{ id: 'tag-1', authorId: SESSION.id, label: 'Kitchen', visibility: 'Public' }],
        });
        const user = userEvent.setup();
        const onSaved = vi.fn();
        renderWithProviders(
            <TagFormDialog open onOpenChange={vi.fn()} mode="edit" tag={makeTag()} onSaved={onSaved} />,
            { session: SESSION },
        );

        const labelInput = screen.getByLabelText(/Label/);
        await user.clear(labelInput);
        await user.type(labelInput, 'Cooking');
        await user.click(screen.getByRole('button', { name: 'Save changes' }));

        await waitFor(() => expect(onSaved).toHaveBeenCalled());
        expect(tagFake.store.get('tag-1')?.label).toBe('Cooking');
    });

    it('resets to a blank create form when reused for a fresh create right after an edit', () => {
        useHandlers();
        const { rerender } = renderWithProviders(
            <TagFormDialog open onOpenChange={vi.fn()} mode="edit" tag={makeTag()} />,
            { session: SESSION },
        );
        expect(screen.getByLabelText(/Label/)).toHaveValue('Kitchen');

        rerender(<TagFormDialog open mode="create" onOpenChange={vi.fn()} />);
        expect(screen.getByLabelText(/Label/)).toHaveValue('');
    });
});
