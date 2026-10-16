import { useTranslation } from 'react-i18next';
import { FlagIcon } from '@/components/common/FlagIcon';
import { languageByLabel } from '@/lib/language';
import { LEVELS, type Level } from '../types';

/** Step 2 (D4): one level per learning language. */
export function LevelsStep({
    languages,
    value,
    onChange,
}: {
    languages: string[];
    value: Record<string, Level>;
    onChange: (next: Record<string, Level>) => void;
}) {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col gap-4">
            {languages.map((label) => {
                const lang = languageByLabel(label);
                return (
                    <section key={label} className="flex flex-col gap-2" aria-label={lang?.native ?? label}>
                        <h2 className="flex items-center gap-2 font-semibold">
                            {lang && <FlagIcon lang={lang.key} width={24} height={17} className="rounded-[3px]" />}
                            {lang?.native ?? label}
                        </h2>
                        <div className="flex flex-wrap gap-2" role="group">
                            {LEVELS.map((level) => (
                                <button
                                    key={level}
                                    type="button"
                                    className="chip"
                                    aria-pressed={value[label] === level}
                                    onClick={() => onChange({ ...value, [label]: level })}
                                >
                                    {t(`onboarding:levels.${level}`)}
                                </button>
                            ))}
                        </div>
                        {value[label] && <span className="hint">{t(`onboarding:levels.${value[label]}Hint`)}</span>}
                    </section>
                );
            })}
        </div>
    );
}
