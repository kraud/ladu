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
 * slide-in menu, opened by a trigger on the title's row (it shows the icons of
 * the three sections instead of a label). The secondary `actions` move into
 * that menu — Delete pinned at the bottom, the rest above the sections — and
 * the bar keeps the reason, Cancel and the primary button, all small.
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
     * Edit mode's Cancel: always in the bar, immediately left of `primary`
     * (not grouped with `actions`) — on a phone too, as a small button.
     */
    cancelAction?: EditorAction;
    primary?: EditorPrimary;
    /** Read-only view: the phone's menu button only shows the icons of sections that hold something. */
    readOnly?: boolean;
    /** Why `primary` is disabled — shown in the bar; leave out when it is enabled. */
    statusText?: string;
    /** Create/edit: show the "* required" note in the bar (desktop). */
    showRequiredHint?: boolean;
    children: ReactNode;
}

/** Phone only: secondary actions in the slide-in menu — `top` above the sections, `bottom` pinned under them. */
function MenuActions({ actions, position }: { actions: EditorAction[]; position: 'top' | 'bottom' }) {
    const { setOpen } = useSidebar();
    return (
        <div className={position === 'top' ? 'flex flex-col gap-2 border-b border-border pb-3' : 'flex flex-col gap-2'}>
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

/**
 * Phone only: the menu button on the title's row, so the grid below keeps its full width. It shows
 * the icons of the sections inside (Clue, Tags, Linked words) instead of a label, the same as the
 * collapsed desktop rail: a section that holds something uses its `filledIcon`, with the count badge.
 * In a read-only view only the sections that hold something show; with none, a plain menu icon stays
 * so the actions in the menu remain reachable.
 */
function TitleRow({
    header,
    label,
    sections,
    readOnly,
}: {
    header: ReactNode;
    label: string;
    sections: SidebarSection[];
    readOnly?: boolean;
}) {
    const holdsSomething = (section: SidebarSection) => section.filled || (section.count ?? 0) > 0;
    const shown = readOnly ? sections.filter(holdsSomething) : sections;
    return (
        <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">{header}</div>
            <SidebarTrigger label={label} className="icon-btn w-auto shrink-0 grid-flow-col gap-1.5 px-2">
                {shown.length === 0 && <SlidersHorizontalIcon size={18} />}
                {shown.map((section) => {
                    const count = section.count ?? 0;
                    return (
                        <span
                            key={section.id}
                            data-testid={`trigger-${section.id}`}
                            data-filled={holdsSomething(section) || undefined}
                            className="relative grid place-items-center"
                            aria-hidden="true"
                        >
                            {section.filled && section.filledIcon ? section.filledIcon : section.icon}
                            {count > 0 && (
                                <span className="absolute -right-1.5 -top-1.5 grid min-w-3.5 place-items-center rounded-full bg-(--accent) px-0.5 text-[9px] font-semibold leading-3.5 text-(--accent-ink)">
                                    {count}
                                </span>
                            )}
                        </span>
                    );
                })}
            </SidebarTrigger>
        </div>
    );
}

export function WordEditorLayout({
    sections,
    header,
    actions = [],
    cancelAction,
    primary,
    readOnly,
    statusText,
    showRequiredHint,
    children,
}: WordEditorLayoutProps) {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    // Delete (the destructive action) sits at the bottom of the menu, away from the easy-to-hit top.
    const topActions = actions.filter((action) => action.variant !== 'destructive');
    const bottomActions = actions.filter((action) => action.variant === 'destructive');

    return (
        <SidebarLayout
            id="word"
            wide
            label={t('wordRelated:wordForm.sidebar.menuTitle')}
            sections={sections}
            header={
                isMobile ? (
                    <TitleRow
                        header={header}
                        label={t('wordRelated:wordForm.sidebar.openMenu')}
                        sections={sections}
                        readOnly={readOnly}
                    />
                ) : (
                    header
                )
            }
            // `MenuActions` reads the open state from the layout's context, so it must render inside it.
            drawerTop={topActions.length > 0 ? <MenuActions actions={topActions} position="top" /> : undefined}
            drawerBottom={bottomActions.length > 0 ? <MenuActions actions={bottomActions} position="bottom" /> : undefined}
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
            <div className="flex flex-col gap-4">{children}</div>
        </SidebarLayout>
    );
}
