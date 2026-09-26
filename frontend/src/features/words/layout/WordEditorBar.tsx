/**
 * The word editor's bottom bar (`MOCKUPS/word-editor.html` `.savebar`: a
 * translucent, blurred strip with a top border), pinned to the bottom of the
 * viewport with `position: fixed`. `sticky` was not enough: it cannot push a
 * bar down on a short page (no translations yet), and it stops where its
 * parent ends — 32px above the viewport bottom, because of `AppShell`'s
 * `py-8`. A spacer of the bar's own height (measured, since the phone layout
 * grows when the reason wraps) keeps the last content from hiding behind it.
 *
 * Desktop: the secondary actions (Change word type, Cancel, Delete, Return)
 * on the left, then — in create/edit — the "* required" note; on the right
 * the reason Save is disabled (`statusText`, absent when Save is enabled) and
 * the primary button (Save word / Edit).
 *
 * Phone: only the reason and the primary button (full width). The secondary
 * actions are rendered in the drawer instead (`WordEditorLayout`) — the bar
 * does not render them at all, so each action keeps one accessible name.
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export interface EditorAction {
    key: string;
    label: string;
    icon: ReactNode;
    onClick: () => void;
    variant?: 'outline' | 'destructive';
}

export interface EditorPrimary {
    label: string;
    icon: ReactNode;
    onClick: () => void;
    disabled?: boolean;
}

export interface WordEditorBarProps {
    /** Secondary actions — shown here on desktop only. */
    actions?: EditorAction[];
    primary?: EditorPrimary;
    /** Why the primary button is disabled; leave out when it is enabled. */
    statusText?: string;
    /** Create/edit only: the "* Fields marked with * are required" note (desktop). */
    showRequiredHint?: boolean;
    isMobile: boolean;
}

export function WordEditorBar({ actions = [], primary, statusText, showRequiredHint, isMobile }: WordEditorBarProps) {
    const { t } = useTranslation();
    const showActions = !isMobile && actions.length > 0;
    const barRef = useRef<HTMLDivElement>(null);
    const [barHeight, setBarHeight] = useState(0);

    useLayoutEffect(() => {
        const bar = barRef.current;
        if (!bar) return;
        setBarHeight(bar.offsetHeight);
        // Missing in jsdom: the spacer then stays 0, which is harmless there.
        if (typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(() => setBarHeight(bar.offsetHeight));
        observer.observe(bar);
        return () => observer.disconnect();
    }, []);

    return (
        <>
            <div aria-hidden="true" style={{ height: barHeight }} />
            <div
                ref={barRef}
                data-testid="word-editor-bar"
                className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] backdrop-blur-md"
            >
                {/* The word routes are the wide ones (`max-w-7xl`, `AppShell`): same column and gutter. */}
                <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-6 py-2.5 max-[920px]:flex-col max-[920px]:items-stretch max-[920px]:gap-2">
                    {showActions && (
                        <div className="flex items-center gap-2">
                            {actions.map((action) => (
                                <Button key={action.key} type="button" variant={action.variant ?? 'outline'} onClick={action.onClick}>
                                    {action.icon}
                                    {action.label}
                                </Button>
                            ))}
                        </div>
                    )}
                    {!isMobile && showRequiredHint && (
                        <p className="hint">
                            <span aria-hidden="true" className="text-destructive">
                                *
                            </span>{' '}
                            {t('wordRelated:wordForm.hints.requiredFieldsDisclaimer')}
                        </p>
                    )}
                    <div className="grow max-[920px]:hidden" />
                    {statusText && (
                        <p role="status" className="flex items-center gap-2 text-[13px] text-muted-foreground">
                            <span aria-hidden="true" className="size-[7px] shrink-0 rounded-full bg-(--warning)" />
                            {statusText}
                        </p>
                    )}
                    {primary && (
                        <Button type="button" disabled={primary.disabled} onClick={primary.onClick}>
                            {primary.icon}
                            {primary.label}
                        </Button>
                    )}
                </div>
            </div>
        </>
    );
}
