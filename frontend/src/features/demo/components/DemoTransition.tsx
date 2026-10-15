import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BrandLogo } from '@/components/common/BrandLogo';
import { useUiStore } from '@/stores/uiStore';
import { demoTransitionMinMs, demoTransitionTiming, prefersReducedMotion } from '../transition';

/**
 * The screen between "Start the demo" and the dashboard (demo-access.md D18): the bubble logo, a
 * loading bar, and one funny line at a time, in the UI language. The bar fills to 90% in the
 * screen's shortest time and stays there while a slow server answers; it fills up when the screen
 * leaves. `useStartDemo` opens it and asks it to leave; it
 * fades out over the dashboard, then hides. Mounted once, beside the router (`app/Providers.tsx`),
 * so the route change under it does not remove it. With reduced motion it has no fade.
 */
export function DemoTransition() {
    const phase = useUiStore((s) => s.demoTransition);
    const lines = useUiStore((s) => s.demoTransitionLines);
    const setPhase = useUiStore((s) => s.setDemoTransition);
    const { t } = useTranslation('demo');
    const [index, setIndex] = useState(0);

    // A new line every `lineMs`; the last one stays until the screen leaves.
    useEffect(() => {
        if (phase !== 'showing') return;
        setIndex(0);
        const id = window.setInterval(
            () => setIndex((i) => Math.min(i + 1, Math.max(lines.length - 1, 0))),
            demoTransitionTiming.lineMs,
        );
        return () => window.clearInterval(id);
    }, [phase, lines]);

    // The fade out (CSS), then hidden. No fade with reduced motion.
    useEffect(() => {
        if (phase !== 'leaving') return;
        const id = window.setTimeout(() => setPhase('idle'), prefersReducedMotion() ? 0 : demoTransitionTiming.fadeMs);
        return () => window.clearTimeout(id);
    }, [phase, setPhase]);

    if (phase === 'idle') return null;

    const line = lines[index];
    return (
        <div
            className="demo-transition"
            data-phase={phase}
            style={{ transitionDuration: `${demoTransitionTiming.fadeMs}ms` }}
            role="status"
            aria-live="polite"
            aria-label={t('transition.label')}
        >
            <BrandLogo variant="outline" height={112} />
            {/* No value: the bar shows time passing, not a measured amount of work. */}
            <div className="demo-transition-bar" role="progressbar" aria-label={t('transition.progress')}>
                <span style={{ animationDuration: `${demoTransitionMinMs()}ms` }} />
            </div>
            {line && (
                <p key={line} className="demo-transition-line">
                    {t(`transition.lines.${line}`)}
                </p>
            )}
        </div>
    );
}
