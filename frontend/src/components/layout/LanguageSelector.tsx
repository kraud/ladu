import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageMenu } from '@/components/layout/LanguageMenu';
import { useUpdateProfile } from '@/features/auth/hooks';
import { useAuthStore } from '@/stores/authStore';
import { i18nCodeByLabel } from '@/lib/language';

/**
 * UI-language switcher for the authenticated shell. Selecting a language
 * persists `uiLanguage` through `updateProfile` (a full payload — see
 * `useUpdateProfile`) and folds the fresh row back into the session; the effect
 * below then syncs i18next. Mirrors the old `Header` → `MainView` split
 * (`pages-auth-shell.md:134,208`) but as one mutation, not a Redux thunk + a
 * localStorage rewrite. The public-route counterpart is `PublicLanguageSelector`.
 */
export function LanguageSelector() {
    const { i18n } = useTranslation();
    const user = useAuthStore((s) => s.user);
    const updateProfile = useUpdateProfile();

    const currentLabel = user?.uiLanguage ?? 'English';

    useEffect(() => {
        const code = i18nCodeByLabel(currentLabel);
        if (i18n.language !== code) void i18n.changeLanguage(code);
    }, [currentLabel, i18n]);

    if (!user) return null;

    function choose(label: string) {
        if (label === currentLabel || updateProfile.isPending) return;
        updateProfile.mutate({
            email: user!.email,
            name: user!.name,
            username: user!.username,
            languages: user!.languages,
            uiLanguage: label,
            nativeLanguage: user!.nativeLanguage,
        });
    }

    return (
        <LanguageMenu currentLabel={currentLabel} onSelect={choose} busy={updateProfile.isPending} />
    );
}
