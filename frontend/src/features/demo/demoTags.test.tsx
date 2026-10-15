/**
 * Demo access in the app, Slice 2 (demo-access.md D9, D10 b/d): no Follow button and no visibility
 * choice for a demo (its tags are Private), the cap errors as messages, the metrics refresh after a
 * tag change, and the words-left / tags-left counters on the Account page.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement, ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Outlet, RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { I18nextProvider } from 'react-i18next';
import { http, HttpResponse } from 'msw';
import { createQueryClient } from '@/app/query-client';
import { createTestI18n, renderApp, renderWithProviders } from '@/test/render';
import { server } from '@/test/msw/server';
import { makeTagHandlers } from '@/test/msw/tagHandlers';
import { makeWordHandlers } from '@/test/msw/wordHandlers';
import { EMPTY_METRICS, makeMetricsHandlers } from '@/test/msw/metricsHandlers';
import { futureToken } from '@/test/tokens';
import { useAuthStore } from '@/stores/authStore';
import { metricsKeys } from '@/features/metrics/keys';
import { TagCard } from '@/features/tags/components/TagCard';
import { TagFormDialog } from '@/features/tags/components/TagFormDialog';
import { CloneTagDialog } from '@/features/tags/components/CloneTagDialog';
import { useCreateTag } from '@/features/tags/hooks';
import { tagErrorKey } from '@/features/tags/errors';
import { wordErrorKey } from '@/features/words/errors';
import type { TagSummary } from '@/features/tags/types';

const ME = 'demo-me';
const OTHER = 'user-other';
const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

const demoSession = {
    id: ME,
    name: 'Demo',
    email: 'demo+me@ladu.invalid',
    username: 'demo-me',
    languages: ['English', 'Spanish', 'German', 'Estonian'],
    uiLanguage: 'English',
    verified: true,
    isDemo: true,
    demoExpiresAt: inMinutes(15),
    demoWordLimit: 35,
    demoTagLimit: 7,
    token: futureToken(),
};
const normalSession = { id: 'me', name: 'Me', email: 'me@example.com', username: 'me', languages: ['English', 'Spanish'], token: futureToken() };

function makeTag(overrides: Partial<TagSummary> = {}): TagSummary {
    return {
        id: 'tag-1',
        label: 'Kitchen',
        description: null,
        visibility: 'Public',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        author: { id: OTHER, username: 'mari', badges: [] },
        wordCount: 5,
        followerCount: 3,
        languages: [],
        partsOfSpeech: [],
        isOwner: false,
        isFollowing: false,
        isAvailable: true,
        sourceTag: null,
        ...overrides,
    };
}

/** `TagCard` holds a router `Link`, so it needs a minimal router around it. */
async function renderCard(ui: ReactElement) {
    const rootRoute = createRootRoute({ component: () => (<>{ui}<Outlet /></>) });
    const tagRoute = createRoute({ getParentRoute: () => rootRoute, path: '/tag/$tagId', component: () => <p>tag page</p> });
    const router = createRouter({ routeTree: rootRoute.addChildren([tagRoute]), history: createMemoryHistory({ initialEntries: ['/'] }) });
    await router.load();
    render(
        <I18nextProvider i18n={createTestI18n()}>
            <RouterProvider router={router} />
        </I18nextProvider>,
    );
    await screen.findByRole('link', { name: /^Open / });
}

afterEach(() => useAuthStore.getState().clearSession());

describe('Follow is hidden for a demo (D10 d)', () => {
    it('a demo sees Copy but no Follow on a Discover card', async () => {
        useAuthStore.getState().setSession(demoSession);
        await renderCard(<TagCard tag={makeTag()} onFollow={vi.fn()} onClone={vi.fn()} />);
        expect(screen.queryByRole('button', { name: /Follow/ })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Copy|Clone/ })).toBeInTheDocument();
    });

    it('a normal account still sees Follow', async () => {
        useAuthStore.getState().setSession(normalSession);
        await renderCard(<TagCard tag={makeTag()} onFollow={vi.fn()} onClone={vi.fn()} />);
        expect(screen.getByRole('button', { name: /Follow/ })).toBeInTheDocument();
    });
});

describe('no visibility choice for a demo (D10 b)', () => {
    it('the create form has no Public/Private choice and creates a Private tag', async () => {
        const fake = makeTagHandlers({ callerId: ME });
        server.use(...fake.handlers, ...makeWordHandlers({ callerId: ME }).handlers);
        const user = userEvent.setup();
        const onSaved = vi.fn();
        renderWithProviders(<TagFormDialog open onOpenChange={vi.fn()} mode="create" onSaved={onSaved} />, { session: demoSession });

        expect(screen.queryAllByRole('radio')).toHaveLength(0);
        await user.type(screen.getByLabelText(/Label/), 'Mine');
        await user.click(screen.getByRole('button', { name: 'Create tag' }));

        await waitFor(() => expect(onSaved).toHaveBeenCalled());
        expect([...fake.store.values()].find((t) => t.label === 'Mine')?.visibility).toBe('Private');
    });

    it('a normal account still chooses, with Public first', () => {
        server.use(...makeTagHandlers({ callerId: 'me' }).handlers, ...makeWordHandlers({ callerId: 'me' }).handlers);
        renderWithProviders(<TagFormDialog open onOpenChange={vi.fn()} mode="create" />, { session: normalSession });
        const radios = screen.getAllByRole('radio');
        expect(radios).toHaveLength(2);
        expect(radios[0]).toBeChecked(); // Public, the first choice
    });

    it('the copy dialog has no visibility choice and copies as Private', async () => {
        const fake = makeTagHandlers({ callerId: ME, seedTags: [{ id: 'seed-kitchen', authorId: OTHER, label: 'Kitchen', visibility: 'Public' }] });
        server.use(...fake.handlers);
        const user = userEvent.setup();
        const onCloned = vi.fn();
        renderWithProviders(<CloneTagDialog open onOpenChange={vi.fn()} tag={makeTag({ id: 'seed-kitchen' })} onCloned={onCloned} />, {
            session: demoSession,
        });

        expect(screen.queryByRole('radio', { name: 'Public' })).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Create copy' }));
        await waitFor(() => expect(onCloned).toHaveBeenCalled());
        expect([...fake.store.values()].find((t) => t.id !== 'seed-kitchen')?.visibility).toBe('Private');
    });
});

describe('cap and restriction errors', () => {
    const coded = (code: string) => ({ response: { status: 403, data: { message: 'refused', code } } });

    it('map to the demo messages in the tag and word features', () => {
        expect(tagErrorKey(coded('demo_tag_limit'))).toBe('demo:errors.demo_tag_limit');
        expect(tagErrorKey(coded('demo_word_limit'))).toBe('demo:errors.demo_word_limit');
        expect(tagErrorKey(coded('demo_restricted'))).toBe('demo:errors.demo_restricted');
        expect(wordErrorKey(coded('demo_word_limit'))).toBe('demo:errors.demo_word_limit');
        expect(tagErrorKey(coded('something_else'))).toBe('common:errors.somethingWrong');
    });

    it('show in the tag form when the server refuses a tag past the cap', async () => {
        server.use(
            ...makeWordHandlers({ callerId: ME }).handlers,
            http.post('*/api/tags', () => HttpResponse.json({ message: 'The demo cannot have more tags', code: 'demo_tag_limit' }, { status: 403 })),
        );
        const user = userEvent.setup();
        renderWithProviders(<TagFormDialog open onOpenChange={vi.fn()} mode="create" />, { session: demoSession });
        await user.type(screen.getByLabelText(/Label/), 'One too many');
        await user.click(screen.getByRole('button', { name: 'Create tag' }));
        expect(await screen.findByText('The demo cannot have more tags. Create an account to add more.')).toBeInTheDocument();
    });
});

describe('a tag change refreshes the metrics (they count tags now)', () => {
    it('useCreateTag invalidates the metrics key', async () => {
        server.use(...makeTagHandlers({ callerId: ME }).handlers);
        const queryClient = createQueryClient();
        const spy = vi.spyOn(queryClient, 'invalidateQueries');
        const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
        const { result } = renderHook(() => useCreateTag(), { wrapper });

        result.current.mutate({ label: 'New', visibility: 'Private' });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(spy).toHaveBeenCalledWith({ queryKey: metricsKeys.all });
    });
});

describe('the Account page counters (D9)', () => {
    const identities = () => server.use(http.get('*/api/auth/identities', () => HttpResponse.json({ hasPassword: false, identities: [] })));

    it('shows the words and tags the demo can still add: frozen cap minus the totals', async () => {
        identities();
        server.use(...makeMetricsHandlers({ ...EMPTY_METRICS, totalWords: 20, totalTags: 6 }).handlers);
        await renderApp({ initialEntry: '/user', session: demoSession });

        const card = await screen.findByRole('region', { name: 'Demo account' });
        expect(await within(card).findByText('Words you can add: 15')).toBeInTheDocument();
        expect(within(card).getByText('Tags you can add: 1')).toBeInTheDocument();
    });

    it('never shows a number below 0', async () => {
        identities();
        server.use(...makeMetricsHandlers({ ...EMPTY_METRICS, totalWords: 40, totalTags: 9 }).handlers);
        await renderApp({ initialEntry: '/user', session: demoSession });

        const card = await screen.findByRole('region', { name: 'Demo account' });
        expect(await within(card).findByText('Words you can add: 0')).toBeInTheDocument();
        expect(within(card).getByText('Tags you can add: 0')).toBeInTheDocument();
    });
});
