import { FlagIcon } from '@/components/common/FlagIcon';
import { languageByLabel } from '@/lib/language';
import { NO_NATIVE_LANGUAGE } from '../schemas';

/**
 * The native language as one badge out of the selected languages, like the language list. A click
 * on a badge chooses it; a click on the chosen badge clears the choice (`NO_NATIVE_LANGUAGE`).
 * Only selected languages are offered, because the server rejects any other value.
 */
export function NativeLanguagePicker({
    languages,
    value,
    onChange,
    'aria-label': ariaLabel,
}: {
    /** the languages selected in the form now */
    languages: string[];
    /** a language label out of `languages`, or `NO_NATIVE_LANGUAGE` */
    value: string;
    onChange: (next: string) => void;
    'aria-label': string;
}) {
    return (
        <div className="flex flex-wrap gap-2" role="group" aria-label={ariaLabel}>
            {languages.map((label) => {
                const entry = languageByLabel(label);
                const chosen = value === label;
                return (
                    <button
                        key={label}
                        type="button"
                        className="chip"
                        aria-pressed={chosen}
                        onClick={() => onChange(chosen ? NO_NATIVE_LANGUAGE : label)}
                    >
                        {entry && <FlagIcon lang={entry.key} />}
                        {entry?.native ?? label}
                    </button>
                );
            })}
        </div>
    );
}
