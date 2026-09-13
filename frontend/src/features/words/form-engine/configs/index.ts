import type { Lang, PartOfSpeech } from '@/ts/enums';
import { PartOfSpeech as PoS } from '@/ts/enums';
import { NOUN_CONFIGS } from './nouns';
import { VERB_CONFIGS } from './verbs';
import type { TranslationFormConfig } from './types';

/**
 * `(PartOfSpeech, Lang) -> TranslationFormConfig`. Noun and Verb ship;
 * Adjective / Adverb are Phase 3's remaining configs against the same
 * registry-driven pattern (`nouns.ts`), added as more branches here.
 */
export function getFormConfig(pos: PartOfSpeech, lang: Lang): TranslationFormConfig | undefined {
    if (pos === PoS.noun) {
        return NOUN_CONFIGS[lang];
    }
    if (pos === PoS.verb) {
        return VERB_CONFIGS[lang];
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
