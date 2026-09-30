/**
 * The code-based route tree.
 *
 *   root
 *   ├── /login         public
 *   └── _protected     pathless layout with the header; `beforeLoad` is the auth gate
 *       ├── /                 overview (placeholder)
 *       ├── /users            users list (search, filters, sort and page live in the URL)
 *       └── /users/$userId    user detail
 */
import {
    createRootRoute,
    createRoute,
    createRouter,
    createBrowserHistory,
    redirect,
    type RouterHistory,
} from '@tanstack/react-router';
import { authStore } from '@/stores/authStore';
import { isTokenExpired } from '@/lib/jwt';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { ProtectedLayout } from '@/routes/ProtectedLayout';
import { OverviewPage } from '@/features/overview/OverviewPage';
import { NotFoundPage } from '@/routes/NotFoundPage';
import { UsersPage } from '@/features/users/pages/UsersPage';
import { UserDetailPage } from '@/features/users/pages/UserDetailPage';
import { validateUsersSearch } from '@/features/users/search';

const rootRoute = createRootRoute({ notFoundComponent: NotFoundPage });

const loginRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/login',
    validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
        redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
    }),
    // A valid session has no reason to see the form.
    beforeLoad: () => {
        if (!isTokenExpired(authStore.getState().token)) throw redirect({ to: '/' });
    },
    component: LoginPage,
});

const protectedRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: '_protected',
    beforeLoad: ({ location }) => {
        if (isTokenExpired(authStore.getState().token)) {
            throw redirect({ to: '/login', search: { redirect: location.href } });
        }
    },
    component: ProtectedLayout,
});

const overviewRoute = createRoute({
    getParentRoute: () => protectedRoute,
    path: '/',
    component: OverviewPage,
});

const usersRoute = createRoute({
    getParentRoute: () => protectedRoute,
    path: '/users',
    validateSearch: validateUsersSearch,
    component: UsersPage,
});

const userDetailRoute = createRoute({
    getParentRoute: () => protectedRoute,
    path: '/users/$userId',
    component: UserDetailPage,
});

const routeTree = rootRoute.addChildren([
    loginRoute,
    protectedRoute.addChildren([overviewRoute, usersRoute, userDetailRoute]),
]);

/** Tests pass a memory history; the app uses the browser's. */
export function createAppRouter(history?: RouterHistory) {
    return createRouter({ routeTree, history: history ?? createBrowserHistory() });
}

export const router = createAppRouter();

declare module '@tanstack/react-router' {
    interface Register {
        router: ReturnType<typeof createAppRouter>;
    }
}
