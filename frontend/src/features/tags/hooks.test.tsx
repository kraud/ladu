import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/app/query-client';
import { getApiErrorMessage } from '@/api/types';
import { server } from '@/test/msw/server';
import { makeTagHandlers, type SeedTag } from '@/test/msw/tagHandlers';
import {
    useCloneTag,
    useCreateTag,
    useDeleteTag,
    useFollowTag,
    useLinkTagsToWords,
    useTag,
    useTags,
    useTagsByIds,
    useUnfollowTag,
    useUnlinkTagsFromWords,
    useUpdateTag,
} from './hooks';
import { tagKeys } from './keys';
import { wordKeys } from '@/features/words/keys';
import type { CreateTagBody } from './types';

const ME = 'user-me';
const OTHER = 'user-other';

function setup(seedTags: SeedTag[] = [], wordOwners: Record<string, string> = {}) {
    const fake = makeTagHandlers({ callerId: ME, seedTags, wordOwners });
    server.use(...fake.handlers);

    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    function wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }

    return { fake, queryClient, invalidateSpy, wrapper };
}

function ownedTag(label: string, id = `tag-${label}`): SeedTag {
    return { id, authorId: ME, label, visibility: 'Private' };
}

describe('useTag', () => {
    it('returns a tag the caller can see', async () => {
        const { wrapper } = setup([ownedTag('Kitchen')]);
        const { result } = renderHook(() => useTag('tag-Kitchen'), { wrapper });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.label).toBe('Kitchen');
        expect(result.current.data?.isOwner).toBe(true);
        expect(result.current.data).not.toHaveProperty('_id');
    });

    it('surfaces a 404 for a tag the caller has no standing on', async () => {
        const { wrapper } = setup([{ id: 'tag-hidden', authorId: OTHER, label: 'Hidden', visibility: 'Private' }]);
        const { result } = renderHook(() => useTag('tag-hidden'), { wrapper });

        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(getApiErrorMessage(result.current.error)).toBe('Tag not found');
    });

    it('stays idle for an empty id', () => {
        const { wrapper } = setup();
        const { result } = renderHook(() => useTag(''), { wrapper });

        expect(result.current.fetchStatus).toBe('idle');
        expect(result.current.data).toBeUndefined();
    });
});

describe('useTagsByIds', () => {
    it('resolves each id to its full TagSummary, in no particular order guarantee, via useQueries', async () => {
        const { wrapper } = setup([ownedTag('Kitchen'), ownedTag('Garage')]);
        const { result } = renderHook(() => useTagsByIds(['tag-Kitchen', 'tag-Garage']), { wrapper });

        await waitFor(() => expect(result.current.isPending).toBe(false));
        expect(result.current.data.map((tag) => tag.label).sort()).toEqual(['Garage', 'Kitchen']);
    });

    it('returns an empty array for an empty id list, with no request', () => {
        const { wrapper } = setup();
        const { result } = renderHook(() => useTagsByIds([]), { wrapper });

        expect(result.current.data).toEqual([]);
        expect(result.current.isPending).toBe(false);
    });

    it('drops an id that 404s rather than surfacing an error', async () => {
        const { wrapper } = setup([ownedTag('Kitchen')]);
        const { result } = renderHook(() => useTagsByIds(['tag-Kitchen', 'does-not-exist']), { wrapper });

        await waitFor(() => expect(result.current.isPending).toBe(false));
        expect(result.current.data).toHaveLength(1);
        expect(result.current.data[0].label).toBe('Kitchen');
    });
});

describe('useTags', () => {
    it('fetches scope=owned and excludes another user\'s tags', async () => {
        const { wrapper } = setup([
            ownedTag('Mine'),
            { id: 'tag-other', authorId: OTHER, label: 'NotMine', visibility: 'Public' },
        ]);
        const { result } = renderHook(() => useTags({ scope: 'owned' }), { wrapper });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.pages[0].items).toHaveLength(1);
        expect(result.current.data?.pages[0].items[0].label).toBe('Mine');
        expect(result.current.hasNextPage).toBe(false);
    });

    it('pages via nextCursor once more tags exist than fit on one page', async () => {
        const seed = Array.from({ length: 25 }, (_, i) => ownedTag(String(i), `tag-${i}`));
        const { wrapper } = setup(seed);
        const { result } = renderHook(() => useTags({ scope: 'owned' }), { wrapper });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.pages[0].items).toHaveLength(24);
        expect(result.current.hasNextPage).toBe(true);

        void result.current.fetchNextPage();
        await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));

        expect(result.current.data?.pages[1].items).toHaveLength(1);
        expect(result.current.hasNextPage).toBe(false);
        const allIds = new Set(result.current.data?.pages.flatMap((p) => p.items.map((t) => t.id)));
        expect(allIds.size).toBe(25);
    });
});

describe('useCreateTag', () => {
    it('creates a tag and invalidates tags + words', async () => {
        const { wrapper, invalidateSpy } = setup();
        const { result } = renderHook(() => useCreateTag(), { wrapper });

        const body: CreateTagBody = { label: 'Kitchen', visibility: 'Private' };
        result.current.mutate(body);

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.label).toBe('Kitchen');
        expect(result.current.data?.isOwner).toBe(true);
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: tagKeys.all });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: wordKeys.all });
    });

    it('surfaces the label-conflict 409 from the backend', async () => {
        const { wrapper } = setup([ownedTag('Kitchen')]);
        const { result } = renderHook(() => useCreateTag(), { wrapper });

        result.current.mutate({ label: 'Kitchen', visibility: 'Private' });
        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(getApiErrorMessage(result.current.error)).toBe('You already have a tag with this label.');
    });
});

describe('useUpdateTag', () => {
    it('writes the fresh tag into the detail cache and invalidates', async () => {
        const { queryClient, wrapper, invalidateSpy } = setup([ownedTag('Kitchen')]);
        const { result } = renderHook(() => useUpdateTag(), { wrapper });

        result.current.mutate({ id: 'tag-Kitchen', body: { visibility: 'Public' } });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data?.visibility).toBe('Public');
        expect(queryClient.getQueryData(tagKeys.detail('tag-Kitchen'))).toEqual(result.current.data);
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: tagKeys.all });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: wordKeys.all });
    });
});

describe('useDeleteTag', () => {
    it('drops the detail cache entry and invalidates', async () => {
        const { queryClient, wrapper, invalidateSpy } = setup([ownedTag('Kitchen')]);
        queryClient.setQueryData(tagKeys.detail('tag-Kitchen'), { id: 'tag-Kitchen' });

        const { result } = renderHook(() => useDeleteTag(), { wrapper });
        result.current.mutate('tag-Kitchen');

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual({ id: 'tag-Kitchen' });
        expect(queryClient.getQueryData(tagKeys.detail('tag-Kitchen'))).toBeUndefined();
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: tagKeys.all });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: wordKeys.all });
    });
});

describe('useFollowTag / useUnfollowTag', () => {
    it('follows a Public tag and reflects isFollowing', async () => {
        const { wrapper, invalidateSpy } = setup([
            { id: 'tag-public', authorId: OTHER, label: 'Public one', visibility: 'Public' },
        ]);
        const { result } = renderHook(() => useFollowTag(), { wrapper });

        result.current.mutate('tag-public');
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.isFollowing).toBe(true);
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: tagKeys.all });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: wordKeys.all });
    });

    it('unfollows a tag and reflects isFollowing', async () => {
        const { wrapper, invalidateSpy } = setup([
            { id: 'tag-public', authorId: OTHER, label: 'Public one', visibility: 'Public', followerIds: [ME] },
        ]);
        const { result } = renderHook(() => useUnfollowTag(), { wrapper });

        result.current.mutate('tag-public');
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.isFollowing).toBe(false);
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: tagKeys.all });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: wordKeys.all });
    });

    it('surfaces the 400 for following your own tag', async () => {
        const { wrapper } = setup([ownedTag('Mine')]);
        const { result } = renderHook(() => useFollowTag(), { wrapper });

        result.current.mutate('tag-Mine');
        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(getApiErrorMessage(result.current.error)).toBe('You already own this tag');
    });
});

describe('useCloneTag', () => {
    it('clones a Public tag with the caller\'s chosen visibility', async () => {
        const { wrapper, invalidateSpy } = setup([
            { id: 'tag-public', authorId: OTHER, label: 'Public one', visibility: 'Public', wordIds: ['word-1'] },
        ]);
        const { result } = renderHook(() => useCloneTag(), { wrapper });

        result.current.mutate({ id: 'tag-public', body: { visibility: 'Private' } });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data?.isOwner).toBe(true);
        expect(result.current.data?.visibility).toBe('Private');
        expect(result.current.data?.wordCount).toBe(1);
        expect(result.current.data?.sourceTag).toEqual({ id: 'tag-public', label: 'Public one' });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: tagKeys.all });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: wordKeys.all });
    });
});

describe('useLinkTagsToWords / useUnlinkTagsFromWords', () => {
    it('links a tag to words and invalidates tags + words', async () => {
        const { fake, wrapper, invalidateSpy } = setup([ownedTag('Kitchen')], { 'word-1': ME });
        const { result } = renderHook(() => useLinkTagsToWords(), { wrapper });

        result.current.mutate({ tagIds: ['tag-Kitchen'], wordIds: ['word-1'] });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(fake.store.get('tag-Kitchen')?.wordIds.has('word-1')).toBe(true);
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: tagKeys.all });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: wordKeys.all });
    });

    it('surfaces 403 and applies nothing when a word is not owned by the caller', async () => {
        const { fake, wrapper } = setup([ownedTag('Kitchen')], { 'word-1': OTHER });
        const { result } = renderHook(() => useLinkTagsToWords(), { wrapper });

        result.current.mutate({ tagIds: ['tag-Kitchen'], wordIds: ['word-1'] });
        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(getApiErrorMessage(result.current.error)).toBe(
            'User not authorized to modify one or more of these words',
        );
        expect(fake.store.get('tag-Kitchen')?.wordIds.has('word-1')).toBe(false);
    });

    it('unlinks a tag from a word and invalidates tags + words', async () => {
        const { fake, wrapper, invalidateSpy } = setup(
            [{ ...ownedTag('Kitchen'), wordIds: ['word-1'] }],
            { 'word-1': ME },
        );
        const { result } = renderHook(() => useUnlinkTagsFromWords(), { wrapper });

        result.current.mutate({ tagIds: ['tag-Kitchen'], wordIds: ['word-1'] });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(fake.store.get('tag-Kitchen')?.wordIds.has('word-1')).toBe(false);
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: tagKeys.all });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: wordKeys.all });
    });
});
