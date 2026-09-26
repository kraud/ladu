import { useEffect } from 'react';
import { readStoredTheme, setTheme } from '@/lib/theme';
import { useAuthStore } from '@/stores/authStore';

/**
 * Makes the theme saved on the user's row win once they are signed in (Phase
 * 3.9, D7). Every sign-in path — form login, email verify, Google callback,
 * Google sign-up, account link — ends by writing the session and entering the
 * authenticated shell, so one effect here covers all of them.
 *
 * - Row has a theme, browser differs (or has no saved choice): apply it and save
 *   it as the browser's choice, so the next visit does not flash the other one.
 * - Row has no theme (`null`, an account that never chose): do nothing — the
 *   browser keeps its own start value, and nothing is written to the row.
 *
 * Keyed on the row value, so it re-runs only when that value changes. That
 * includes the echo of the header switch's own save, which already matches.
 */
export function useSessionTheme(): void {
    const rowTheme = useAuthStore((s) => s.user?.theme ?? null);

    useEffect(() => {
        if (rowTheme && rowTheme !== readStoredTheme()) setTheme(rowTheme);
    }, [rowTheme]);
}
