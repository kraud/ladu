import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/lib/theme';
import { loadTurnstile, turnstileLanguage, type CaptchaAction, type TurnstileApi } from './turnstile';

interface CaptchaWidgetProps {
    siteKey: string;
    action: CaptchaAction;
    /** A new token, or `null` when the token ended (it expired, the widget failed, or it was reset). */
    onToken: (token: string | null) => void;
    /** Change this number to get a new token: a token works for one request only. */
    resetKey: number;
}

/**
 * The Turnstile box (managed mode: Cloudflare decides if the visitor sees a checkbox). It draws the
 * widget into its own `div` once the script is loaded. A new theme or language draws it again.
 * `resetKey` asks for a new token without drawing again.
 */
export function CaptchaWidget({ siteKey, action, onToken, resetKey }: CaptchaWidgetProps) {
    const { t, i18n } = useTranslation();
    const { theme } = useTheme();
    const container = useRef<HTMLDivElement>(null);
    // The API that drew the widget, kept with its id: `reset` and `remove` go to the same API.
    const widget = useRef<{ api: TurnstileApi; id: string } | null>(null);
    const [loadFailed, setLoadFailed] = useState(false);

    // The latest callback, so a new function on each render does not draw the widget again.
    const onTokenRef = useRef(onToken);
    useEffect(() => {
        onTokenRef.current = onToken;
    }, [onToken]);

    useEffect(() => {
        let cancelled = false;
        setLoadFailed(false);

        loadTurnstile().then(
            (turnstile) => {
                if (cancelled || !container.current) return;
                const id = turnstile.render(container.current, {
                    sitekey: siteKey,
                    action,
                    theme,
                    language: turnstileLanguage(i18n.language),
                    callback: (token) => onTokenRef.current(token),
                    'expired-callback': () => onTokenRef.current(null),
                    'error-callback': () => onTokenRef.current(null),
                });
                widget.current = { api: turnstile, id };
            },
            () => {
                if (!cancelled) setLoadFailed(true);
            },
        );

        return () => {
            cancelled = true;
            if (widget.current) {
                widget.current.api.remove(widget.current.id);
                widget.current = null;
            }
            onTokenRef.current(null);
        };
    }, [siteKey, action, theme, i18n.language]);

    // Skip the first run: the widget was just drawn and already makes its own token.
    const firstReset = useRef(true);
    useEffect(() => {
        if (firstReset.current) {
            firstReset.current = false;
            return;
        }
        if (widget.current) widget.current.api.reset(widget.current.id);
    }, [resetKey]);

    return (
        <div className="captcha" aria-live="polite">
            <div ref={container} data-testid="captcha-widget" />
            {loadFailed && (
                <p className="banner warning" role="alert">
                    {t('common:captcha.loadError')}
                </p>
            )}
        </div>
    );
}
