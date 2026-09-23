import { useEffect, useRef } from 'react';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import { useOAuthCallback } from '../hooks';
import { OAuthSignupForm } from '../components/OAuthSignupForm';

/**
 * Where `GET /api/auth/:provider/callback` lands the browser after Google —
 * reads the URL fragment (never a query string — fragments never reach
 * server logs) and picks one of the three shapes `oauthController.ts` can
 * produce:
 *   `#token=<jwt>`                  outcome (a) — straight to `useOAuthCallback`.
 *   `#error=<code>`                 outcome (c) or a technical failure — same.
 *   `#ticket=<jwt>&mode=signup`     outcome (b) — renders the signup-completion
 *                                    screen instead of firing that mutation.
 * The branch happens here, in the parent, specifically so neither child
 * component needs a conditional hook call.
 */
export function OAuthCallbackPage() {
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
    const params = new URLSearchParams(hash);
    const ticket = params.get('ticket');
    const mode = params.get('mode');

    if (ticket && mode === 'signup') {
        return <OAuthSignupForm ticket={ticket} />;
    }

    return <OAuthCallbackRedirect hash={hash} />;
}

/** The token/error path — fires `useOAuthCallback` once and shows a loading state until it navigates away. */
function OAuthCallbackRedirect({ hash }: { hash: string }) {
    const callback = useOAuthCallback();

    // Fire exactly once for this mount, even though `callback` is a fresh
    // object on every render (React strict-mode double-invoke included) —
    // same pattern as VerifyEmailPage.
    const fired = useRef(false);
    useEffect(() => {
        if (fired.current) return;
        fired.current = true;
        callback.mutate(hash);
    }, [callback, hash]);

    return <LoadingScreen />;
}
