import { type MouseEvent, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { ListIcon } from '@phosphor-icons/react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { BrandLogo } from '@/components/common/BrandLogo';
import { LanguageSelector } from '@/components/layout/LanguageSelector';
import { ThemeSelector } from '@/components/layout/ThemeSelector';
import { UserMenu } from '@/components/layout/UserMenu';
import { featureFlags } from '@/app/feature-flags';
import { useAuthStore } from '@/stores/authStore';

/** Nav targets. `requiresLanguages` = the old "≥2 languages" gate on Words (Add word hangs off it). */
const NAV_ITEMS = [
    { to: '/words', labelKey: 'common:header.words', requiresLanguages: true },
    // Phase 4 (D1) — feature-flagged, not language-gated: tags are useful
    // regardless of how many languages an account has configured.
    { to: '/tags', labelKey: 'common:header.tags', requiresLanguages: false, flag: 'tags' },
    { to: '/practice', labelKey: 'common:header.practice', requiresLanguages: false },
] as const;

/**
 * Returns a click handler that blocks Words when the user has fewer
 * than two configured languages, raising a toast with a "Go to Account" action
 * (`pages-auth-shell.md:205` — business rule kept, Redux string-compare dropped).
 */
function useLanguageGate() {
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

function NavLinks({ onNavigate, className }: { onNavigate?: () => void; className?: string }) {
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
                    onClick={(event) => {
                        if (gate(item.requiresLanguages)(event)) onNavigate?.();
                    }}
                >
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
            {/* Below 920px these live at the bottom of the menu drawer; they stay mounted (the language one syncs i18next). */}
            <div className="flex items-center gap-2 max-[920px]:hidden">
                <LanguageSelector />
                <ThemeSelector />
            </div>
            {featureFlags.notifications && (
                <button type="button" className="icon-btn" aria-label="Notifications" />
            )}
            <UserMenu />
        </div>
    );
}

/**
 * The sticky app header for every authenticated route. Below 920px the nav
 * collapses into a hamburger `Sheet` (the `.searchbox` is already hidden by the
 * `@media (max-width: 920px)` block in `globals.css`).
 */
export function AppHeader() {
    const { t } = useTranslation();
    const [sheetOpen, setSheetOpen] = useState(false);

    return (
        <header className="app-header">
            <div className="app-header-inner mx-auto max-w-5xl px-6 max-[920px]:pl-2">
                <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                    <SheetTrigger
                        className="icon-btn hidden max-[920px]:grid max-[920px]:size-10"
                        aria-label={t('common:header.menu')}
                    >
                        <ListIcon size={26} />
                    </SheetTrigger>
                    <SheetContent side="left" className="gap-0 p-4">
                        <SheetHeader className="p-0 pb-8">
                            <SheetTitle>
                                <BrandLogo height={36} title={t('common:appTitle')} />
                            </SheetTitle>
                        </SheetHeader>
                        <NavLinks
                            className="app-nav flex-col gap-0 border-t border-border [&_a]:h-12 [&_a]:w-full [&_a]:rounded-none [&_a]:border-b [&_a]:border-border [&_a]:px-2 [&_a]:text-lg"
                            onNavigate={() => setSheetOpen(false)}
                        />
                        <div className="mt-auto flex items-center justify-between border-t border-border pt-4">
                            <LanguageSelector />
                            <ThemeSelector />
                        </div>
                    </SheetContent>
                </Sheet>

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
