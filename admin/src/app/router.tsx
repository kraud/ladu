/**
 * The code-based route tree.
 *
 *   root
 *   ├── /login         public
 *   └── _protected     pathless layout with the header; `beforeLoad` is the auth gate
 *       ├── /                 overview (placeholder)
 *       ├── /users            users list (search, filters, sort and page live in the URL)
 *       ├── /users/$userId    user detail
 *       ├── /health           deployment health
 *       ├── /staff            staff management (staff.manage)
 *       ├── /audit            audit log (audit.read)
 *       ├── /access           registration and login gates, two tabs (access.manage)
 *       ├── /account          your own account (every role)
 *       └── /account/password change your own password (also open to a temporary password)
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
import { HealthPage } from '@/features/health/pages/HealthPage';
import { StaffPage } from '@/features/staff/pages/StaffPage';
import { AuditPage } from '@/features/audit/pages/AuditPage';
import { validateAuditSearch } from '@/features/audit/search';
import { AccessPage } from '@/features/access/pages/AccessPage';
import { validateAccessSearch } from '@/features/access/search';
import { ChangePasswordPage } from '@/features/auth/pages/ChangePasswordPage';
import { AccountPage } from '@/features/auth/pages/AccountPage';

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
        const { token, staff } = authStore.getState();
        if (isTokenExpired(token)) {
            throw redirect({ to: '/login', search: { redirect: location.href } });
        }
        // A temporary password opens two pages only: your own account (it holds
        // Sign out) and the form that replaces the password. The server refuses
        // everything else anyway (403); this saves the round trip.
        if (staff?.mustChangePassword && location.pathname !== '/account' && location.pathname !== '/account/password') {
            throw redirect({ to: '/account/password' });
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

const healthRoute = createRoute({
    getParentRoute: () => protectedRoute,
    path: '/health',
    component: HealthPage,
});

/**
 * Sends a person without `permission` back to the overview. The server refuses
 * the API calls too; this only avoids showing a page that would fill with 403s.
 */
const requirePermission = (permission: string) => () => {
    if (!authStore.getState().staff?.permissions.includes(permission)) throw redirect({ to: '/' });
};

const staffRoute = createRoute({
    getParentRoute: () => protectedRoute,
    path: '/staff',
    beforeLoad: requirePermission('staff.manage'),
    component: StaffPage,
});

const auditRoute = createRoute({
    getParentRoute: () => protectedRoute,
    path: '/audit',
    validateSearch: validateAuditSearch,
    beforeLoad: requirePermission('audit.read'),
    component: AuditPage,
});

const accessRoute = createRoute({
    getParentRoute: () => protectedRoute,
    path: '/access',
    validateSearch: validateAccessSearch,
    beforeLoad: requirePermission('access.manage'),
    component: AccessPage,
});

const accountRoute = createRoute({
    getParentRoute: () => protectedRoute,
    path: '/account',
    component: AccountPage,
});

const changePasswordRoute = createRoute({
    getParentRoute: () => protectedRoute,
    path: '/account/password',
    component: ChangePasswordPage,
});

const routeTree = rootRoute.addChildren([
    loginRoute,
    protectedRoute.addChildren([
        overviewRoute,
        usersRoute,
        userDetailRoute,
        healthRoute,
        staffRoute,
        auditRoute,
        accessRoute,
        accountRoute,
        changePasswordRoute,
    ]),
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
