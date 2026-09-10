import { FlagIcon } from '@/components/common/FlagIcon';
import { UI_LANGUAGES } from '@/lib/language';

/**
 * Multi-select language toggle used at registration. Each supported language is
 * a `.chip` pill (flag + native name) toggled by a click. Selection order is
 * preserved in `value` — the array order is the user's language preference
 * (Review columns, translation-form order); explicit reordering comes later in
 * the Account page.
 */
export function LanguagePicker({
    value,
    onChange,
    'aria-invalid': ariaInvalid,
}: {
    value: string[];
    onChange: (next: string[]) => void;
    'aria-invalid'?: boolean;
}) {
    function toggle(label: string) {
        onChange(
            value.includes(label) ? value.filter((l) => l !== label) : [...value, label],
        );
    }

    return (
        <div className="flex flex-wrap gap-2" role="group" aria-invalid={ariaInvalid || undefined}>
            {UI_LANGUAGES.map((lang) => (
                <button
                    key={lang.key}
                    type="button"
                    className="chip"
                    aria-pressed={value.includes(lang.label)}
                    onClick={() => toggle(lang.label)}
                >
                    <FlagIcon lang={lang.key} />
                    {lang.native}
                </button>
            ))}
        </div>
    );
}
