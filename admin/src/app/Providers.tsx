import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { queryClient } from '@/app/query-client';
import { router } from '@/app/router';
import { onUnauthorized } from '@/api/client';

/** A 401 has cleared the session; send the user to the login page. */
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

function ErrorFallback({ resetErrorBoundary }: FallbackProps) {
    return (
        <div role="alert" className="flex flex-col items-start gap-2 p-4">
            <h1 className="text-xl font-semibold">Something went wrong</h1>
            <button className="underline" onClick={resetErrorBoundary}>
                Try again
            </button>
        </div>
    );
}

export function Providers() {
    return (
        <ErrorBoundary FallbackComponent={ErrorFallback}>
            <QueryClientProvider client={queryClient}>
                <UnauthorizedRedirect />
                <RouterProvider router={router} />
            </QueryClientProvider>
        </ErrorBoundary>
    );
}
