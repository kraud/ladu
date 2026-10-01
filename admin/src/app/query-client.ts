import { QueryClient } from '@tanstack/react-query';

/** Retries are off: the backend is same-origin, so a failure is a real 4xx/5xx to show at once. */
export function createQueryClient(): QueryClient {
    return new QueryClient({
        defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
    });
}

export const queryClient = createQueryClient();
