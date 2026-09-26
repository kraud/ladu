import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { useUpdateProfile } from '@/features/auth/hooks';
import { useTheme, type Theme } from '@/lib/theme';
import { useAuthStore } from '@/stores/authStore';

/**
 * Theme switch for the authenticated header. The page changes at once (the
 * browser choice is written first), then the choice is saved to the user row
 * through `updateProfile` — a full payload, like `LanguageSelector`, because
 * the endpoint clears `nativeLanguage` when that key is absent. The public
 * counterpart, which has no session to save to, is `PublicThemeToggle`.
 *
 * The button is disabled while the save is in flight. Two quick clicks would
 * otherwise race, and a stale echo of the first save could flip the page back.
 * A failed save shows the usual error toast; the page keeps the chosen theme.
 */
export function ThemeSelector() {
    const { theme, setTheme } = useTheme();
    const user = useAuthStore((s) => s.user);
    const updateProfile = useUpdateProfile();

    if (!user) return null;

    function choose(next: Theme) {
        if (!user || updateProfile.isPending) return;
        setTheme(next);
        updateProfile.mutate({
            email: user.email,
            name: user.name,
            username: user.username,
            languages: user.languages,
            uiLanguage: user.uiLanguage,
            nativeLanguage: user.nativeLanguage,
            theme: next,
        });
    }

    return <ThemeToggle theme={theme} onToggle={choose} busy={updateProfile.isPending} />;
}
