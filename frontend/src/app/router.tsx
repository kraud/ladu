/**
 * The code-based typed route tree (decision D1 — no file-based router plugin).
 *
 * Shape:
 *   root
 *   ├── _public     (pathless layout, no header)   → login, register, verify, reset
 *   └── _protected  (pathless layout, AppShell)    → dashboard, addWord, word,
 *                                                     words, practice, account,
 *                                                     notifications, tag
 *
 * `_protected.beforeLoad` is the single centralised auth gate (fixes the old
 * app's per-page guards and its four unguarded pages). Most leaves below it
 * were thin placeholders as of Slice 2 — the Phase-1 gate is literally
 * "visiting *any* protected route unauthenticated redirects", which needed
 * the routes to exist before their real pages did. `addWord` got its real
 * page in Phase 2 Slice 4, `word` in Slice 5; the rest still await later
 * slices/phases.
 */
import {
    createRootRoute,
    createRoute,
    createRouter,
    redirect,
    type RouterHistory,
} from '@tanstack/react-router';
import { authStore } from '@/stores/authStore';
import { isTokenExpired } from '@/lib/jwt';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import { PublicLayout } from '@/routes/public-layout';
import { ProtectedLayout } from '@/routes/protected-layout';
import { NotFoundPage } from '@/routes/not-found';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { RegisterPage } from '@/features/auth/pages/RegisterPage';
import { VerifyEmailPage } from '@/features/auth/pages/VerifyEmailPage';
import { ResetPasswordPage } from '@/features/auth/pages/ResetPasswordPage';
import { OAuthCallbackPage } from '@/features/auth/pages/OAuthCallbackPage';
import { DashboardPage } from '@/features/metrics/pages/DashboardPage';
import { AccountPage } from '@/features/account/pages/AccountPage';
import { AddWordPage } from '@/features/words/pages/AddWordPage';
import { WordPage } from '@/features/words/pages/WordPage';
import { PracticePage } from '@/features/practice/pages/PracticePage';
import { validatePracticeSearch } from '@/features/practice/search';
import { usePracticeSessionStore } from '@/features/practice/sessionStore';
import { ReviewPage } from '@/features/words/pages/ReviewPage';
import { validateReviewSearch } from '@/features/words/review/search';
import { TagsPage } from '@/features/tags/pages/TagsPage';
import { TagViewPage } from '@/features/tags/pages/TagViewPage';
import { isAuthorBadgeType, type AuthorBadgeType, type TagScope } from '@/features/tags/types';

const SCOPE_VALUES = new Set<string>(['all', 'owned', 'followed', 'discover'] satisfies TagScope[]);

/** `staticData.wide` opts a leaf route into `AppShell`'s wider `max-w-7xl` container — the word
 * compose/edit/detail pages need it for the verb tense-column grid. Read by `ProtectedLayout`. */
declare module '@tanstack/react-router' {
    interface StaticDataRouteOption {
        wide?: boolean;
        /** The page renders its own `SidebarLayout`: `AppShell` gives it the full window width. */
        sidebar?: boolean;
    }
}

/** Temporary leaf for routes whose real page lands in a later slice. */
function Placeholder({ title, note }: { title: string; note?: string }) {
    return (
        <div className="flex flex-col gap-2">
            <h1 className="h1">{title}</h1>
            <p className="meta">{note ?? 'Placeholder — built in a later slice.'}</p>
        </div>
    );
}

const rootRoute = createRootRoute();

// ── Public ─────────────────────────────────────────────────────────────────
const publicLayoutRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: '_public',
    component: PublicLayout,
});

const loginRoute = createRoute({
    getParentRoute: () => publicLayoutRoute,
    path: '/login',
    validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
        redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
    }),
    component: LoginPage,
});

const registerRoute = createRoute({
    getParentRoute: () => publicLayoutRoute,
    path: '/register',
    component: RegisterPage,
});

const verifyRoute = createRoute({
    getParentRoute: () => publicLayoutRoute,
    path: '/user/$userId/verify/$tokenId',
    component: VerifyEmailPage,
});

const resetPasswordRoute = createRoute({
    getParentRoute: () => publicLayoutRoute,
    path: '/resetPassword/{-$userId}/{-$tokenId}',
    component: ResetPasswordPage,
});

const oauthCallbackRoute = createRoute({
    getParentRoute: () => publicLayoutRoute,
    path: '/auth/callback',
    component: OAuthCallbackPage,
});

// ── Protected ──────────────────────────────────────────────────────────────
const protectedLayoutRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: '_protected',
    beforeLoad: ({ location }) => {
        const { token } = authStore.getState();
        if (isTokenExpired(token)) {
            throw redirect({ to: '/login', search: { redirect: location.href } });
        }
    },
    component: ProtectedLayout,
});

const dashboardRoute = createRoute({
    getParentRoute: () => protectedLayoutRoute,
    path: '/',
    component: DashboardPage,
});

const addWordRoute = createRoute({
    getParentRoute: () => protectedLayoutRoute,
    path: '/addWord/{-$partOfSpeech}',
    component: AddWordPage,
    staticData: { wide: true, sidebar: true },
});

const wordRoute = createRoute({
    getParentRoute: () => protectedLayoutRoute,
    path: '/word/$wordId',
    component: WordPage,
    staticData: { wide: true, sidebar: true },
});

const reviewRoute = createRoute({
    getParentRoute: () => protectedLayoutRoute,
    path: '/words',
    validateSearch: validateReviewSearch,
    component: ReviewPage,
    staticData: { sidebar: true },
});

// The word list used to live at `/review`: old links and bookmarks keep their filters.
const legacyReviewRoute = createRoute({
    getParentRoute: () => protectedLayoutRoute,
    path: '/review',
    validateSearch: validateReviewSearch,
    beforeLoad: ({ search }) => {
        throw redirect({ to: '/words', search });
    },
});

const practiceRoute = createRoute({
    getParentRoute: () => protectedLayoutRoute,
    path: '/practice',
    validateSearch: validatePracticeSearch,
    component: PracticePage,
    // Stage 1 renders a `SidebarLayout`; stages 2 and 3 wrap themselves in `PageColumn`.
    staticData: { sidebar: true },
    // Only a navigation fires this; a reload does not, so a reload keeps the session open.
    onLeave: () => usePracticeSessionStore.getState().park(),
});

const accountRoute = createRoute({
    getParentRoute: () => protectedLayoutRoute,
    path: '/user',
    component: AccountPage,
});

const notificationsRoute = createRoute({
    getParentRoute: () => protectedLayoutRoute,
    path: '/user/$userId/notifications',
    component: () => <Placeholder title="Notifications" note="Inbox lands in Phase 6." />,
});

const tagsRoute = createRoute({
    getParentRoute: () => protectedLayoutRoute,
    path: '/tags',
    // `scope` (D2) and `badge` (the author filter, verified-badges.md) are
    // URL-persisted, so a view like "official tags" can be shared. `q`/`sort`
    // stay local page state, matching MOCKUPS/tags.html's own persistence.
    // Kept inline (no separate search.ts): two scalar fields, unlike Review's
    // multi-field, array-valued contract. A `badge` this build does not know is dropped.
    validateSearch: (search: Record<string, unknown>): { scope?: TagScope; badge?: AuthorBadgeType } => {
        const raw = typeof search.scope === 'string' ? search.scope : undefined;
        const scope = raw && SCOPE_VALUES.has(raw) ? (raw as TagScope) : undefined;
        const badge = typeof search.badge === 'string' && isAuthorBadgeType(search.badge) ? search.badge : undefined;
        return { scope, badge };
    },
    component: TagsPage,
});

const tagRoute = createRoute({
    getParentRoute: () => protectedLayoutRoute,
    path: '/tag/$tagId',
    component: TagViewPage,
});

const routeTree = rootRoute.addChildren([
    publicLayoutRoute.addChildren([
        loginRoute,
        registerRoute,
        verifyRoute,
        resetPasswordRoute,
        oauthCallbackRoute,
    ]),
    protectedLayoutRoute.addChildren([
        dashboardRoute,
        addWordRoute,
        wordRoute,
        reviewRoute,
        legacyReviewRoute,
        practiceRoute,
        accountRoute,
        notificationsRoute,
        tagsRoute,
        tagRoute,
    ]),
]);

export function createAppRouter(history?: RouterHistory) {
    return createRouter({
        routeTree,
        history,
        defaultNotFoundComponent: NotFoundPage,
        defaultPendingComponent: LoadingScreen,
    });
}

export const router = createAppRouter();

declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router;
    }
}
