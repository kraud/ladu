/**
 * Two-column shell for the word editor: a collapsible left action sidebar
 * (`sidebar` — actions, clue, the tags placeholder) next to the translation
 * grid (`children`). Used by `WordForm` (create + edit) and `WordPage`'s
 * read-only view, so the page never reshuffles when Edit is toggled.
 *
 * Desktop: the sidebar narrows to an icon rail rather than disappearing —
 * `SidebarAction` keeps every control's accessible name identical either
 * way (an `sr-only` label, not an `aria-label` swap) — so Save/Delete/etc.
 * stay one click away while a verb form gets its width back. Collapse state
 * lives in `uiStore.wordSidebarCollapsed`, shared across all three word-
 * editor pages, session-scoped (not persisted) like `reviewSidebarCollapsed`.
 *
 * Below 920px (the app's one existing breakpoint — `AppHeader.tsx`,
 * `globals.css`'s `@media (max-width: 920px)` block) the sidebar becomes an
 * off-canvas drawer instead, opened by a floating trigger and closed by its
 * own header button, the backdrop, or Escape.
 *
 * Rendered once — not duplicated inline+`Sheet` the way `AppHeader` renders
 * `NavLinks` twice — so every action button keeps exactly one accessible
 * name across breakpoints instead of two nodes sharing a name.
 */
import { useEffect, useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CaretLeftIcon, CaretRightIcon, SlidersHorizontalIcon, XIcon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/stores/uiStore';

export function WordEditorLayout({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
    const { t } = useTranslation();
    const collapsed = useUiStore((s) => s.wordSidebarCollapsed);
    const setCollapsed = useUiStore((s) => s.setWordSidebarCollapsed);
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
        <div className="flex items-start gap-4 lg:gap-6">
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
                    'card sticky top-[68px] flex max-h-[calc(100dvh-84px)] flex-col gap-3 overflow-y-auto p-3 transition-[width] duration-150',
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

                <div className="flex min-h-0 flex-1 flex-col">{sidebar}</div>
            </aside>

            <div className="min-w-0 flex-1">{children}</div>
        </div>
    );
}
