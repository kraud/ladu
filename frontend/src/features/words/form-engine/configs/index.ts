import type { Lang, PartOfSpeech } from '@/ts/enums';
import { PartOfSpeech as PoS } from '@/ts/enums';
import { ADJECTIVE_CONFIGS } from './adjectives';
import { ADVERB_CONFIGS } from './adverbs';
import { NOUN_CONFIGS } from './nouns';
import { VERB_CONFIGS } from './verbs';
import type { TranslationFormConfig } from './types';

/**
 * `(PartOfSpeech, Lang) -> TranslationFormConfig`. All four parts of speech
 * Phase 3 models ship. Adverb has no Estonian config at all (matching the old
 * app's own missing route), so that combination falls through to `undefined`
 * — `TranslationCard` already renders its "language not available" fallback.
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
    RadioFieldConfig,
    RadioOption,
    SelectFieldConfig,
    TextFieldConfig,
    TranslationFormConfig,
} from './types';
