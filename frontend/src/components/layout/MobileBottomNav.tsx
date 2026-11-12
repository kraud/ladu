import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { DotsThreeIcon, HouseIcon, ShuffleIcon, TranslateIcon } from '@phosphor-icons/react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { LanguageSelector } from '@/components/layout/LanguageSelector';
import { ThemeSelector } from '@/components/layout/ThemeSelector';
import { NAV_ITEMS, useLanguageGate } from '@/components/layout/AppHeader';
import { featureFlags } from '@/app/feature-flags';
import { useRandomPractice } from '@/features/practice/useRandomPractice';
import { cn } from '@/lib/utils';

const ITEM_CLASS =
    'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground [&.active]:text-(--accent)';
const ACTIVE_CLASS = 'text-(--accent)';

/** One tile of the More drawer: icon over label, filling its half of the row. */
function Tile({
    icon: Icon,
    label,
    onClick,
    disabled,
}: {
    icon: typeof ShuffleIcon;
    label: string;
    onClick: () => void;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className="flex h-20 flex-col items-center justify-center gap-1.5 rounded-lg border border-border bg-card text-sm font-medium disabled:opacity-50"
        >
            <Icon size={26} aria-hidden="true" className="text-(--accent)" />
            {label}
        </button>
    );
}

/**
 * Phone navigation (below 920px): a bar fixed to the bottom of the window with Words, Tags, Home,
 * Practice and More. More opens a drawer from the bottom with the quick actions (random practice,
 * new word), a separator, then the theme and language pickers. The bar replaces the old menu
 * drawer. Its height is `--bottom-nav-h` (`globals.css`), a fixed 66px: 12px above the icons, 12px below, which the page and the fixed bottom bars
 * use to stay clear of it. On a desktop it is not rendered.
 */
export function MobileBottomNav() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const gate = useLanguageGate();
    const [moreOpen, setMoreOpen] = useState(false);
    const randomPractice = useRandomPractice();
    const visibleItems = NAV_ITEMS.filter((item) => !('flag' in item) || featureFlags[item.flag]);
    // Words and Tags sit left of Home, Practice right of it.
    const left = visibleItems.filter((item) => item.to !== '/practice');
    const right = visibleItems.filter((item) => item.to === '/practice');

    // Closes the drawer first when a running session needs confirming: two modal layers would fight for focus.
    const startRandomPractice = () =>
        randomPractice.run({ onBeforeConfirm: () => setMoreOpen(false), onStarted: () => setMoreOpen(false) });

    const renderItem = (item: (typeof NAV_ITEMS)[number]) => (
        <Link
            key={item.to}
            to={item.to}
            className={ITEM_CLASS}
            activeProps={{ className: 'active', 'aria-current': 'page' }}
            onClick={gate(item.requiresLanguages)}
        >
            <item.icon aria-hidden="true" size={24} />
            {t(item.labelKey)}
        </Link>
    );

    return (
        <>
            <nav
                aria-label={t('common:header.mainNav')}
                className="fixed inset-x-0 bottom-0 z-40 flex h-(--bottom-nav-h) items-stretch border-t border-border bg-[color-mix(in_srgb,var(--bg)_92%,transparent)] pt-3 pb-3 backdrop-blur-md"
            >
                {left.map(renderItem)}
                <Link
                    to="/"
                    activeOptions={{ exact: true }}
                    className={ITEM_CLASS}
                    activeProps={{ className: 'active', 'aria-current': 'page' }}
                >
                    <HouseIcon aria-hidden="true" size={24} />
                    {t('common:header.home')}
                </Link>
                {right.map(renderItem)}
                <button
                    type="button"
                    className={cn(ITEM_CLASS, moreOpen && ACTIVE_CLASS)}
                    aria-haspopup="dialog"
                    aria-expanded={moreOpen}
                    onClick={() => setMoreOpen(true)}
                >
                    <DotsThreeIcon aria-hidden="true" size={24} weight="bold" />
                    {t('common:header.more')}
                </button>
            </nav>

            <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
                <SheetContent side="bottom" className="gap-0 p-4">
                    <SheetHeader className="p-0 pb-4">
                        <SheetTitle>{t('common:header.more')}</SheetTitle>
                    </SheetHeader>
                    <div className="grid grid-cols-2 gap-3">
                        <Tile
                            icon={ShuffleIcon}
                            label={t('common:header.quick.randomPractice')}
                            disabled={randomPractice.isPending}
                            onClick={startRandomPractice}
                        />
                        <Tile
                            icon={TranslateIcon}
                            label={t('common:header.quick.newWord')}
                            onClick={() => {
                                setMoreOpen(false);
                                void navigate({ to: '/addWord/{-$partOfSpeech}' });
                            }}
                        />
                    </div>
                    <Separator className="my-4" />
                    <div className="flex items-center justify-between">
                        <ThemeSelector />
                        <LanguageSelector />
                    </div>
                </SheetContent>
            </Sheet>
            {randomPractice.dialog}
        </>
    );
}
