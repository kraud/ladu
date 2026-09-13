import { useTranslation } from 'react-i18next';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { partOfSpeechLabelKey } from '@/lib/words';
import { PartOfSpeech } from '@/ts/enums';

/** Every `PartOfSpeech`, in the order the old app's selector presented them. */
const ALL_POS = [
    PartOfSpeech.noun,
    PartOfSpeech.verb,
    PartOfSpeech.adjective,
    PartOfSpeech.adverb,
    PartOfSpeech.preposition,
    PartOfSpeech.conjunction,
    PartOfSpeech.pronoun,
    PartOfSpeech.interjection,
    PartOfSpeech.properNoun,
    PartOfSpeech.numerals,
];

/** Parts of speech the form engine ships against so far — the rest render disabled. */
const SHIPPED_POS: readonly PartOfSpeech[] = [PartOfSpeech.noun, PartOfSpeech.verb];

const POS_DESCRIPTION_KEY: Record<PartOfSpeech, string> = {
    [PartOfSpeech.noun]: 'wordRelated:partOfSpeechSelector.description.noun.info',
    [PartOfSpeech.verb]: 'wordRelated:partOfSpeechSelector.description.verb.info',
    [PartOfSpeech.adjective]: 'wordRelated:partOfSpeechSelector.description.adjective.info',
    [PartOfSpeech.adverb]: 'wordRelated:partOfSpeechSelector.description.adverb.info',
    [PartOfSpeech.preposition]: 'wordRelated:partOfSpeechSelector.description.preposition.info',
    [PartOfSpeech.conjunction]: 'wordRelated:partOfSpeechSelector.description.conjunction.info',
    [PartOfSpeech.pronoun]: 'wordRelated:partOfSpeechSelector.description.pronoun.info',
    [PartOfSpeech.interjection]: 'wordRelated:partOfSpeechSelector.description.interjection.info',
    [PartOfSpeech.properNoun]: 'wordRelated:partOfSpeechSelector.description.properNoun.info',
    [PartOfSpeech.numerals]: 'wordRelated:partOfSpeechSelector.description.numerals.info',
};

/**
 * The `WordForm` create-mode gate: pick a part of speech before any
 * translation card renders. Noun and Verb are selectable so far — the rest
 * render as disabled radio cards captioned with `missingImplementationPoS`,
 * so the full inventory stays visible (Adjective/Adverb arrive later in
 * Phase 3 by simply widening `SHIPPED_POS` further).
 */
export function PartOfSpeechSelector({
    value,
    onChange,
}: {
    value: PartOfSpeech | undefined;
    onChange: (pos: PartOfSpeech) => void;
}) {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
                <h2 className="h2">{t('wordRelated:partOfSpeechSelector.title')}</h2>
                <p className="meta">{t('wordRelated:partOfSpeechSelector.subtitle')}</p>
            </div>
            <RadioGroup
                value={value ?? ''}
                onValueChange={(next) => onChange(next as PartOfSpeech)}
                className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            >
                {ALL_POS.map((pos) => {
                    const shipped = SHIPPED_POS.includes(pos);
                    return (
                        <label
                            key={pos}
                            className="flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-4 aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
                            aria-disabled={!shipped}
                        >
                            <RadioGroupItem value={pos} disabled={!shipped} className="mt-1" />
                            <div className="flex flex-col gap-1">
                                <span className="text-sm font-medium text-foreground">{t(partOfSpeechLabelKey(pos))}</span>
                                <span className="text-sm text-muted-foreground">{t(POS_DESCRIPTION_KEY[pos])}</span>
                                {!shipped && (
                                    <span className="text-xs text-muted-foreground italic">
                                        {t('wordRelated:partOfSpeechSelector.missingImplementationPoS')}
                                    </span>
                                )}
                            </div>
                        </label>
                    );
                })}
            </RadioGroup>
        </div>
    );
}
