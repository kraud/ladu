import { useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useAuthStore } from '@/stores/authStore';

/**
 * 404 — built from `MOCKUPS/auth/404.html`: serif oversized numeral, hairline
 * divider, and one line that cycles through the four languages every 2.6s with
 * a 300ms cross-fade. Single CTA, target depending on session.
 *
 * TODO(slice-3): the cycling lines move into i18n (`common.notFound.lines`)
 * across all four locales. They stay a fixed multilingual array by design —
 * the joke is that it shows every language regardless of the UI language.
 */
const CYCLE_LINES = [
    'Nothing to see here…',
    'Hier gibt es nichts zu sehen…',
    'No hay nada que ver aquí…',
    'Siin pole midagi vaadata…',
];

const CYCLE_MS = 2600;
const FADE_MS = 300;

export function NotFoundPage() {
    const hasSession = useAuthStore((state) => state.user !== null);
    const [index, setIndex] = useState(0);
    const [fading, setFading] = useState(false);
    const swapTimer = useRef<ReturnType<typeof setTimeout>>();

    useEffect(() => {
        const cycle = setInterval(() => {
            setFading(true);
            swapTimer.current = setTimeout(() => {
                setIndex((current) => (current + 1) % CYCLE_LINES.length);
                setFading(false);
            }, FADE_MS);
        }, CYCLE_MS);

        return () => {
            clearInterval(cycle);
            if (swapTimer.current) clearTimeout(swapTimer.current);
        };
    }, []);

    return (
        <div className="page flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
            <span className="logo">
                <span className="logo-mark">L</span>Ladu
            </span>

            <span
                className="font-display leading-none tracking-tight"
                style={{ fontSize: 'clamp(64px, 12vw, 120px)' }}
            >
                404
            </span>

            <hr className="rule w-[min(280px,60vw)]" />

            <p
                aria-live="polite"
                className="min-h-[1.5em] text-[var(--muted)] transition-opacity duration-300"
                style={{ opacity: fading ? 0 : 1 }}
            >
                {CYCLE_LINES[index]}
            </p>

            <Link
                to={hasSession ? '/' : '/login'}
                className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/80"
            >
                {hasSession ? 'Go to dashboard' : 'Go to login'}
            </Link>
        </div>
    );
}
