import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HandWavingIcon } from '@phosphor-icons/react';
import { UI_LANGUAGES } from '@/lib/language';

const ROTATE_MS = 8000;

/**
 * Post-login banner: "Welcome, {name}" + a one-line greeting that rotates
 * through the four UI languages (EN→ES→DE→EE), each shown in its own language.
 * Phase 1 Home is *only* this — the metrics query, stat cards and charts are
 * Phase 3.5 (`.context/plans/phase-1-auth-app-shell.md` decisions 5–7).
 */
export function WelcomeBanner({ name }: { name: string }) {
    const { t, i18n } = useTranslation('dashboard');
    const [index, setIndex] = useState(0);
    const headerRef = useRef<HTMLElement>(null);
    const textRef = useRef<HTMLDivElement>(null);

    // The phone icon is as tall as the text column beside it. CSS alone cannot do that (a stretched
    // box gives an `aspect-ratio` child no width), so the column's height is measured and handed to
    // the icon as `--welcome-h`. The text column never depends on the icon, so this cannot loop.
    useEffect(() => {
        const header = headerRef.current;
        const text = textRef.current;
        if (!header || !text || typeof ResizeObserver === 'undefined') return;
        const apply = () => header.style.setProperty('--welcome-h', `${text.offsetHeight}px`);
        apply();
        const observer = new ResizeObserver(apply);
        observer.observe(text);
        return () => observer.disconnect();
    }, []);

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
        <header ref={headerRef} className="flex items-center gap-3">
            {/* Phone: as tall (and wide) as the text column beside it. Desktop: a fixed 32px icon. */}
            <span aria-hidden className="shrink-0 text-(--accent) size-8 max-[920px]:size-[var(--welcome-h,2rem)]">
                {/* Keyed by the greeting index: it remounts, so the shake replays on every greeting change. */}
                <HandWavingIcon key={index} className="wave-shake size-full" />
            </span>
            <div ref={textRef} className="flex min-w-0 flex-row gap-3 max-[920px]:flex-col max-[920px]:gap-1">
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
            </div>
        </header>
    );
}
