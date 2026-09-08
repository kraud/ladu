import type { FallbackProps } from 'react-error-boundary';
import { Button } from '@/components/ui/button';

/**
 * Inline error panel. Shape matches `react-error-boundary`'s `FallbackProps`
 * so it drops straight into the root `<ErrorBoundary>` in `app/Providers.tsx`,
 * and is also usable standalone (both props are optional).
 */
export function ErrorState({ error, resetErrorBoundary }: Partial<FallbackProps>) {
    const message = error instanceof Error ? error.message : 'Something went wrong.';

    return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-6 text-center" role="alert">
            <p className="h3">Something went wrong</p>
            <p className="meta max-w-md">{message}</p>
            {resetErrorBoundary && (
                <Button variant="outline" onClick={resetErrorBoundary}>
                    Try again
                </Button>
            )}
        </div>
    );
}
