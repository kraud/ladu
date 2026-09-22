import { useTranslation } from 'react-i18next';
import { Check } from '@phosphor-icons/react';
import { FlagIcon } from '@/components/common/FlagIcon';
import { UI_LANGUAGES } from '@/lib/language';
import { coverageForLanguage } from '@/features/words/form-engine/configs/coverage';
import type { Lang } from '@/ts/enums';

/**
 * The registration language picker's step-2 tiles (`MOCKUPS/auth/register.html`):
 * one large card per supported language with a flag, native name, the parts
 * of speech it actually has a form for (real coverage, not fixed copy — see
 * `coverageForLanguage`), and a checkmark badge when selected. Same
 * append-on-select semantics as `LanguagePicker` — `value`'s order is the
 * user's preference order.
 */
export function LanguageTiles({
    value,
    onChange,
}: {
    value: string[];
    onChange: (next: string[]) => void;
}) {
    const { t } = useTranslation();

    function toggle(label: string) {
        onChange(value.includes(label) ? value.filter((l) => l !== label) : [...value, label]);
    }

    return (
        <div className="lang-tiles" role="group" aria-label={t('loginRegister:register.languagesLabel')}>
            {UI_LANGUAGES.map((lang) => {
                const pressed = value.includes(lang.label);
                const coverage = coverageForLanguage(lang.label as Lang);
                const posId = `lang-tile-pos-${lang.key}`;

                return (
                    <button
                        key={lang.key}
                        type="button"
                        className="lang-tile"
                        aria-pressed={pressed}
                        // Named after the language alone (matching the old chip
                        // picker) — the coverage line is supplementary, given via
                        // aria-describedby rather than folded into the name.
                        aria-label={lang.native}
                        aria-describedby={posId}
                        onClick={() => toggle(lang.label)}
                    >
                        <span className="lt-check" aria-hidden="true">
                            <Check size={12} weight="bold" />
                        </span>
                        <FlagIcon lang={lang.key} width={32} height={23} className="rounded-[4px]" />
                        <b aria-hidden="true">{lang.native}</b>
                        <span className="lt-pos" id={posId}>
                            {coverage
                                .map((pos) => t(`common:partOfSpeech.${pos.toLowerCase()}`).toLowerCase())
                                .join(' · ')}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
