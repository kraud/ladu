import { useEffect, useRef } from 'react';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import { useOAuthCallback } from '../hooks';

/**
 * Where `GET /api/auth/:provider/callback` lands the browser after Google —
 * `useOAuthCallback` reads the URL fragment and either signs the user in or
 * surfaces a toast. This page has nothing to render either way beyond a
 * brief loading state; `useOAuthCallback` itself navigates on to `/` or
 * `/login`.
 */
export function OAuthCallbackPage() {
    const callback = useOAuthCallback();

    // Fire exactly once for this mount, even though `callback` is a fresh
    // object on every render (React strict-mode double-invoke included) —
    // same pattern as VerifyEmailPage.
    const fired = useRef(false);
    useEffect(() => {
        if (fired.current) return;
        fired.current = true;
        const hash = window.location.hash;
        callback.mutate(hash.startsWith('#') ? hash.slice(1) : hash);
    }, [callback]);

    return <LoadingScreen />;
}
