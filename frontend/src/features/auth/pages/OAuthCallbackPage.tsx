import { useEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import { useOAuthCallback } from '../hooks';
import { OAuthSignupForm } from '../components/OAuthSignupForm';
import { OAuthLinkForm } from '../components/OAuthLinkForm';
import { OAuthCallbackError, oauthErrorKey } from '../errors';

/**
 * Where `GET /api/auth/:provider/callback` lands the browser after Google —
 * reads the URL fragment (never a query string — fragments never reach
 * server logs) and picks one of the six shapes `oauthController.ts` can
 * produce:
 *   `#token=<jwt>`                  outcome (a) — straight to `useOAuthCallback`.
 *   `#error=<code>`                 a technical failure during a login attempt — same.
 *   `#ticket=<jwt>&mode=signup`     outcome (b) — the signup-completion screen.
 *   `#ticket=<jwt>&mode=link`       outcome (c) — the password-confirm screen.
 *   `#linked=<provider>`            Phase 5's connect flow, success.
 *   `#link-error=<code>`            Phase 5's connect flow, failure.
 * The last two are their own fragment keys, not `#token=`/`#error=`, on
 * purpose: the connect flow starts from an *already logged-in* user (the
 * Account page), never touches their session either way, and must not be
 * treated like a failed login attempt — `useOAuthCallback`'s `onError`
 * clears the session, which would wrongly log someone out just because
 * connecting a second provider didn't work.
 * The branch happens here, in the parent, specifically so none of the
 * child components needs a conditional hook call.
 */
export function OAuthCallbackPage() {
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
    const params = new URLSearchParams(hash);
    const ticket = params.get('ticket');
    const mode = params.get('mode');
    const linked = params.get('linked');
    const linkError = params.get('link-error');

    if (ticket && mode === 'signup') {
        return <OAuthSignupForm ticket={ticket} />;
    }
    if (ticket && mode === 'link') {
        return <OAuthLinkForm ticket={ticket} />;
    }
    if (linked || linkError) {
        return <OAuthLinkOutcome success={!!linked} errorCode={linkError} />;
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

/**
 * Phase 5's connect-flow landing — no network call, no session change, just
 * a toast and a trip back to the Account page. `useOAuthIdentities`'s query
 * there refetches on mount, so a freshly connected/failed provider shows up
 * without any extra plumbing here.
 */
function OAuthLinkOutcome({ success, errorCode }: { success: boolean; errorCode: string | null }) {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const fired = useRef(false);
    useEffect(() => {
        if (fired.current) return;
        fired.current = true;
        if (success) {
            toast.success(t('account:signInMethods.connectSuccess'));
        } else {
            toast.error(t(oauthErrorKey(new OAuthCallbackError(errorCode ?? 'oauth_failed'))));
        }
        void navigate({ to: '/user' });
    }, [success, errorCode, navigate, t]);

    return <LoadingScreen />;
}
