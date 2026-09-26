/**
 * The one place app-wide context is assembled. Order matters:
 *
 *   ErrorBoundary            catches render crashes from everything below
 *   └ QueryClientProvider    server-state cache
 *     └ I18nextProvider      the shared i18next instance
 *       └ Suspense           REQUIRED — i18next `useSuspense` defaults to true;
 *         │                  the first lazy namespace throws without a boundary
 *         ├ RouterProvider   owns all rendering from here
 *         └ ToastContainer   bottom-center, one host for the whole app
 *
 * The 401 interceptor in `api/client.ts` can't import the router (cycle), so it
 * exposes `onUnauthorized`; `UnauthorizedRedirect` below is the subscriber that
 * turns a 401 into a `/login` navigation.
 */
import { Suspense, useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { I18nextProvider } from 'react-i18next';
import { ErrorBoundary } from 'react-error-boundary';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import i18n from '@/i18n';
import { queryClient } from '@/app/query-client';
import { router } from '@/app/router';
import { onUnauthorized } from '@/api/client';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import { ErrorState } from '@/components/common/ErrorState';
import { useTheme } from '@/lib/theme';

function UnauthorizedRedirect() {
    useEffect(
        () =>
            onUnauthorized(() => {
                void router.navigate({ to: '/login' });
            }),
        [],
    );
    return null;
}

export function Providers() {
    // Toasts follow the light/dark theme (Phase 3.9) — the container's own
    // palette, not `tokens.css`, so it needs the value as a prop.
    const { theme } = useTheme();

    return (
        <ErrorBoundary FallbackComponent={ErrorState}>
            <QueryClientProvider client={queryClient}>
                <I18nextProvider i18n={i18n}>
                    <Suspense fallback={<LoadingScreen />}>
                        <UnauthorizedRedirect />
                        <RouterProvider router={router} />
                        <ToastContainer
                            position="bottom-center"
                            newestOnTop
                            closeOnClick
                            theme={theme}
                        />
                    </Suspense>
                </I18nextProvider>
            </QueryClientProvider>
        </ErrorBoundary>
    );
}
