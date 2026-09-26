/**
 * Shell for the word editor: a collapsible left sidebar (`sidebar` — just the
 * clue and tags), the translation grid (`children`), and a sticky bottom bar
 * (`WordEditorBar`) with the actions and the reason Save is disabled. Used by
 * `WordForm` (create + edit) and `WordPage`'s read-only view, so the page
 * never reshuffles when Edit is toggled.
 *
 * Desktop: the sidebar narrows to an icon rail (`SidebarFields` renders the
 * Clue / Tags buttons there) rather than disappearing, so a verb form gets its
 * width back. Collapse state lives in `uiStore.wordSidebarCollapsed`, shared
 * across all three word-editor pages, session-scoped (not persisted) like
 * `reviewSidebarCollapsed`.
 *
 * Below 920px (the app's one existing breakpoint — `AppHeader.tsx`,
 * `globals.css`'s `@media (max-width: 920px)` block) the sidebar becomes an
 * off-canvas drawer, opened by a trigger on its own row above the grid, and
 * closed by the drawer's own header button, the backdrop, or Escape. The
 * secondary `actions` move into that drawer (above the clue), and the bar
 * keeps only the primary button and the reason.
 *
 * `useIsMobile` decides where the secondary actions render, so they exist
 * once — not duplicated in the bar and the drawer with one copy hidden by CSS
 * — and every button keeps exactly one accessible name across breakpoints.
 */
import { useEffect, useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CaretLeftIcon, CaretRightIcon, SlidersHorizontalIcon, XIcon } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { WordEditorBar, type EditorAction, type EditorPrimary } from './WordEditorBar';
import { useWordSidebar } from './useWordSidebar';

export interface WordEditorLayoutProps {
    sidebar: ReactNode;
    /** Secondary actions: the bar's left side on desktop, the drawer's top on a phone. */
    actions?: EditorAction[];
    primary?: EditorPrimary;
    /** Why `primary` is disabled — shown in the bar; leave out when it is enabled. */
    statusText?: string;
    /** Create/edit: show the "* required" note in the bar (desktop). */
    showRequiredHint?: boolean;
    children: ReactNode;
}

export function WordEditorLayout({
    sidebar,
    actions = [],
    primary,
    statusText,
    showRequiredHint,
    children,
}: WordEditorLayoutProps) {
    const { t } = useTranslation();
    const { collapsed, setCollapsed, isMobile } = useWordSidebar();
    const [mobileOpen, setMobileOpen] = useState(false);
    const panelId = useId();

    function closeMobile() {
        setMobileOpen(false);
    }

    // A plain `onKeyDown` on the `<aside>` only sees Escape when focus is
    // already inside it; the trigger button itself (still focused right
    // after opening) is a sibling, not a descendant, so this listens on the
    // document instead, and only while the drawer is actually open.
    useEffect(() => {
        if (!mobileOpen) return;
        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') setMobileOpen(false);
        }
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [mobileOpen]);

    return (
        <div className="flex flex-col">
            {/* Below 920px the drawer trigger gets its own row above the content —
                inline it would eat ~48px of the card grid's width. `items-stretch`
                (the column default) is what lets the content div take the full row. */}
            <div className="flex items-start gap-4 max-[920px]:flex-col max-[920px]:items-stretch lg:gap-6">
                <button
                    type="button"
                    className="icon-btn hidden max-[920px]:grid"
                    aria-label={t('wordRelated:wordForm.sidebar.openMenu')}
                    aria-expanded={mobileOpen}
                    aria-controls={panelId}
                    onClick={() => setMobileOpen(true)}
                >
                    <SlidersHorizontalIcon size={18} />
                </button>

                {mobileOpen && (
                    // Mouse-only dismiss, mirroring `SheetOverlay`'s own backdrop
                    // (a plain, unlabeled scrim) — Escape and the aside's own
                    // labeled close button are the keyboard/screen-reader paths,
                    // so this one is deliberately `aria-hidden` + untabbable
                    // rather than a second control sharing "Close menu"'s name.
                    <button
                        type="button"
                        tabIndex={-1}
                        aria-hidden="true"
                        className="fixed inset-0 z-40 hidden bg-black/20 max-[920px]:block"
                        onClick={closeMobile}
                    />
                )}

                <aside
                    id={panelId}
                    className={cn(
                        'card sticky top-[68px] flex max-h-[calc(100dvh-160px)] flex-col gap-3 overflow-y-auto p-3 transition-[width] duration-150',
                        collapsed ? 'w-14' : 'w-64',
                        'max-[920px]:fixed max-[920px]:inset-y-0 max-[920px]:left-0 max-[920px]:top-0 max-[920px]:z-50',
                        'max-[920px]:!w-72 max-[920px]:max-h-none max-[920px]:rounded-none max-[920px]:transition-transform',
                        mobileOpen ? 'max-[920px]:translate-x-0' : 'max-[920px]:-translate-x-full',
                    )}
                >
                    <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
                        <button
                            type="button"
                            className="icon-btn max-[920px]:hidden"
                            aria-label={t(
                                collapsed ? 'wordRelated:wordForm.sidebar.expand' : 'wordRelated:wordForm.sidebar.collapse',
                            )}
                            title={t(
                                collapsed ? 'wordRelated:wordForm.sidebar.expand' : 'wordRelated:wordForm.sidebar.collapse',
                            )}
                            aria-expanded={!collapsed}
                            onClick={() => setCollapsed(!collapsed)}
                        >
                            {collapsed ? <CaretRightIcon size={16} /> : <CaretLeftIcon size={16} />}
                        </button>
                        <button
                            type="button"
                            className="icon-btn hidden max-[920px]:grid"
                            aria-label={t('wordRelated:wordForm.sidebar.closeMenu')}
                            onClick={closeMobile}
                        >
                            <XIcon size={16} />
                        </button>
                    </div>

                    {isMobile && actions.length > 0 && (
                        <div className="flex flex-col gap-2 border-b border-border pb-3">
                            {actions.map((action) => (
                                <Button
                                    key={action.key}
                                    type="button"
                                    variant={action.variant ?? 'outline'}
                                    className="w-full justify-start"
                                    onClick={() => {
                                        closeMobile();
                                        action.onClick();
                                    }}
                                >
                                    {action.icon}
                                    {action.label}
                                </Button>
                            ))}
                        </div>
                    )}

                    <div className="flex min-h-0 flex-1 flex-col">{sidebar}</div>
                </aside>

                <div className="min-w-0 flex-1">{children}</div>
            </div>
            <WordEditorBar
                actions={actions}
                primary={primary}
                statusText={statusText}
                showRequiredHint={showRequiredHint}
                isMobile={isMobile}
            />
        </div>
    );
}
