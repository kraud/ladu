import { useTranslation } from 'react-i18next';
import { MoonIcon, SunIcon } from '@phosphor-icons/react';
import type { Theme } from '@/lib/theme';

/**
 * Presentational light/dark switch — a single icon button that shows the theme
 * the click will switch TO (moon in light mode, sun in dark mode). Stateless:
 * the container decides what "toggle" does (browser only on public routes;
 * also saved to the profile in the header, Slice 3). Same split as
 * `LanguageMenu` / `PublicLanguageSelector`.
 */
export function ThemeToggle({
    theme,
    onToggle,
    busy = false,
}: {
    theme: Theme;
    onToggle: (next: Theme) => void;
    busy?: boolean;
}) {
    const { t } = useTranslation();
    const next: Theme = theme === 'dark' ? 'light' : 'dark';

    return (
        <button
            type="button"
            className="icon-btn"
            aria-label={t(next === 'dark' ? 'common:theme.switchToDark' : 'common:theme.switchToLight')}
            disabled={busy}
            onClick={() => onToggle(next)}
        >
            {busy ? <span className="spinner" /> : next === 'dark' ? <MoonIcon size={18} /> : <SunIcon size={18} />}
        </button>
    );
}
