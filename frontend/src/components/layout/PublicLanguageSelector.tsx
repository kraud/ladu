import { useTranslation } from 'react-i18next';
import { LanguageMenu } from '@/components/layout/LanguageMenu';
import { i18nCodeByLabel, labelByI18nCode } from '@/lib/language';

/**
 * UI-language switcher for the public routes (login / register / verify /
 * reset). There is no session to persist to — it only calls
 * `i18n.changeLanguage`, which writes the LanguageDetector
 * `localStorage['i18nextLng']` cache, so the choice survives a reload and is
 * picked up on the next init. The value is also read back by the login /
 * register forms and sent as `uiLanguage`, so a choice made here is stored on
 * the user row once they authenticate — keeping the app consistent with the
 * language chosen while signing in.
 */
export function PublicLanguageSelector() {
    const { i18n } = useTranslation();
    const currentLabel = labelByI18nCode(i18n.language);

    return (
        <LanguageMenu
            currentLabel={currentLabel}
            onSelect={(label) => {
                void i18n.changeLanguage(i18nCodeByLabel(label));
            }}
        />
    );
}
