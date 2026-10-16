import { useTranslation } from 'react-i18next';
import { FlagIcon } from '@/components/common/FlagIcon';
import { SegmentedToggle } from '@/components/ui/segmented-toggle';
import { languageByLabel } from '@/lib/language';
import { LEVELS, type Level } from '../types';
import { StepHeading } from './StepHeading';

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
        <>
            <StepHeading title={t('onboarding:levels.title')} subtitle={t('onboarding:levels.hint')} />
            <div className="ob-levels">
                {languages.map((label) => {
                    const lang = languageByLabel(label);
                    const name = lang?.native ?? label;
                    return (
                        <section key={label} className="ob-level-row" aria-label={name}>
                            <h2 className="ob-level-lang">
                                {lang && <FlagIcon lang={lang.key} width={22} height={16} />}
                                <b>{name}</b>
                            </h2>
                            <SegmentedToggle
                                aria-label={name}
                                allowDeselect={false}
                                value={value[label]}
                                onValueChange={(level) => onChange({ ...value, [label]: level as Level })}
                                options={LEVELS.map((level) => ({ value: level, label: t(`onboarding:levels.${level}`) }))}
                            />
                            <p className="ob-level-desc min-h-[1.2em]">
                                {value[label] && t(`onboarding:levels.${value[label]}Hint`)}
                            </p>
                        </section>
                    );
                })}
            </div>
        </>
    );
}
