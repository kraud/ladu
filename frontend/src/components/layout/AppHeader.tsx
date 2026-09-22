import { type MouseEvent, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { ListIcon } from '@phosphor-icons/react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { BrandLogo } from '@/components/common/BrandLogo';
import { LanguageSelector } from '@/components/layout/LanguageSelector';
import { UserMenu } from '@/components/layout/UserMenu';
import { featureFlags } from '@/app/feature-flags';
import { useAuthStore } from '@/stores/authStore';

/** Nav targets. `requiresLanguages` = the old "≥2 languages" gate on Add Word / Review. */
const NAV_ITEMS = [
    { to: '/addWord/{-$partOfSpeech}', labelKey: 'common:header.addWord', requiresLanguages: true },
    { to: '/practice', labelKey: 'common:header.practice', requiresLanguages: false },
    { to: '/review', labelKey: 'common:header.review', requiresLanguages: true },
] as const;

/**
 * Returns a click handler that blocks Add Word / Review when the user has fewer
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

    return (
        <nav className={className}>
            {NAV_ITEMS.map((item) => (
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
            <LanguageSelector />
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
            <div className="app-header-inner mx-auto max-w-5xl px-6">
                <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                    <SheetTrigger
                        className="icon-btn hidden max-[920px]:grid"
                        aria-label={t('common:header.menu')}
                    >
                        <ListIcon />
                    </SheetTrigger>
                    <SheetContent side="left" className="p-4">
                        <SheetHeader className="p-0">
                            <SheetTitle>
                                <BrandLogo height={24} title={t('common:appTitle')} />
                            </SheetTitle>
                        </SheetHeader>
                        <NavLinks
                            className="app-nav mt-2 flex-col [&_a]:h-10 [&_a]:w-full"
                            onNavigate={() => setSheetOpen(false)}
                        />
                    </SheetContent>
                </Sheet>

                <Link to="/" aria-label={t('common:appTitle')} className="flex items-center">
                    <BrandLogo height={26} />
                </Link>

                <NavLinks className="app-nav max-[920px]:hidden" />

                <div className="grow" />

                <HeaderRight />
            </div>
        </header>
    );
}
