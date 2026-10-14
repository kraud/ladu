/**
 * The toolbar above the table: debounced search box and the loaded/total row
 * count. The display switches (`DisplayOptions`) live in the side menu's
 * "Display" section, not here.
 *
 * On a phone (`compact`) the count is left out, and the "Filters" button that opens it
 * (`SidebarTrigger`) comes in through `leading`, before the search box. On
 * desktop that button renders nothing: the filter panel is always docked.
 * Search stays here either way.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { MagnifyingGlassIcon } from '@phosphor-icons/react';
import { useDebouncedCallback } from '@/lib/useDebouncedCallback';

const SEARCH_DEBOUNCE_MS = 500;

export interface TableToolbarProps {
    /** Seeds the search box from `search.q` — also resynced on an external reset (e.g. Clear filters). */
    initialQuery: string;
    onQueryChange: (next: string | undefined) => void;
    loadedCount: number;
    total: number;
    /** Rendered before the search box (the phone's Filters button; empty on desktop). */
    leading?: ReactNode;
    /** Phone layout: the switches are in the slide-in menu, and the row count is not shown. */
    compact?: boolean;
}

export function TableToolbar({
    initialQuery,
    onQueryChange,
    loadedCount,
    total,
    leading,
    compact = false,
}: TableToolbarProps) {
    const { t } = useTranslation();
    const [value, setValue] = useState(initialQuery);
    const debounced = useDebouncedCallback(value, SEARCH_DEBOUNCE_MS);
    const isFirstRun = useRef(true);

    // Resync on an external reset (Clear filters) — not on every keystroke,
    // since `initialQuery` only changes when something OTHER than this box
    // writes `?q=`.
    useEffect(() => {
        setValue(initialQuery);
    }, [initialQuery]);

    // Skip the mount firing — `debounced` starts equal to `initialQuery`, so
    // without this guard every page load would fire one spurious `onQueryChange`
    // (and thus one spurious `navigate`) before the user has typed anything.
    useEffect(() => {
        if (isFirstRun.current) {
            isFirstRun.current = false;
            return;
        }
        const trimmed = debounced.trim();
        onQueryChange(trimmed === '' ? undefined : trimmed);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debounced]);

    return (
        <div className="toolbar">
            {leading}
            <div className="searchbox">
                <MagnifyingGlassIcon size={14} />
                <input
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    placeholder={t('review:toolbar.searchPlaceholder')}
                    aria-label={t('review:toolbar.searchLabel')}
                />
            </div>
            {!compact && (
                <span className="meta" style={{ marginLeft: 'auto' }}>
                    {t('review:toolbar.rowCount', { count: loadedCount, total })}
                </span>
            )}
        </div>
    );
}
