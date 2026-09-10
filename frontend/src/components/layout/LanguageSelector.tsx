import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckIcon } from '@phosphor-icons/react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FlagIcon } from '@/components/common/FlagIcon';
import { useUpdateProfile } from '@/features/auth/hooks';
import { useAuthStore } from '@/stores/authStore';
import { UI_LANGUAGES, i18nCodeByLabel, langKeyByLabel } from '@/lib/language';

/**
 * UI-language switcher. Selecting a language persists `uiLanguage` through
 * `updateProfile` (a full payload — see `useUpdateProfile`) and folds the fresh
 * row back into the session; the effect below then syncs i18next. This mirrors
 * the old `Header` → `MainView` split (`pages-auth-shell.md:134,208`) but as one
 * mutation instead of a Redux thunk + a localStorage rewrite.
 */
export function LanguageSelector() {
    const { t, i18n } = useTranslation();
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
        <DropdownMenu>
            <DropdownMenuTrigger
                className="icon-btn flex w-auto items-center gap-1.5 px-2 text-[12px] font-semibold"
                aria-label={t('common:header.settings.uiLanguage')}
                disabled={updateProfile.isPending}
            >
                {updateProfile.isPending ? (
                    <span className="spinner" />
                ) : (
                    <FlagIcon lang={currentLabel} />
                )}
                {langKeyByLabel(currentLabel) || 'EN'}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className="min-w-44">
                {UI_LANGUAGES.map((lang) => (
                    <DropdownMenuItem
                        key={lang.key}
                        onClick={() => choose(lang.label)}
                        className="justify-between"
                    >
                        <span className="flex items-center gap-2">
                            <FlagIcon lang={lang.key} />
                            {lang.native}
                        </span>
                        {lang.label === currentLabel && <CheckIcon />}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
