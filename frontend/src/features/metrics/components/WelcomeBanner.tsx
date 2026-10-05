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

    // Split the translated title after its first comma ("Welcome, Kai" -> "Welcome, " + "Kai"),
    // so the phone layout can break the line there. The text content stays unchanged.
    const title = t('welcome.title', { name });
    const comma = title.indexOf(', ');
    const lead = comma === -1 ? title : title.slice(0, comma + 2);
    const rest = comma === -1 ? undefined : title.slice(comma + 2);

    const lang = UI_LANGUAGES[index]!;
    const greeting = i18n.getFixedT(lang.i18n, 'dashboard')('welcome.spinning', {
        defaultValue: t('welcome.spinning'),
    });

    return (
        <header className="flex flex-row gap-3 max-[920px]:flex-col max-[920px]:gap-1">
            <h1 className="h1">
                {lead}
                {/* Phone: "Welcome," on the first row, the name on the next. */}
                {rest !== undefined && <br className="hidden max-[920px]:inline" />}
                {rest}
            </h1>
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
