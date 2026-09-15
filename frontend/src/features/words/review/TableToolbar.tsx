/**
 * The toolbar above the table: debounced search box, the Display-gender
 * switch (D14 — shown only when there's a noun to apply it to), the
 * Display-progress switch (gates the per-cell completion ring, always
 * visible — unlike gender it applies to every part of speech), and the
 * loaded/total row count.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MagnifyingGlassIcon } from '@phosphor-icons/react';
import { Switch } from '@/components/ui/switch';
import { useDebouncedCallback } from '@/lib/useDebouncedCallback';

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
            <div className="searchbox">
                <MagnifyingGlassIcon size={14} />
                <input
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    placeholder={t('review:toolbar.searchPlaceholder')}
                    aria-label={t('review:toolbar.searchLabel')}
                />
            </div>
            {showSwitch && (
                <Switch
                    aria-pressed={showGender}
                    onClick={() => onShowGenderChange(!showGender)}
                >
                    {t('review:toolbar.displayGender')}
                </Switch>
            )}
            <Switch
                aria-pressed={showProgress}
                onClick={() => onShowProgressChange(!showProgress)}
            >
                {t('review:toolbar.displayProgress')}
            </Switch>
            <span className="meta" style={{ marginLeft: 'auto' }}>
                {t('review:toolbar.rowCount', { count: loadedCount, total })}
            </span>
        </div>
    );
}
