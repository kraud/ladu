import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FlagIcon } from '@/components/common/FlagIcon';
import { languageByLabel } from '@/lib/language';
import { addPair, coversEveryPair } from '../masteredPairs';

const nativeName = (label: string) => languageByLabel(label)?.native ?? label;

/**
 * "Mastered language pairs" in the Account form (.context/features/practice.md D8): pairs of the
 * user's selected languages that Practice never combines in one exercise. The user picks two
 * languages and adds the pair as a removable chip. Nothing else in the app reads these pairs.
 *
 * With fewer than 3 languages, the one possible pair is the pair Practice needs, so the field
 * asks for a third language instead of showing the pickers. The parent drops a pair when one of
 * its languages is unselected; this field shows the message when the pairs left cover every pair.
 */
export function MasteredPairsField({
    languages,
    value,
    onChange,
}: {
    /** the languages selected in the form now */
    languages: string[];
    value: string[][];
    onChange: (next: string[][]) => void;
}) {
    const { t } = useTranslation();
    const [pickedFirst, setFirst] = useState('');
    const [pickedSecond, setSecond] = useState('');

    // A pick for a language that was unselected since is no pick.
    const first = languages.includes(pickedFirst) ? pickedFirst : '';
    const second = languages.includes(pickedSecond) && pickedSecond !== first ? pickedSecond : '';
    const next = first && second ? addPair(value, first, second) : value;
    // The same pair twice adds nothing, and the last open pair can never be added.
    const canAdd = next !== value && !coversEveryPair(next, languages);

    function add() {
        onChange(next);
        setFirst('');
        setSecond('');
    }

    const picker = (label: string, current: string, set: (v: string) => void, options: string[]) => (
        <Select value={current} onValueChange={(v) => set(String(v))}>
            <SelectTrigger aria-label={label} className="w-full">
                <SelectValue>{(v: string) => (v ? nativeName(v) : label)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
                {options.map((option) => (
                    <SelectItem key={option} value={option}>
                        {nativeName(option)}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );

    return (
        <div className="field">
            <span className="label">{t('account:masteredPairs.title')}</span>

            {value.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                    {value.map(([a, b], index) => {
                        const names = { first: nativeName(a), second: nativeName(b) };
                        return (
                            // `.tagchip` stops at 140px: a pair with two flags and two names is wider.
                            <li key={`${a}|${b}`} className="tagchip max-w-none!">
                                <span className="inline-flex items-center gap-1">
                                    <FlagIcon lang={a} />
                                    {names.first}
                                    {' & '}
                                    <FlagIcon lang={b} />
                                    {names.second}
                                </span>
                                <button
                                    type="button"
                                    className="x"
                                    aria-label={t('account:masteredPairs.remove', names)}
                                    onClick={() => onChange(value.filter((_, i) => i !== index))}
                                >
                                    <XIcon size={9} weight="bold" />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}

            {languages.length >= 3 ? (
                <div className="flex flex-wrap items-center gap-2">
                    <div className="min-w-0 flex-1 basis-36">
                        {picker(t('account:masteredPairs.first'), first, setFirst, languages)}
                    </div>
                    <div className="min-w-0 flex-1 basis-36">
                        {picker(
                            t('account:masteredPairs.second'),
                            second,
                            setSecond,
                            languages.filter((l) => l !== first),
                        )}
                    </div>
                    <Button type="button" variant="outline" className="shrink-0" disabled={!canAdd} onClick={add}>
                        {t('account:masteredPairs.add')}
                    </Button>
                </div>
            ) : (
                <p className="hint">{t('account:masteredPairs.needThird')}</p>
            )}

            {coversEveryPair(value, languages) ? (
                <p className="err show" role="alert">
                    {t('account:masteredPairs.errors.allMastered')}
                </p>
            ) : (
                <p className="hint">{t('account:masteredPairs.hint')}</p>
            )}
        </div>
    );
}
