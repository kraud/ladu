import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/msw/server';
import { makeTagHandlers } from '@/test/msw/tagHandlers';
import { makeWordHandlers, type SeedWord } from '@/test/msw/wordHandlers';
import { futureToken } from '@/test/tokens';
import { PartOfSpeech, Lang } from '@/ts/enums';
import { AddWordsDialog } from './AddWordsDialog';

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

function setUp(seedWords: SeedWord[] = [], seedTags: any[] = []) {
    const tagFake = makeTagHandlers({ callerId: SESSION.id, seedTags });
    const wordFake = makeWordHandlers({ callerId: SESSION.id, seed: seedWords });
    server.use(...tagFake.handlers, ...wordFake.handlers);
    return { tagFake, wordFake };
}

describe('AddWordsDialog', () => {
    it('excludes words already on the tag from the picker pool', async () => {
        setUp([verbSeed('run', 'w1'), verbSeed('jump', 'w2')]);
        renderWithProviders(
            <AddWordsDialog
                open
                onOpenChange={vi.fn()}
                tagId="tag-1"
                tagLabel="Verbs"
                existingWordIds={new Set(['w1'])}
            />,
            { session: SESSION },
        );

        expect(await screen.findByText('jump')).toBeInTheDocument();
        expect(screen.queryByText('run')).not.toBeInTheDocument();
    });

    it('Cancel with nothing picked just closes, without calling the link endpoint', async () => {
        const { tagFake } = setUp([verbSeed('run', 'w1')], [{ id: 'tag-1', authorId: SESSION.id, label: 'Verbs', visibility: 'Private' }]);
        const user = userEvent.setup();
        const onOpenChange = vi.fn();
        renderWithProviders(
            <AddWordsDialog open onOpenChange={onOpenChange} tagId="tag-1" tagLabel="Verbs" existingWordIds={new Set()} />,
            { session: SESSION },
        );
        await screen.findByText('run');

        await user.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(onOpenChange).toHaveBeenCalledWith(false);
        expect(tagFake.requests).toHaveLength(0);
    });

    it('picking words and saving links them to the tag, then closes and reports what was added', async () => {
        const { tagFake } = setUp(
            [verbSeed('run', 'w1'), verbSeed('jump', 'w2')],
            [{ id: 'tag-1', authorId: SESSION.id, label: 'Verbs', visibility: 'Private' }],
        );
        const user = userEvent.setup();
        const onOpenChange = vi.fn();
        const onAdded = vi.fn();
        renderWithProviders(
            <AddWordsDialog
                open
                onOpenChange={onOpenChange}
                tagId="tag-1"
                tagLabel="Verbs"
                existingWordIds={new Set()}
                onAdded={onAdded}
            />,
            { session: SESSION },
        );

        const row = (await screen.findByText('run')).closest('tr') as HTMLElement;
        await user.click(row);
        expect(screen.getByText('1 selected')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Add selected' }));

        await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
        expect(onAdded).toHaveBeenCalledWith([{ id: 'w1', label: 'run' }]);
        expect(tagFake.requests).toHaveLength(1);
        expect(tagFake.requests[0]).toEqual({
            method: 'POST',
            path: '/tags/links',
            body: { tagIds: ['tag-1'], wordIds: ['w1'] },
        });
    });

    it('resets the selection each time it reopens', async () => {
        setUp([verbSeed('run', 'w1')], [{ id: 'tag-1', authorId: SESSION.id, label: 'Verbs', visibility: 'Private' }]);
        const user = userEvent.setup();
        const { rerender } = renderWithProviders(
            <AddWordsDialog open onOpenChange={vi.fn()} tagId="tag-1" tagLabel="Verbs" existingWordIds={new Set()} />,
            { session: SESSION },
        );
        const row = (await screen.findByText('run')).closest('tr') as HTMLElement;
        await user.click(row);
        expect(screen.getByText('1 selected')).toBeInTheDocument();

        rerender(<AddWordsDialog open={false} onOpenChange={vi.fn()} tagId="tag-1" tagLabel="Verbs" existingWordIds={new Set()} />);
        rerender(<AddWordsDialog open onOpenChange={vi.fn()} tagId="tag-1" tagLabel="Verbs" existingWordIds={new Set()} />);

        expect(await screen.findByText('0 selected')).toBeInTheDocument();
    });
});
