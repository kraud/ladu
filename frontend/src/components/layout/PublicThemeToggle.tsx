import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { useTheme } from '@/lib/theme';

/**
 * Theme switch for the public routes (login / register / verify / reset). No
 * session to save to — it only writes the browser choice (`lib/theme.ts`). The
 * choice is what login / register send to the backend (Slice 3), so a theme
 * picked here follows the user into the app.
 */
export function PublicThemeToggle() {
    const { theme, setTheme } = useTheme();
    return <ThemeToggle theme={theme} onToggle={setTheme} />;
}
