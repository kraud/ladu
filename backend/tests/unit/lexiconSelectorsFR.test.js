/**
 * French lexicon selectors (lib/lexicon/selectors/fr.ts) against real kaikki entries.
 * Fixture: tests/unit/fixtures/lexicon-fr.json (Wiktionary excerpts, CC BY-SA 4.0).
 * Plan: .context/plans/language-french.md, slice 8 results and slices 9a (nouns … prepositions) and 9b (verbs).
 */
const { selectCases } = require('../../lib/lexicon/select');
const { NOUN_SELECTORS_FR, VERB_SELECTORS_FR, ADJECTIVE_SELECTORS_FR, ADVERB_SELECTORS_FR, CONJUNCTION_SELECTORS_FR, PREPOSITION_SELECTORS_FR } = require('../../lib/lexicon/selectors/fr');
const { entries } = require('./fixtures/lexicon-fr.json');

const find = (word, pos) => entries.find((e) => e.word === word && e.pos === pos);
const cases = (word, pos, selectors) => Object.fromEntries(selectCases(find(word, pos), selectors));
const verb = (word) => cases(word, 'verb', VERB_SELECTORS_FR);
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

describe('French verb selectors', () => {
    test('a regular -er verb fills every field of the v2 form: 18 tense boxes, 6 passé composé boxes, both participles', () => {
        expect(verb('aimer')).toEqual({
            infinitiveFR: 'aimer', verbGroupFR: '1er groupe', auxVerbFR: 'avoir', reflexivityFR: 'Not reflexive',
            pastParticipleFR: 'aimé', presentParticipleFR: 'aimant',
            indicativePresent1sFR: 'aime', indicativePresent2sFR: 'aimes', indicativePresent3sFR: 'aime',
            indicativePresent1plFR: 'aimons', indicativePresent2plFR: 'aimez', indicativePresent3plFR: 'aiment',
            indicativeImperfect1sFR: 'aimais', indicativeImperfect2sFR: 'aimais', indicativeImperfect3sFR: 'aimait',
            indicativeImperfect1plFR: 'aimions', indicativeImperfect2plFR: 'aimiez', indicativeImperfect3plFR: 'aimaient',
            indicativeSimpleFuture1sFR: 'aimerai', indicativeSimpleFuture2sFR: 'aimeras', indicativeSimpleFuture3sFR: 'aimera',
            indicativeSimpleFuture1plFR: 'aimerons', indicativeSimpleFuture2plFR: 'aimerez', indicativeSimpleFuture3plFR: 'aimeront',
            indicativePerfect1sFR: 'aimé', indicativePerfect2sFR: 'aimé', indicativePerfect3sFR: 'aimé',
            indicativePerfect1plFR: 'aimé', indicativePerfect2plFR: 'aimé', indicativePerfect3plFR: 'aimé',
        });
    });

    test('the verb group comes from the infinitive: -ir with -issant is 2e, aller and the other -ir, -oir, -re verbs are 3e', () => {
        expect(verb('finir')).toMatchObject({ verbGroupFR: '2e groupe', presentParticipleFR: 'finissant', indicativePresent1plFR: 'finissons' });
        expect(verb('partir').verbGroupFR).toBe('3e groupe');
        expect(verb('aller').verbGroupFR).toBe('3e groupe');
        expect(verb('être').verbGroupFR).toBe('3e groupe');
    });

    test('irregular verbs keep their irregular forms', () => {
        expect(verb('aller')).toMatchObject({ indicativePresent1sFR: 'vais', indicativePresent3plFR: 'vont', indicativeSimpleFuture3sFR: 'ira' });
        expect(verb('être')).toMatchObject({ pastParticipleFR: 'été', indicativePresent1sFR: 'suis', indicativeImperfect2sFR: 'étais' });
    });

    test('the auxiliary comes from the text row; a verb that takes both leaves it empty (decision Q1)', () => {
        expect(verb('aimer').auxVerbFR).toBe('avoir');
        expect(verb('aller').auxVerbFR).toBe('être');
        expect(verb('être').auxVerbFR).toBe('avoir');
        expect(verb('partir')).not.toHaveProperty('auxVerbFR');
        // The passé composé boxes still fill: the auxiliary is only their adornment.
        expect(verb('partir').indicativePerfect2plFR).toBe('parti');
    });

    test('a verb that also has a pronominal table is "Optionally reflexive"; its forms come from the plain table', () => {
        expect(verb('laver')).toMatchObject({ infinitiveFR: 'laver', reflexivityFR: 'Optionally reflexive', auxVerbFR: 'avoir', indicativePresent1sFR: 'lave', presentParticipleFR: 'lavant' });
    });

    test('a pronominal table whose rows carry no `reflexive` tag ("appeler") is told apart by its infinitive', () => {
        expect(verb('appeler')).toMatchObject({
            infinitiveFR: 'appeler', reflexivityFR: 'Optionally reflexive', indicativePresent1sFR: 'appelle', indicativePresent1plFR: 'appelons', auxVerbFR: 'avoir',
        });
    });

    test('a verb with only a pronominal table is "Always reflexive": the infinitive keeps "se", the forms lose the pronoun, the auxiliary is être', () => {
        expect(verb('se souvenir')).toMatchObject({
            infinitiveFR: 'se souvenir', reflexivityFR: 'Always reflexive', auxVerbFR: 'être', verbGroupFR: '3e groupe',
            presentParticipleFR: 'souvenant', pastParticipleFR: 'souvenu',
            indicativePresent1sFR: 'souviens', indicativePresent3sFR: 'souvient', indicativePresent1plFR: 'souvenons', indicativePresent3plFR: 'souviennent',
            indicativeImperfect1sFR: 'souvenais', indicativeSimpleFuture3plFR: 'souviendront', indicativePerfect1sFR: 'souvenu',
        });
    });

    test('the pronoun and the particle "en" are removed from pronominal forms', () => {
        const sEnAller = {
            word: "s'en aller", pos: 'verb', senses: [{ tags: ['pronominal'] }],
            forms: [
                { form: 'no-table-tags', tags: ['table-tags'] },
                { form: "s'en aller", tags: ['infinitive', 'reflexive'] },
                { form: "m'en vais", tags: ['first-person', 'indicative', 'present', 'singular', 'reflexive'] },
                { form: 'nous en allons', tags: ['first-person', 'indicative', 'plural', 'present', 'reflexive'] },
                { form: "s'en allant", tags: ['gerund', 'participle', 'present', 'reflexive'] },
            ],
        };
        expect(Object.fromEntries(selectCases(sEnAller, VERB_SELECTORS_FR))).toMatchObject({
            infinitiveFR: "s'en aller", verbGroupFR: '3e groupe', indicativePresent1sFR: 'vais', indicativePresent1plFR: 'allons', presentParticipleFR: 'allant',
        });
    });

    test('a verb with a placeholder row ("-") leaves that person empty: pleuvoir has the third person only', () => {
        const pleuvoir = verb('pleuvoir');
        expect(pleuvoir).toMatchObject({ indicativePresent3sFR: 'pleut', indicativePresent3plFR: 'pleuvent', indicativeSimpleFuture3sFR: 'pleuvra' });
        expect(pleuvoir).not.toHaveProperty('indicativePresent1sFR');
        expect(pleuvoir).not.toHaveProperty('indicativeImperfect2sFR');
    });

    test('text rows ("avoir + past participle") and IPA rows are never taken as forms', () => {
        const values = Object.values(verb('aimer'));
        expect(values.some((value) => /participle|\+/.test(value))).toBe(false);
        expect(values.some((value) => ['ɛ', 'ɑ', 'ʒ', '\u0303'].some((sign) => value.includes(sign)))).toBe(false);
    });

    test('an entry with no conjugation table fills nothing but the reflexivity guess', () => {
        const stub = { word: 'peut', pos: 'verb', forms: [], senses: [{ tags: [] }] };
        expect(Object.fromEntries(selectCases(stub, VERB_SELECTORS_FR))).toEqual({ reflexivityFR: 'Not reflexive' });
    });
});
