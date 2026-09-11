import type { Lang, PartOfSpeech } from '@/ts/enums';
import { PartOfSpeech as PoS } from '@/ts/enums';
import { NOUN_CONFIGS } from './nouns';
import type { TranslationFormConfig } from './types';

/**
 * `(PartOfSpeech, Lang) -> TranslationFormConfig`. Only Noun ships in Phase 2;
 * Verb / Adjective / Adverb are Phase 3 configs against the same registry-driven
 * pattern (`nouns.ts`), added as more branches here.
 */
export function getFormConfig(pos: PartOfSpeech, lang: Lang): TranslationFormConfig | undefined {
    if (pos === PoS.noun) {
        return NOUN_CONFIGS[lang];
    }
    return undefined;
}

export type {
    CaseName,
    CheckboxFieldConfig,
    FieldConfig,
    FieldKind,
    RadioFieldConfig,
    RadioOption,
    TextFieldConfig,
    TranslationFormConfig,
} from './types';
