import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UI_LANGUAGES } from '@/lib/language';

const ROTATE_MS = 5000;

/**
 * Post-login banner: "Welcome, {name}" + a one-line greeting that rotates
 * through the four UI languages (EN→ES→DE→EE), each shown in its own language.
 * Phase 1 Home is *only* this — the metrics query, stat cards and charts are
 * Phase 3.5 (`.context/plans/phase-1-auth-app-shell.md` decisions 5–7).
 */
export function WelcomeBanner({ name }: { name: string }) {
    const { t, i18n } = useTranslation('dashboard');
    const [index, setIndex] = useState(0);

    // Pull in the other three languages' `dashboard` bundle so each greeting
    // renders in its own language rather than falling back to the active one.
    // No-op (and harmless) when there is no i18n backend, e.g. in tests.
    useEffect(() => {
        Promise.resolve(i18n.loadLanguages(UI_LANGUAGES.map((l) => l.i18n))).catch(() => {});
    }, [i18n]);

    useEffect(() => {
        const id = window.setInterval(() => {
            setIndex((i) => (i + 1) % UI_LANGUAGES.length);
        }, ROTATE_MS);
        return () => window.clearInterval(id);
    }, []);

    const lang = UI_LANGUAGES[index]!;
    const greeting = i18n.getFixedT(lang.i18n, 'dashboard')('welcome.spinning', {
        defaultValue: t('welcome.spinning'),
    });

    return (
        <header className="flex flex-row gap-3">
            <h1 className="h1">{t('welcome.title', { name })}</h1>
            <p
                key={index}
                data-lang={lang.i18n}
                lang={lang.i18n}
                aria-live="polite"
                className="page meta text-[13.5px] content-end"
            >
                {greeting}
            </p>
        </header>
    );
}
