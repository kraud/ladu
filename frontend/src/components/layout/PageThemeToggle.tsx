import { useEffect, useState } from 'react';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { applyTheme, currentTheme, type Theme } from '@/lib/theme';

/**
 * A theme switch that only lives on the page it is mounted on (the 404). It
 * changes the page and nothing else: no `localStorage` write, no request, so
 * the choice is not saved, does not follow the user into a later login, and
 * does not reach the account. Leaving the page puts back the theme that
 * applies normally (`currentTheme()`: saved choice, else the OS preference).
 *
 * The saved-choice switches are `PublicThemeToggle` (public screens) and
 * `ThemeSelector` (header).
 */
export function PageThemeToggle() {
    const [theme, setTheme] = useState<Theme>(currentTheme);

    useEffect(() => () => applyTheme(currentTheme()), []);

    function choose(next: Theme) {
        applyTheme(next);
        setTheme(next);
    }

    return <ThemeToggle theme={theme} onToggle={choose} />;
}
