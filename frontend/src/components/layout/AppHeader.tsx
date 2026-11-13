import type { MouseEvent } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import {
    BrainIcon,
    TagIcon,
    TranslateIcon,
} from '@phosphor-icons/react';
import { BrandLogo } from '@/components/common/BrandLogo';
import { LanguageSelector } from '@/components/layout/LanguageSelector';
import { ThemeSelector } from '@/components/layout/ThemeSelector';
import { UserMenu } from '@/components/layout/UserMenu';
import { featureFlags } from '@/app/feature-flags';
import { useAuthStore } from '@/stores/authStore';
import { DemoBadge } from '@/features/demo/components/DemoBadge';

/** Nav targets. `requiresLanguages` = the old "≥2 languages" gate on Words (Add word hangs off it). */
export const NAV_ITEMS = [
    { to: '/words', labelKey: 'common:header.words', requiresLanguages: true, icon: TranslateIcon },
    // Phase 4 (D1) — feature-flagged, not language-gated: tags are useful
    // regardless of how many languages an account has configured.
    { to: '/tags', labelKey: 'common:header.tags', requiresLanguages: false, flag: 'tags', icon: TagIcon },
    { to: '/practice', labelKey: 'common:header.practice', requiresLanguages: false, icon: BrainIcon },
] as const;

/**
 * Returns a click handler that blocks Words when the user has fewer
 * than two configured languages, raising a toast with a "Go to Account" action
 * (`pages-auth-shell (removed snapshot):205` — business rule kept, Redux string-compare dropped).
 */
export function useLanguageGate() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const languageCount = useAuthStore((s) => s.user?.languages.length ?? 0);

    return function guard(requiresLanguages: boolean) {
        return (event: MouseEvent) => {
            if (!requiresLanguages || languageCount >= 2) return true;
            event.preventDefault();
            toast.info(
                <div className="flex flex-col items-start gap-1">
                    <span>{t('common:userData.errors.notEnoughLanguages')}</span>
                    <button
                        type="button"
                        className="font-semibold underline underline-offset-2"
                        onClick={() => void navigate({ to: '/user' })}
                    >
                        {t('common:header.goToAccount')}
                    </button>
                </div>,
            );
            return false;
        };
    };
}

function NavLinks({ className }: { className?: string }) {
    const { t } = useTranslation();
    const gate = useLanguageGate();
    const visibleItems = NAV_ITEMS.filter((item) => !('flag' in item) || featureFlags[item.flag]);

    return (
        <nav className={className}>
            {visibleItems.map((item) => (
                <Link
                    key={item.to}
                    to={item.to}
                    activeProps={{ className: 'active' }}
                    onClick={gate(item.requiresLanguages)}
                >
                    <item.icon aria-hidden="true" className="size-[18px] shrink-0 text-(--accent) max-[920px]:size-[22px]" />
                    {t(item.labelKey)}
                </Link>
            ))}
        </nav>
    );
}

function HeaderRight() {
    return (
        <div className="flex items-center gap-2">
            {featureFlags.globalSearch && (
                <div className="searchbox" aria-hidden>
                    <input placeholder="…" disabled />
                </div>
            )}
            {/* Below 920px these live in the bottom bar's More drawer; they stay mounted (the language one syncs i18next). */}
            <div className="flex items-center gap-2 max-[920px]:hidden">
                <LanguageSelector />
                <ThemeSelector />
            </div>
            {featureFlags.notifications && (
                <button type="button" className="icon-btn" aria-label="Notifications" />
            )}
            {/* Demo access (demo-access.md D6): only for a demo session, on every screen size. */}
            <DemoBadge />
            <UserMenu />
        </div>
    );
}

/**
 * The sticky app header for every authenticated route. Below 920px the nav
 * moves to the fixed bottom bar (`MobileBottomNav`), so the header keeps only the logo and the
 * right-hand controls (the `.searchbox` is hidden by the `@media (max-width: 920px)` block in `globals.css`).
 */
export function AppHeader() {
    const { t } = useTranslation();

    return (
        <header className="app-header">
            <div className="app-header-inner mx-auto max-w-5xl px-6 max-[920px]:px-3">
                <Link to="/" aria-label={t('common:appTitle')} className="flex items-center">
                    <BrandLogo height={26} className="max-[920px]:h-9 max-[920px]:w-auto" />
                </Link>

                <NavLinks className="app-nav max-[920px]:hidden" />

                <div className="grow" />

                <HeaderRight />
            </div>
        </header>
    );
}
