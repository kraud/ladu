import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/msw/server';
import { makeTagHandlers, type SeedTag } from '@/test/msw/tagHandlers';
import { TagPickerDialog } from './TagPickerDialog';

const ME = 'user-me';

function setUp(seedTags: SeedTag[] = []) {
    const fake = makeTagHandlers({ callerId: ME, seedTags });
    server.use(...fake.handlers);
    return fake;
}

describe('TagPickerDialog — add mode', () => {
    it('titles itself with the word count, picks a tag, and Apply links it', async () => {
        const fake = setUp([{ id: 'tag-1', authorId: ME, label: 'Kitchen', visibility: 'Private' }]);
        const user = userEvent.setup();
        const onApplied = vi.fn();
        renderWithProviders(
            <TagPickerDialog open onOpenChange={vi.fn()} mode="add" wordIds={['w1', 'w2']} onApplied={onApplied} />,
        );

        expect(screen.getByText('Add tags to 2 words')).toBeInTheDocument();
        const row = (await screen.findByText('Kitchen')).closest('.pick-row') as HTMLElement;
        await user.click(row);
        await user.click(screen.getByRole('button', { name: 'Apply' }));

        await waitFor(() => expect(onApplied).toHaveBeenCalledWith([expect.objectContaining({ id: 'tag-1' })]));
        expect(fake.requests).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ path: '/tags/links', body: { tagIds: ['tag-1'], wordIds: ['w1', 'w2'] } }),
            ]),
        );
    });

    it('singular title at exactly one word', () => {
        setUp();
        renderWithProviders(<TagPickerDialog open onOpenChange={vi.fn()} mode="add" wordIds={['w1']} />);
        expect(screen.getByText('Add tags to 1 word')).toBeInTheDocument();
    });

    it('Cancel with nothing picked closes without calling the link endpoint', async () => {
        const fake = setUp([{ id: 'tag-1', authorId: ME, label: 'Kitchen', visibility: 'Private' }]);
        const user = userEvent.setup();
        const onOpenChange = vi.fn();
        renderWithProviders(
            <TagPickerDialog open onOpenChange={onOpenChange} mode="add" wordIds={['w1']} />,
        );

        await user.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(onOpenChange).toHaveBeenCalledWith(false);
        expect(fake.requests).toHaveLength(0);
    });

    it('with no wordIds (create flow), Apply skips the mutation and hands the picks to onApplied', async () => {
        const fake = setUp([{ id: 'tag-1', authorId: ME, label: 'Kitchen', visibility: 'Private' }]);
        const user = userEvent.setup();
        const onApplied = vi.fn();
        const onOpenChange = vi.fn();
        renderWithProviders(<TagPickerDialog open onOpenChange={onOpenChange} mode="add" onApplied={onApplied} />);

        expect(screen.getByText('Add tags to 1 word')).toBeInTheDocument();
        const row = (await screen.findByText('Kitchen')).closest('.pick-row') as HTMLElement;
        await user.click(row);
        await user.click(screen.getByRole('button', { name: 'Apply' }));

        expect(onOpenChange).toHaveBeenCalledWith(false);
        expect(onApplied).toHaveBeenCalledWith([expect.objectContaining({ id: 'tag-1' })]);
        expect(fake.requests).toHaveLength(0);
    });

    it('resets its selection each time it reopens', async () => {
        setUp([{ id: 'tag-1', authorId: ME, label: 'Kitchen', visibility: 'Private' }]);
        const user = userEvent.setup();
        const { rerender } = renderWithProviders(
            <TagPickerDialog open onOpenChange={vi.fn()} mode="add" wordIds={['w1']} />,
        );
        const row = (await screen.findByText('Kitchen')).closest('.pick-row') as HTMLElement;
        await user.click(row);
        expect(screen.getByText('1 selected', { exact: false })).toBeInTheDocument();

        rerender(<TagPickerDialog open={false} onOpenChange={vi.fn()} mode="add" wordIds={['w1']} />);
        rerender(<TagPickerDialog open onOpenChange={vi.fn()} mode="add" wordIds={['w1']} />);

        await screen.findByText('Kitchen');
        expect(screen.queryByText('1 selected', { exact: false })).not.toBeInTheDocument();
    });
});

describe('TagPickerDialog — remove mode', () => {
    it('titles itself for remove, scopes to restrictToIds, and Apply unlinks it', async () => {
        const fake = setUp([
            { id: 'tag-1', authorId: ME, label: 'Kitchen', visibility: 'Private' },
            { id: 'tag-2', authorId: ME, label: 'Garage', visibility: 'Private' },
        ]);
        const user = userEvent.setup();
        const onApplied = vi.fn();
        renderWithProviders(
            <TagPickerDialog
                open
                onOpenChange={vi.fn()}
                mode="remove"
                wordIds={['w1']}
                restrictToIds={new Set(['tag-1'])}
                onApplied={onApplied}
            />,
        );

        expect(screen.getByText('Remove tags from 1 word')).toBeInTheDocument();
        expect(await screen.findByText('Kitchen')).toBeInTheDocument();
        expect(screen.queryByText('Garage')).not.toBeInTheDocument();

        const row = screen.getByText('Kitchen').closest('.pick-row') as HTMLElement;
        await user.click(row);
        await user.click(screen.getByRole('button', { name: 'Apply' }));

        await waitFor(() => expect(onApplied).toHaveBeenCalled());
        expect(fake.requests).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ path: '/tags/links/remove', body: { tagIds: ['tag-1'], wordIds: ['w1'] } }),
            ]),
        );
    });
});
