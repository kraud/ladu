import { useCallback, useState, type ReactNode } from 'react';
import { useAccess } from '@/features/access/hooks';
import { CaptchaWidget } from './CaptchaWidget';
import type { CaptchaAction } from './turnstile';

export interface CaptchaControl {
    /** The widget to put in the form; `null` while the captcha is off. */
    widget: ReactNode;
    /** The token to send as `captchaToken`; `undefined` while the captcha is off or has no token yet. */
    token: string | undefined;
    /** False while the captcha is on and the visitor has no token yet: keep the submit button disabled. */
    ready: boolean;
    /** Ask for a new token. Call it after every answer from the server, good or bad: a token works once. */
    reset: () => void;
}

/**
 * The captcha for one form (captcha.md C4, C7). Reads `captcha` from the public `GET /api/access`, so
 * a form does not wait for a widget when the owner has the switch off.
 */
export function useCaptcha(action: CaptchaAction): CaptchaControl {
    const { captcha } = useAccess();
    const [token, setToken] = useState<string | null>(null);
    const [resetKey, setResetKey] = useState(0);

    const reset = useCallback(() => {
        setToken(null);
        setResetKey((key) => key + 1);
    }, []);

    if (!captcha.enabled) return { widget: null, token: undefined, ready: true, reset };

    return {
        widget: <CaptchaWidget siteKey={captcha.siteKey} action={action} onToken={setToken} resetKey={resetKey} />,
        token: token ?? undefined,
        ready: token !== null,
        reset,
    };
}
