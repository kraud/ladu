/**
 * The code-based typed route tree (decision D1 — no file-based router plugin).
 *
 * Shape:
 *   root
 *   ├── _public     (pathless layout, no header)   → login, register, verify, reset
 *   └── _protected  (pathless layout, AppShell)    → dashboard, addWord, word,
 *                                                     review, practice, account,
 *                                                     notifications, tag
 *
 * `_protected.beforeLoad` is the single centralised auth gate (fixes the old
 * app's per-page guards and its four unguarded pages). Every leaf below it is a
 * thin placeholder in Slice 2 — the Phase-1 gate is literally "visiting *any*
 * protected route unauthenticated redirects", which needs the routes to exist.
 */
import {
    createRootRoute,
    createRoute,
    createRouter,
    redirect,
    Link,
    type RouterHistory,
} from '@tanstack/react-router';
import { authStore } from '@/stores/authStore';
import { isTokenExpired } from '@/lib/jwt';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import { PublicLayout } from '@/routes/public-layout';
import { ProtectedLayout } from '@/routes/protected-layout';
import { NotFoundPage } from '@/routes/not-found';

/** Temporary leaf for routes whose real page lands in a later slice. */
function Placeholder({ title, note }: { title: string; note?: string }) {
    return (
        <div className="flex flex-col gap-2">
            <h1 className="h1">{title}</h1>
            <p className="meta">{note ?? 'Placeholder — built in a later slice.'}</p>
        </div>
    );
}

/** Centered placeholder for public (headerless) routes. */
function PublicPlaceholder({ title }: { title: string }) {
    return (
        <div className="auth-shell">
            <span className="logo auth-banner">
                <span className="logo-mark">L</span>Ladu
            </span>
            <div className="card card-pad auth-card flex flex-col gap-2 text-center">
                <h1 className="h2">{title}</h1>
                <p className="meta">Placeholder — real form lands in Slice 3.</p>
                <div className="auth-links">
                    <Link to="/login">Login</Link>
                    <span>·</span>
                    <Link to="/register">Register</Link>
                </div>
            </div>
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
    component: () => <PublicPlaceholder title="Login" />,
});

const registerRoute = createRoute({
    getParentRoute: () => publicLayoutRoute,
    path: '/register',
    component: () => <PublicPlaceholder title="Register" />,
});

const verifyRoute = createRoute({
    getParentRoute: () => publicLayoutRoute,
    path: '/user/$userId/verify/$tokenId',
    component: () => <PublicPlaceholder title="Verify email" />,
});

const resetPasswordRoute = createRoute({
    getParentRoute: () => publicLayoutRoute,
    path: '/resetPassword/{-$userId}/{-$tokenId}',
    component: () => <PublicPlaceholder title="Reset password" />,
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
    component: () => <Placeholder title="Dashboard" note="Shell only — metrics land in Slice 4." />,
});

const addWordRoute = createRoute({
    getParentRoute: () => protectedLayoutRoute,
    path: '/addWord/{-$partOfSpeech}',
    component: () => <Placeholder title="Add word" note="Form engine lands in Phase 2." />,
});

const wordRoute = createRoute({
    getParentRoute: () => protectedLayoutRoute,
    path: '/word/$wordId',
    component: () => <Placeholder title="Word" note="View / edit lands in Phase 2." />,
});

const reviewRoute = createRoute({
    getParentRoute: () => protectedLayoutRoute,
    path: '/review',
    component: () => <Placeholder title="Review" note="Table lands in Phase 3." />,
});

const practiceRoute = createRoute({
    getParentRoute: () => protectedLayoutRoute,
    path: '/practice',
    component: () => <Placeholder title="Practice" note="Exercise flow lands in Phase 5." />,
});

const accountRoute = createRoute({
    getParentRoute: () => protectedLayoutRoute,
    path: '/user',
    component: () => <Placeholder title="Account" note="Profile lands in Phase 7." />,
});

const notificationsRoute = createRoute({
    getParentRoute: () => protectedLayoutRoute,
    path: '/user/$userId/notifications',
    component: () => <Placeholder title="Notifications" note="Inbox lands in Phase 6." />,
});

const tagRoute = createRoute({
    getParentRoute: () => protectedLayoutRoute,
    path: '/tag/$tagId',
    component: () => <Placeholder title="Tag" note="Tag view lands in Phase 4." />,
});

const routeTree = rootRoute.addChildren([
    publicLayoutRoute.addChildren([loginRoute, registerRoute, verifyRoute, resetPasswordRoute]),
    protectedLayoutRoute.addChildren([
        dashboardRoute,
        addWordRoute,
        wordRoute,
        reviewRoute,
        practiceRoute,
        accountRoute,
        notificationsRoute,
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
