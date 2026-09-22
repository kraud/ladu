import { Lang, PartOfSpeech } from '@/ts/enums';
import { ADJECTIVE_CONFIGS } from './adjectives';
import { ADVERB_CONFIGS } from './adverbs';
import { NOUN_CONFIGS } from './nouns';
import { VERB_CONFIGS } from './verbs';

/** All four parts of speech, in registration/tile display order. */
const ALL_POS: readonly PartOfSpeech[] = [
    PartOfSpeech.noun,
    PartOfSpeech.verb,
    PartOfSpeech.adjective,
    PartOfSpeech.adverb,
];

const CONFIGS_BY_POS: Record<PartOfSpeech, Partial<Record<Lang, unknown>>> = {
    [PartOfSpeech.noun]: NOUN_CONFIGS,
    [PartOfSpeech.verb]: VERB_CONFIGS,
    [PartOfSpeech.adjective]: ADJECTIVE_CONFIGS,
    [PartOfSpeech.adverb]: ADVERB_CONFIGS,
    // The remaining PartOfSpeech members have no form engine at all (Phase 3
    // only models noun/verb/adjective/adverb) — every language covers none
    // of them, so they never appear in a tile's coverage line.
    [PartOfSpeech.preposition]: {},
    [PartOfSpeech.conjunction]: {},
    [PartOfSpeech.pronoun]: {},
    [PartOfSpeech.interjection]: {},
    [PartOfSpeech.properNoun]: {},
    [PartOfSpeech.numerals]: {},
};

/**
 * The parts of speech a language actually has a form config for, in
 * `ALL_POS` order. Backs the registration language tiles' coverage line
 * (`MOCKUPS/auth/register.html`'s "noun · verb · adjective") with real
 * data instead of hardcoded copy — Estonian has no adverb config
 * (`configs/index.ts`), so its tile correctly lists three, not four.
 *
 * Reads the four PoS config maps directly (not `getFormConfig` in
 * `./index`) to avoid a circular import with that barrel file.
 */
export function coverageForLanguage(lang: Lang): PartOfSpeech[] {
    return ALL_POS.filter((pos) => CONFIGS_BY_POS[pos][lang] !== undefined);
}
