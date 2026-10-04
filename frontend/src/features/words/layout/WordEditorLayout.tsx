/**
 * Shell for the word editor: `SidebarLayout` (the shared docked sidebar — here
 * Clue, Tags and Linked words, as `sections`), the translation grid
 * (`children`), and a bottom bar (`WordEditorBar`) with the actions and the
 * reason Save is disabled, passed as the layout's `footer`. Used by
 * `WordForm` (create + edit) and `WordPage`'s read-only view, so the page
 * never reshuffles when Edit is toggled.
 *
 * Desktop: the sidebar narrows to an icon rail rather than disappearing, so a
 * verb form gets its width back. Collapse state lives in
 * `uiStore.sidebarCollapsed.word`, shared across all three word-editor pages,
 * session-scoped (not persisted).
 *
 * Below 920px (the app's one existing breakpoint — `AppHeader.tsx`,
 * `globals.css`'s `@media (max-width: 920px)` block) the sidebar becomes a
 * slide-in menu, opened by a trigger on its own row above the grid. The
 * secondary `actions` move into that menu (above the sections), and the bar
 * keeps only the primary button and the reason.
 *
 * `useIsMobile` decides where the secondary actions render, so they exist
 * once — not duplicated in the bar and the menu with one copy hidden by CSS —
 * and every button keeps exactly one accessible name across breakpoints.
 */
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { SlidersHorizontalIcon } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { SidebarLayout, SidebarTrigger, useSidebar, type SidebarSection } from '@/components/layout/sidebar/SidebarLayout';
import { useIsMobile } from '@/lib/useMediaQuery';
import { WordEditorBar, type EditorAction, type EditorPrimary } from './WordEditorBar';

export interface WordEditorLayoutProps {
    sections: SidebarSection[];
    /** The page title block, first in the content column. */
    header?: ReactNode;
    /** Secondary actions: the bar's left side on desktop, the menu's top on a phone. */
    actions?: EditorAction[];
    /**
     * Edit mode's Cancel: desktop renders it in the bar, immediately left of
     * `primary` (not grouped with `actions`); a phone still gets it in the
     * menu, alongside `actions` — one accessible "Cancel" either way.
     */
    cancelAction?: EditorAction;
    primary?: EditorPrimary;
    /** Why `primary` is disabled — shown in the bar; leave out when it is enabled. */
    statusText?: string;
    /** Create/edit: show the "* required" note in the bar (desktop). */
    showRequiredHint?: boolean;
    children: ReactNode;
}

/** Phone only: the secondary actions at the top of the slide-in menu. */
function MenuActions({ actions }: { actions: EditorAction[] }) {
    const { setOpen } = useSidebar();
    return (
        <div className="flex flex-col gap-2 border-b border-border pb-3">
            {actions.map((action) => (
                <Button
                    key={action.key}
                    type="button"
                    variant={action.variant ?? 'outline'}
                    className="w-full justify-start"
                    onClick={() => {
                        setOpen(false);
                        action.onClick();
                    }}
                >
                    {action.icon}
                    {action.label}
                </Button>
            ))}
        </div>
    );
}

export function WordEditorLayout({
    sections,
    header,
    actions = [],
    cancelAction,
    primary,
    statusText,
    showRequiredHint,
    children,
}: WordEditorLayoutProps) {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const menuActions = cancelAction ? [...actions, cancelAction] : actions;

    return (
        <SidebarLayout
            id="word"
            wide
            label={t('wordRelated:wordForm.sidebar.menuTitle')}
            sections={sections}
            header={header}
            // `MenuActions` reads the open state from the layout's context, so it must render inside it.
            drawerTop={menuActions.length > 0 ? <MenuActions actions={menuActions} /> : undefined}
            footer={
                <WordEditorBar
                    actions={actions}
                    cancelAction={cancelAction}
                    primary={primary}
                    statusText={statusText}
                    showRequiredHint={showRequiredHint}
                    isMobile={isMobile}
                />
            }
        >
            {/* Below 920px the menu trigger gets its own row above the grid: inline it would eat ~48px of the card grid's width. */}
            <div className="flex flex-col gap-4">
                {isMobile && (
                    <div className="flex">
                        <SidebarTrigger label={t('wordRelated:wordForm.sidebar.openMenu')}>
                            <SlidersHorizontalIcon size={18} />
                        </SidebarTrigger>
                    </div>
                )}
                {children}
            </div>
        </SidebarLayout>
    );
}
