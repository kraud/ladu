import { Lang, PartOfSpeech } from '@/ts/enums';
import { ADJECTIVE_CONFIGS } from './adjectives';
import { ADVERB_CONFIGS } from './adverbs';
import { CONJUNCTION_CONFIGS } from './conjunctions';
import { NOUN_CONFIGS } from './nouns';
import { VERB_CONFIGS } from './verbs';

/** The parts of speech with a form config, in registration/tile display order. */
const ALL_POS: readonly PartOfSpeech[] = [
    PartOfSpeech.noun,
    PartOfSpeech.verb,
    PartOfSpeech.adjective,
    PartOfSpeech.adverb,
    PartOfSpeech.conjunction,
];

const CONFIGS_BY_POS: Record<PartOfSpeech, Partial<Record<Lang, unknown>>> = {
    [PartOfSpeech.noun]: NOUN_CONFIGS,
    [PartOfSpeech.verb]: VERB_CONFIGS,
    [PartOfSpeech.adjective]: ADJECTIVE_CONFIGS,
    [PartOfSpeech.adverb]: ADVERB_CONFIGS,
    // The remaining PartOfSpeech members have no form engine at all — every language covers none
    // of them, so they never appear in a tile's coverage line.
    [PartOfSpeech.conjunction]: CONJUNCTION_CONFIGS,
    [PartOfSpeech.preposition]: {},
    [PartOfSpeech.pronoun]: {},
    [PartOfSpeech.interjection]: {},
    [PartOfSpeech.properNoun]: {},
    [PartOfSpeech.numerals]: {},
};

/**
 * The parts of speech a language actually has a form config for, in
 * `ALL_POS` order. Backs the registration language tiles' coverage line
 * (`MOCKUPS/auth/register.html`'s "noun · verb · adjective") with real
 * data instead of hardcoded copy — a language without a config for a part of
 * speech lists fewer (Estonian listed three before the adverb form of Slice H4).
 *
 * Reads the PoS config maps directly (not `getFormConfig` in
 * `./index`) to avoid a circular import with that barrel file.
 */
export function coverageForLanguage(lang: Lang): PartOfSpeech[] {
    return ALL_POS.filter((pos) => CONFIGS_BY_POS[pos][lang] !== undefined);
}
