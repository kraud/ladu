import { useTranslation } from 'react-i18next';
import { MAX_WORDS, WORDS_STEP } from '../types';
import { sliderRange } from '../learning';
import { StepHeading } from './StepHeading';

/** The text under the slider changes at thresholds (D14, D16). */
export function countHintKey(count: number): string {
    if (count <= 70) return 'onboarding:count.hintSmall';
    if (count <= 100) return 'onboarding:count.hintMedium';
    return 'onboarding:count.hintLarge';
}

/** Step 4 (D14, D18, D25): how many words, from 50 up to what the pool can deliver for this choice. */
export function CountStep({
    capacity,
    value,
    onChange,
}: {
    capacity: number;
    value: number;
    onChange: (next: number) => void;
}) {
    const { t } = useTranslation();
    const range = sliderRange(capacity);

    return (
        <>
            <StepHeading title={t('onboarding:count.title')} subtitle={t('onboarding:count.hint')} />
            {!range ? (
                <p className="banner warning mt-5" role="status">
                    {t('onboarding:count.none')}
                </p>
            ) : (
                <>
                    <div className="ob-numline" role="status">
                        <span className="ob-num">{value}</span>{' '}
                        <span className="ob-num-unit">{t('onboarding:count.unit')}</span>
                    </div>
                    {range.min < range.max && (
                        <>
                            <input
                                type="range"
                                className="ob-range"
                                aria-label={t('onboarding:count.title')}
                                aria-valuetext={`${value} ${t('onboarding:count.unit')}`}
                                min={range.min}
                                max={range.max}
                                step={WORDS_STEP}
                                value={value}
                                onChange={(event) => onChange(Number(event.target.value))}
                            />
                            <div className="ob-range-scale" aria-hidden="true">
                                <span>{range.min}</span>
                                <span>{range.max}</span>
                            </div>
                        </>
                    )}
                    <p className="ob-hint">{t(countHintKey(value))}</p>
                    {capacity < MAX_WORDS && (
                        <p className="ob-hint">
                            {capacity < 50
                                ? t('onboarding:count.capacityLow', { count: capacity })
                                : t('onboarding:count.capacity', { count: capacity })}
                        </p>
                    )}
                </>
            )}
        </>
    );
}
