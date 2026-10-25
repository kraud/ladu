import type { Lang, PartOfSpeech } from '@/ts/enums';
import { PartOfSpeech as PoS } from '@/ts/enums';
import { ADJECTIVE_CONFIGS } from './adjectives';
import { ADVERB_CONFIGS } from './adverbs';
import { CONJUNCTION_CONFIGS } from './conjunctions';
import { NOUN_CONFIGS } from './nouns';
import { PREPOSITION_CONFIGS } from './prepositions';
import { VERB_CONFIGS } from './verbs';
import type { TranslationFormConfig } from './types';

/**
 * `(PartOfSpeech, Lang) -> TranslationFormConfig`. A part of speech or language
 * with no config falls through to `undefined` — `TranslationCard` already
 * renders its "language not available" fallback.
 */
export function getFormConfig(pos: PartOfSpeech, lang: Lang): TranslationFormConfig | undefined {
    if (pos === PoS.noun) {
        return NOUN_CONFIGS[lang];
    }
    if (pos === PoS.verb) {
        return VERB_CONFIGS[lang];
    }
    if (pos === PoS.adjective) {
        return ADJECTIVE_CONFIGS[lang];
    }
    if (pos === PoS.adverb) {
        return ADVERB_CONFIGS[lang];
    }
    if (pos === PoS.conjunction) {
        return CONJUNCTION_CONFIGS[lang];
    }
    if (pos === PoS.preposition) {
        return PREPOSITION_CONFIGS[lang];
    }
    return undefined;
}

export type {
    CaseName,
    CheckboxFieldConfig,
    FieldAdornment,
    FieldConfig,
    FieldGroup,
    FieldKind,
    FieldPattern,
    FieldVisibility,
    MultiSelectFieldConfig,
    OptionsLayout,
    RadioFieldConfig,
    RadioOption,
    SelectFieldConfig,
    TextFieldConfig,
    TranslationFormConfig,
} from './types';

// `matchesVisibility` is the one place the `visibleWhen`/`invert` comparison
// lives (`configs/types.ts`); the Review table's completion-ring denominator
// (`features/words/review/completion.ts`) needs the exact same comparison
// `TranslationCard.tsx` uses, so it is re-exported here rather than
// reimplemented against a second copy that could drift.
export { derivedStoredWord, isDerived, isStoredCheckbox, matchesVisibility } from './types';

export { coverageForLanguage } from './coverage';
