import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { AuthLayout } from '@/features/auth/components/AuthLayout';

/**
 * 404 — built from `MOCKUPS/auth/404.html`: the shared brand shell, serif
 * oversized numeral, hairline divider, and one line that cycles through the
 * four languages every 2.6s with a 300ms cross-fade. Single CTA, target
 * depending on session.
 *
 * The cycling lines live in `common:notFound.lines` (identical in every
 * locale) but stay a fixed multilingual array by design — the joke is that it
 * shows every language regardless of the UI language.
 *
 * Renders outside the `_public` layout and deliberately has no interface-
 * language selector — a standing Phase 1 decision, unchanged here.
 */
const FALLBACK_LINES = [
    'Nothing to see here…',
    'Hier gibt es nichts zu sehen…',
    'No hay nada que ver aquí…',
    'Siin pole midagi vaadata…',
];

const CYCLE_MS = 2600;
const FADE_MS = 300;

export function NotFoundPage() {
    const { t } = useTranslation();
    const hasSession = useAuthStore((state) => state.user !== null);

    const lines = useMemo(() => {
        const fromI18n = t('common:notFound.lines', { returnObjects: true });
        return Array.isArray(fromI18n) && fromI18n.length > 0
            ? (fromI18n as string[])
            : FALLBACK_LINES;
    }, [t]);
    const [index, setIndex] = useState(0);
    const [fading, setFading] = useState(false);
    const swapTimer = useRef<ReturnType<typeof setTimeout>>();

    useEffect(() => {
        const cycle = setInterval(() => {
            setFading(true);
            swapTimer.current = setTimeout(() => {
                setIndex((current) => (current + 1) % lines.length);
                setFading(false);
            }, FADE_MS);
        }, CYCLE_MS);

        return () => {
            clearInterval(cycle);
            if (swapTimer.current) clearTimeout(swapTimer.current);
        };
    }, [lines.length]);

    return (
        <AuthLayout blurb={t('loginRegister:brand.subNotFound')} showLanguageSelector={false}>
            <div className="text-center">
                <span
                    className="font-display leading-none tracking-tight"
                    style={{ fontSize: 'clamp(56px, 8vw, 96px)' }}
                >
                    404
                </span>

                <hr className="rule mx-auto my-4 w-[min(220px,50vw)]" />

                <p
                    aria-live="polite"
                    className="min-h-[1.5em] text-[var(--muted)] transition-opacity duration-300"
                    style={{ opacity: fading ? 0 : 1 }}
                >
                    {lines[index]}
                </p>

                <Link
                    to={hasSession ? '/' : '/login'}
                    className="mt-5 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/80"
                >
                    {hasSession
                        ? t('common:notFound.goToDashboard')
                        : t('common:notFound.goToLogin')}
                </Link>
            </div>
        </AuthLayout>
    );
}
