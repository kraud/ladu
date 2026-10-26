/**
 * French lexicon selectors (lib/lexicon/selectors/fr.ts) against real kaikki entries.
 * Fixture: tests/unit/fixtures/lexicon-fr.json (Wiktionary excerpts, CC BY-SA 4.0).
 * Plan: .context/plans/language-french.md, slice 8 results and slice 9a. Verb selectors come in slice 9b.
 */
const { selectCases } = require('../../lib/lexicon/select');
const { NOUN_SELECTORS_FR, ADJECTIVE_SELECTORS_FR, ADVERB_SELECTORS_FR, CONJUNCTION_SELECTORS_FR, PREPOSITION_SELECTORS_FR } = require('../../lib/lexicon/selectors/fr');
const { entries } = require('./fixtures/lexicon-fr.json');

const find = (word, pos) => entries.find((e) => e.word === word && e.pos === pos);
const cases = (word, pos, selectors) => Object.fromEntries(selectCases(find(word, pos), selectors));
const noun = (word) => cases(word, 'noun', NOUN_SELECTORS_FR);
const adjective = (word) => cases(word, 'adj', ADJECTIVE_SELECTORS_FR);
const adverb = (word) => cases(word, 'adv', ADVERB_SELECTORS_FR);

describe('French noun selectors', () => {
    test('gender, singular (the lemma) and plural', () => {
        expect(noun('maison')).toEqual({ genderFR: 'la', singularFR: 'maison', pluralFR: 'maisons' });
    });

    test('irregular plurals come from the plural row', () => {
        expect(noun('cheval')).toEqual({ genderFR: 'le', singularFR: 'cheval', pluralFR: 'chevaux' });
        expect(noun('œil')).toEqual({ genderFR: 'le', singularFR: 'œil', pluralFR: 'yeux' });
    });

    test('both genders in one sense → "le/la"', () => {
        expect(noun('enfant').genderFR).toBe('le/la');
    });

    test('an invariable noun repeats the lemma as its plural; a plural-only noun has no plural', () => {
        expect(noun('souris')).toMatchObject({ singularFR: 'souris', pluralFR: 'souris' });
        expect(noun('gens')).toEqual({ genderFR: 'le', singularFR: 'gens' });
    });

    test('the feminine counterpart ("chatte") is not stored', () => {
        const chat = { word: 'chat', pos: 'noun', forms: [{ form: 'chats', tags: ['plural'] }, { form: 'chatte', tags: ['feminine'] }], senses: [{ tags: ['masculine'] }] };
        expect(Object.fromEntries(selectCases(chat, NOUN_SELECTORS_FR))).toEqual({ genderFR: 'le', singularFR: 'chat', pluralFR: 'chats' });
    });
});

describe('French adjective selectors', () => {
    test('a gendered adjective fills the four agreement forms', () => {
        expect(adjective('grand')).toEqual({
            maleSingularFR: 'grand', femaleSingularFR: 'grande', malePluralFR: 'grands', femalePluralFR: 'grandes',
        });
        expect(adjective('vieux')).toMatchObject({ femaleSingularFR: 'vieille', malePluralFR: 'vieux', femalePluralFR: 'vieilles' });
    });

    test('an adjective with one shape for both genders: the feminine singular is the lemma, both plurals are the plural row', () => {
        expect(adjective('facile')).toEqual({
            maleSingularFR: 'facile', femaleSingularFR: 'facile', malePluralFR: 'faciles', femalePluralFR: 'faciles',
        });
    });

    test('an invariable adjective is the lemma in all four cells', () => {
        const [first] = entries.filter((e) => e.word === 'marron' && e.pos === 'adj');
        expect(Object.fromEntries(selectCases(first, ADJECTIVE_SELECTORS_FR))).toEqual({
            maleSingularFR: 'marron', femaleSingularFR: 'marron', malePluralFR: 'marron', femalePluralFR: 'marron',
        });
    });

    test('the vowel form is sent with its box (beau → bel, vieux → vieil); other adjectives send neither', () => {
        expect(adjective('beau')).toMatchObject({ vowelFormFR: 'bel', hasVowelFormFR: 'true' });
        expect(adjective('vieux')).toMatchObject({ vowelFormFR: 'vieil', hasVowelFormFR: 'true' });
        expect(adjective('grand')).not.toHaveProperty('vowelFormFR');
        expect(adjective('grand')).not.toHaveProperty('hasVowelFormFR');
    });

    test('only an irregular comparative has a row (bon → meilleur); the superlative is never sent', () => {
        expect(adjective('bon').comparativeFR).toBe('meilleur');
        expect(adjective('grand')).not.toHaveProperty('comparativeFR');
        expect(adjective('bon')).not.toHaveProperty('superlativeFR');
    });

    test('a "plus" comparative is sent as the box, without the phrase', () => {
        const rare = { word: 'rare', pos: 'adj', forms: [{ form: 'plus rare', tags: ['comparative'] }, { form: 'rares', tags: ['plural'] }], senses: [{ tags: [] }] };
        const result = Object.fromEntries(selectCases(rare, ADJECTIVE_SELECTORS_FR));
        expect(result.periphrasticFR).toBe('true');
        expect(result).not.toHaveProperty('comparativeFR');
    });
});

describe('French adverb selectors', () => {
    test('an irregular adverb is Gradable and takes its comparative; the superlative is locked in the form, so it is not sent', () => {
        expect(adverb('bien')).toEqual({ gradableFR: 'Gradable', adverbFR: 'bien', comparativeFR: 'mieux' });
    });

    test('an adverb with no degree row has the word only: the lexicon does not prove "Non-gradable"', () => {
        expect(adverb('vite')).toEqual({ adverbFR: 'vite' });
    });

    test('a "plus" comparative is sent as the box', () => {
        const vite = { word: 'vite', pos: 'adv', forms: [{ form: 'plus vite', tags: ['comparative'] }], senses: [{ tags: [] }] };
        expect(Object.fromEntries(selectCases(vite, ADVERB_SELECTORS_FR))).toEqual({ gradableFR: 'Gradable', adverbFR: 'vite', periphrasticFR: 'true' });
    });
});

describe('French conjunction and preposition selectors', () => {
    test('a conjunction gets its type only when the entry states one', () => {
        expect(cases('et', 'conj', CONJUNCTION_SELECTORS_FR)).toEqual({ conjunctionFR: 'et', conjunctionTypeFR: 'Coordinating' });
        expect(cases('parce que', 'conj', CONJUNCTION_SELECTORS_FR)).toEqual({ conjunctionFR: 'parce que', conjunctionTypeFR: 'Subordinating' });
    });

    test('a preposition gets the position of its entry', () => {
        expect(cases('dans', 'prep', PREPOSITION_SELECTORS_FR)).toEqual({ prepositionFR: 'dans', positionFR: 'Before the noun' });
    });
});
