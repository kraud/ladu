import { useTranslation } from 'react-i18next';
import { LanguageTiles } from '@/components/common/LanguageTiles';
import { languageByLabel } from '@/lib/language';

/** Step 1 (D8): the account's languages and native language, filled in; the user confirms or changes them. */
export function LanguagesStep({
    languages,
    nativeLanguage,
    onLanguages,
    onNative,
}: {
    languages: string[];
    nativeLanguage: string | null;
    onLanguages: (next: string[]) => void;
    onNative: (next: string | null) => void;
}) {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col gap-5">
            <section className="flex flex-col gap-2" aria-label={t('onboarding:languages.title')}>
                <LanguageTiles
                    value={languages}
                    onChange={(next) => {
                        onLanguages(next);
                        if (nativeLanguage && !next.includes(nativeLanguage)) onNative(null);
                    }}
                />
                <span className="hint" aria-live="polite">
                    {languages.length < 2
                        ? t('onboarding:languages.countLow')
                        : t('onboarding:languages.countOk', { count: languages.length })}
                </span>
            </section>

            <section className="flex flex-col gap-2" aria-label={t('onboarding:languages.nativeTitle')}>
                <h2 className="font-semibold">{t('onboarding:languages.nativeTitle')}</h2>
                <div className="flex flex-wrap gap-2" role="group">
                    <button type="button" className="chip" aria-pressed={nativeLanguage === null} onClick={() => onNative(null)}>
                        {t('onboarding:languages.nativeNone')}
                    </button>
                    {languages.map((label) => (
                        <button
                            key={label}
                            type="button"
                            className="chip"
                            aria-pressed={nativeLanguage === label}
                            onClick={() => onNative(label)}
                        >
                            {languageByLabel(label)?.native ?? label}
                        </button>
                    ))}
                </div>
                <span className="hint">{t('onboarding:languages.nativeHint')}</span>
            </section>
        </div>
    );
}
