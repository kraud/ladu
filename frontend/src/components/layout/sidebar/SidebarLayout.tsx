/**
 * The app's one side-panel layout, used by Review, Add word / Word page and
 * Practice so the three behave the same. The layout owns the frame; a page
 * only supplies `sections` (an icon, a label, a counter and the content).
 *
 * Desktop: a panel docked to the left edge of the window, from under the
 * `AppHeader` to the bottom (or to the `footer` bar). The collapse button is
 * always its first control. Collapsed, it narrows to an icon rail with one
 * button per section: `filledIcon` replaces `icon` when the section holds a
 * value (`filled`), and `count` shows as a small badge — so a hidden value is
 * still visible. A click on a rail button expands the panel, scrolls to that
 * section, and moves focus to `focusSelector` if the section has one.
 *
 * Below 920px (`useIsMobile`) the panel is not on the page at all. A
 * `SidebarTrigger` placed by the page opens it as a slide-in menu (`Sheet`,
 * from the left: focus trap, Escape and backdrop come with it). The panel
 * content renders once — in the aside or in the menu, never both — so every
 * control keeps one accessible name.
 *
 * `footer` is a bar fixed to the bottom of the window, over the full width
 * (the word editor's save bar). The layout measures it and ends the panel
 * above it, and adds a spacer of the same height so the last content is never
 * hidden behind it.
 *
 * Collapse state lives in `uiStore.sidebarCollapsed[id]`: session-scoped, not
 * persisted. Two widths: `narrow` (16rem) and `wide` (24rem); rail is 3.5rem.
 */
import {
    createContext,
    useCallback,
    useContext,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { CaretLeftIcon, CaretRightIcon, XIcon } from '@phosphor-icons/react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/lib/useMediaQuery';
import { useUiStore, type SidebarId } from '@/stores/uiStore';

export interface SidebarSection {
    id: string;
    /** Section heading, and the rail button's accessible name. */
    label: string;
    icon: ReactNode;
    /** Shown on the rail instead of `icon` when `filled`. */
    filledIcon?: ReactNode;
    filled?: boolean;
    /** Rail badge, shown when greater than 0 (for example the number of active filters). */
    count?: number;
    /** CSS selector inside the section: focused after a rail click expands the panel. */
    focusSelector?: string;
    content: ReactNode;
}

export interface SidebarLayoutProps {
    id: SidebarId;
    width?: 'narrow' | 'wide';
    /** Accessible name of the panel and the title of the slide-in menu. */
    label: string;
    sections: SidebarSection[];
    /** Phone only: shown above the sections in the slide-in menu. */
    drawerTop?: ReactNode;
    /** Bar fixed to the bottom of the window, over the full width. */
    footer?: ReactNode;
    /**
     * Lay the footer out like the page: it starts after the panel and uses the same centered column, so
     * its right edge is the right edge of the content (Practice's Start / Save). Without it the footer
     * is the plain full-width strip of the word editor.
     */
    footerAligned?: boolean;
    /** Page title block: first in the content column, above `children`. */
    header?: ReactNode;
    /** Content column max width: `max-w-7xl` instead of `max-w-5xl`. */
    wide?: boolean;
    children: ReactNode;
}

interface SidebarContextValue {
    isMobile: boolean;
    /** The page gave the layout at least one section. */
    hasPanel: boolean;
    open: boolean;
    setOpen: (open: boolean) => void;
    panelId: string;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar(): SidebarContextValue {
    const context = useContext(SidebarContext);
    if (!context) throw new Error('useSidebar must be used inside <SidebarLayout>');
    return context;
}

/** The button that opens the slide-in menu. Renders on a phone only, and only when the page has a panel. `label` is its accessible name; `children` is what shows. */
export function SidebarTrigger({
    label,
    className,
    children,
}: {
    label: string;
    className?: string;
    children?: ReactNode;
}) {
    const { isMobile, hasPanel, open, setOpen, panelId } = useSidebar();
    if (!isMobile || !hasPanel) return null;
    return (
        <button
            type="button"
            className={className ?? 'icon-btn'}
            aria-label={label}
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen(true)}
        >
            {children}
        </button>
    );
}

const WIDTHS = { narrow: { px: '16rem', cls: 'w-64' }, wide: { px: '24rem', cls: 'w-96' } } as const;

export function SidebarLayout({
    id,
    width = 'narrow',
    label,
    sections,
    drawerTop,
    footer,
    footerAligned,
    header,
    wide,
    children,
}: SidebarLayoutProps) {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const preference = useUiStore((s) => s.sidebarCollapsed[id]);
    const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed);
    // The stored preference only means "icon rail" on desktop: the phone menu is always full.
    const collapsed = preference && !isMobile;
    const [open, setOpen] = useState(false);
    const panelId = `sidebar-${id}`;
    const panelRef = useRef<HTMLElement>(null);
    const pendingFocus = useRef<{ sectionId: string; selector?: string } | null>(null);

    // The footer's height, measured: the phone layout grows when its reason text wraps.
    const footerRef = useRef<HTMLDivElement>(null);
    const [footerHeight, setFooterHeight] = useState(0);
    const hasFooter = footer !== undefined && footer !== null;
    useLayoutEffect(() => {
        const bar = footerRef.current;
        if (!bar) {
            setFooterHeight(0);
            return;
        }
        setFooterHeight(bar.offsetHeight);
        // Missing in jsdom: the height then stays 0, which is harmless there.
        if (typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(() => setFooterHeight(bar.offsetHeight));
        observer.observe(bar);
        return () => observer.disconnect();
    }, [hasFooter]);

    const setCollapsed = useCallback(
        (next: boolean) => setSidebarCollapsed(id, next),
        [id, setSidebarCollapsed],
    );

    // A rail click expands the panel; the section only exists after that render.
    useLayoutEffect(() => {
        if (collapsed || !pendingFocus.current) return;
        const { sectionId, selector } = pendingFocus.current;
        pendingFocus.current = null;
        const section = panelRef.current?.querySelector<HTMLElement>(`[data-section="${sectionId}"]`);
        section?.scrollIntoView?.({ block: 'nearest' });
        if (selector) section?.querySelector<HTMLElement>(selector)?.focus();
    }, [collapsed]);

    // A page can have a state with nothing to put in the panel: then there is no panel at all.
    const hasPanel = sections.length > 0;
    const context = useMemo<SidebarContextValue>(
        () => ({ isMobile, hasPanel, open, setOpen, panelId }),
        [isMobile, hasPanel, open, panelId],
    );

    // The panel's title (`label`) sits in the header row next to the collapse button on desktop, and is the
    // title of the phone menu. A lone section that has the same name would only repeat it: on desktop it is
    // left out, on the phone it stays for screen readers only.
    const loneSection = sections.length === 1 ? sections[0] : undefined;
    const repeatsTitle = loneSection !== undefined && loneSection.label === label;
    const titleInHeader = !isMobile && repeatsTitle;
    const hideHeading = isMobile && repeatsTitle;
    const body = (
        <div className="flex flex-col gap-4" style={isMobile ? undefined : { width: `calc(${WIDTHS[width].px} - 2rem - 1px)` }}>
            {sections.map((section) => (
                <section key={section.id} data-section={section.id} className="flex flex-col gap-2">
                    {!titleInHeader && (
                        <h2 className={cn('label flex items-center gap-1.5', hideHeading && 'sr-only')}>
                            <span aria-hidden="true" className="[&_svg]:size-3.5">
                                {section.icon}
                            </span>
                            {section.label}
                        </h2>
                    )}
                    {section.content}
                </section>
            ))}
        </div>
    );

    return (
        <SidebarContext.Provider value={context}>
            <div
                className="flex items-start"
                style={{ '--sidebar-footer-h': `${footerHeight}px` } as CSSProperties}
            >
                {!isMobile && hasPanel && (
                    <aside
                        id={panelId}
                        ref={panelRef}
                        aria-label={label}
                        data-collapsed={collapsed || undefined}
                        className={cn(
                            'sticky top-(--app-header-h) flex h-[calc(100dvh-var(--app-header-h)-var(--sidebar-footer-h,0px))] shrink-0 flex-col gap-3 overflow-y-auto overflow-x-hidden border-r border-border bg-card p-3 transition-[width] duration-150',
                            collapsed ? 'w-14' : WIDTHS[width].cls,
                        )}
                    >
                        <div className="flex items-center gap-2 border-b border-border pb-2">
                            <button
                                type="button"
                                className="icon-btn"
                                aria-label={t(collapsed ? 'common:sidebar.expand' : 'common:sidebar.collapse')}
                                title={t(collapsed ? 'common:sidebar.expand' : 'common:sidebar.collapse')}
                                aria-expanded={!collapsed}
                                onClick={() => setCollapsed(!collapsed)}
                            >
                                {collapsed ? <CaretRightIcon size={16} /> : <CaretLeftIcon size={16} />}
                            </button>
                            {!collapsed && (
                                <h2 className="label flex min-w-0 items-center gap-1.5">
                                    {loneSection && repeatsTitle && (
                                        <span aria-hidden="true" className="[&_svg]:size-3.5">
                                            {loneSection.icon}
                                        </span>
                                    )}
                                    <span className="truncate">{label}</span>
                                </h2>
                            )}
                        </div>
                        {collapsed ? (
                            <div className="flex flex-col items-center gap-1">
                                {sections.map((section) => {
                                    const count = section.count ?? 0;
                                    return (
                                        <button
                                            key={section.id}
                                            type="button"
                                            className="icon-btn relative"
                                            aria-label={section.label}
                                            title={section.label}
                                            data-filled={section.filled || count > 0 || undefined}
                                            onClick={() => {
                                                pendingFocus.current = {
                                                    sectionId: section.id,
                                                    selector: section.focusSelector,
                                                };
                                                setCollapsed(false);
                                            }}
                                        >
                                            {section.filled && section.filledIcon ? section.filledIcon : section.icon}
                                            {count > 0 && (
                                                <span
                                                    data-testid={`${section.id}-count`}
                                                    className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-(--accent) px-1 text-[10px] font-semibold leading-4 text-(--accent-ink)"
                                                >
                                                    {count}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            body
                        )}
                    </aside>
                )}

                <div className="min-w-0 flex-1">
                    <div className={cn('mx-auto px-6 py-8', wide ? 'max-w-7xl' : 'max-w-5xl')}>
                        {header ? (
                            <div className="flex flex-col gap-4">
                                {header}
                                {children}
                            </div>
                        ) : (
                            children
                        )}
                    </div>
                </div>
            </div>

            {isMobile && hasPanel && (
                <Sheet open={open} onOpenChange={setOpen}>
                    <SheetContent
                        side="left"
                        showCloseButton={false}
                        id={panelId}
                        className="w-72 max-w-[85vw] overflow-y-auto p-4 sm:max-w-none"
                    >
                        <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
                            <SheetTitle>{label}</SheetTitle>
                            <button
                                type="button"
                                className="icon-btn"
                                aria-label={t('common:sidebar.close')}
                                onClick={() => setOpen(false)}
                            >
                                <XIcon size={16} />
                            </button>
                        </div>
                        <SheetDescription className="sr-only">{label}</SheetDescription>
                        {drawerTop}
                        {body}
                    </SheetContent>
                </Sheet>
            )}

            {hasFooter && (
                <>
                    <div aria-hidden="true" style={{ height: footerHeight }} />
                    <div
                        ref={footerRef}
                        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] backdrop-blur-md"
                    >
                        {footerAligned ? (
                            <div className="flex">
                                {/* Same width as the panel (it animates when collapsed), so the column below lines up with the page. */}
                                {!isMobile && hasPanel && (
                                    <div
                                        aria-hidden="true"
                                        className={cn(
                                            'shrink-0 transition-[width] duration-150',
                                            collapsed ? 'w-14' : WIDTHS[width].cls,
                                        )}
                                    />
                                )}
                                <div className="min-w-0 flex-1">
                                    <div className={cn('mx-auto px-6', wide ? 'max-w-7xl' : 'max-w-5xl')}>{footer}</div>
                                </div>
                            </div>
                        ) : (
                            footer
                        )}
                    </div>
                </>
            )}
        </SidebarContext.Provider>
    );
}
