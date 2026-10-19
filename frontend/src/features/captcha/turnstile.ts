/**
 * Cloudflare Turnstile in the browser (captcha.md C11): loads Cloudflare's script once and types the
 * little part of `window.turnstile` that Ladu uses. No npm package: the script has to come from
 * Cloudflare (a copy would stop working), so a wrapper library adds nothing.
 */
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export type CaptchaAction = 'demo' | 'register' | 'password_reset';

/** The options of `turnstile.render` that Ladu sets (names as in Cloudflare's widget configuration). */
export interface TurnstileRenderOptions {
    sitekey: string;
    action: CaptchaAction;
    theme: 'light' | 'dark';
    language: string;
    callback: (token: string) => void;
    'expired-callback': () => void;
    'error-callback': () => void;
}

export interface TurnstileApi {
    render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
    reset: (widgetId: string) => void;
    remove: (widgetId: string) => void;
}

declare global {
    interface Window {
        turnstile?: TurnstileApi;
    }
}

let loading: Promise<TurnstileApi> | null = null;

/**
 * The Turnstile API. The script is added to the page on the first call; every later call shares the
 * same promise. A failed load (an ad blocker, no network) clears it, so the next form can try again.
 */
export function loadTurnstile(): Promise<TurnstileApi> {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (loading) return loading;

    loading = new Promise<TurnstileApi>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = SCRIPT_URL;
        script.async = true;
        script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile did not load')));
        script.onerror = () => reject(new Error('Turnstile did not load'));
        document.head.appendChild(script);
    }).catch((error: unknown) => {
        loading = null;
        document.querySelector(`script[src="${SCRIPT_URL}"]`)?.remove();
        throw error;
    });
    return loading;
}

/**
 * Turnstile's widget language for an i18next code. Estonian is not supported by Turnstile, so it
 * (like any unknown code) uses `auto`: the browser language if Turnstile has it, else English.
 */
export function turnstileLanguage(i18nCode: string): string {
    const base = i18nCode.split('-')[0];
    return base === 'en' || base === 'es' || base === 'de' ? base : 'auto';
}
