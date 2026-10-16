import { useTranslation } from 'react-i18next';
import { FlagIcon } from '@/components/common/FlagIcon';
import { LanguageTiles } from '@/components/common/LanguageTiles';
import { languageByLabel } from '@/lib/language';
import { StepHeading } from './StepHeading';

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
    const enough = languages.length >= 2;

    return (
        <>
            <StepHeading title={t('onboarding:languages.title')} subtitle={t('onboarding:languages.hint')} />
            <section className="mt-5" aria-label={t('onboarding:languages.title')}>
                <LanguageTiles
                    value={languages}
                    onChange={(next) => {
                        onLanguages(next);
                        if (nativeLanguage && !next.includes(nativeLanguage)) onNative(null);
                    }}
                />
                <p className={enough ? 'ob-count ok' : 'ob-count'} aria-live="polite">
                    {enough
                        ? t('onboarding:languages.countOk', { count: languages.length })
                        : t('onboarding:languages.countLow')}
                </p>
            </section>

            <section className="ob-native" aria-label={t('onboarding:languages.nativeTitle')}>
                <h2 className="ob-native-label">{t('onboarding:languages.nativeTitle')}</h2>
                <div className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label={t('onboarding:languages.nativeTitle')}>
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
                            <FlagIcon lang={label} width={16} height={12} />
                            {languageByLabel(label)?.native ?? label}
                        </button>
                    ))}
                </div>
                <p className="ob-hint">{t('onboarding:languages.nativeHint')}</p>
            </section>
        </>
    );
}
