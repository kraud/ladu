import { useTranslation } from 'react-i18next';
import { MAX_WORDS, WORDS_STEP } from '../types';
import { sliderRange } from '../learning';

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

    if (!range) {
        return (
            <p className="banner warning" role="status">
                {t('onboarding:count.none')}
            </p>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            <p className="text-3xl font-semibold" aria-live="polite">
                {t('onboarding:count.value', { count: value })}
            </p>
            {range.min < range.max && (
                <input
                    type="range"
                    aria-label={t('onboarding:count.title')}
                    min={range.min}
                    max={range.max}
                    step={WORDS_STEP}
                    value={value}
                    onChange={(event) => onChange(Number(event.target.value))}
                />
            )}
            <span className="hint">{t(countHintKey(value))}</span>
            {capacity < MAX_WORDS && (
                <span className="hint">
                    {capacity < 50
                        ? t('onboarding:count.capacityLow', { count: capacity })
                        : t('onboarding:count.capacity', { count: capacity })}
                </span>
            )}
        </div>
    );
}
