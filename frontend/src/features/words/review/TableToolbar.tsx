/**
 * The toolbar above the table: debounced search box, the display switches
 * (`DisplayOptions` — Display gender, D14, only when there's a noun to apply
 * it to; Display progress, which gates the per-cell completion ring and
 * applies to every part of speech), and the loaded/total row count.
 *
 * On a phone the switches live in `MobileFilters`' side menu instead
 * (`hideDisplayOptions`), and that menu's trigger comes in through `leading`,
 * before the search box. Search and the count stay here either way.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { MagnifyingGlassIcon } from '@phosphor-icons/react';
import { useDebouncedCallback } from '@/lib/useDebouncedCallback';
import { DisplayOptions } from './DisplayOptions';

const SEARCH_DEBOUNCE_MS = 500;

export interface TableToolbarProps {
    /** Seeds the search box from `search.q` — also resynced on an external reset (e.g. Clear filters). */
    initialQuery: string;
    onQueryChange: (next: string | undefined) => void;
    /** D14: `ReviewPage` decides this from whether any loaded row is a Noun. */
    showSwitch: boolean;
    showGender: boolean;
    onShowGenderChange: (next: boolean) => void;
    showProgress: boolean;
    onShowProgressChange: (next: boolean) => void;
    loadedCount: number;
    total: number;
    /** Rendered before the search box (the phone's Filters button). */
    leading?: ReactNode;
    /** The switches are somewhere else (the phone's side menu). */
    hideDisplayOptions?: boolean;
}

export function TableToolbar({
    initialQuery,
    onQueryChange,
    showSwitch,
    showGender,
    onShowGenderChange,
    showProgress,
    onShowProgressChange,
    loadedCount,
    total,
    leading,
    hideDisplayOptions = false,
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
            {!hideDisplayOptions && (
                <DisplayOptions
                    showGenderSwitch={showSwitch}
                    showGender={showGender}
                    onShowGenderChange={onShowGenderChange}
                    showProgress={showProgress}
                    onShowProgressChange={onShowProgressChange}
                />
            )}
            <span className="meta" style={{ marginLeft: 'auto' }}>
                {t('review:toolbar.rowCount', { count: loadedCount, total })}
            </span>
        </div>
    );
}
