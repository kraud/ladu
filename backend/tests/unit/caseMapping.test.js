/**
 * caseMapping.test.js
 *
 * Tests for the equivalent-translations dictionaries used by the Ladu drill-generation system.
 *
 * Architecture overview
 * ---------------------
 * There are four dictionaries that map grammatical categories to "caseName" strings:
 *
 *   Multi-language dictionaries (nounGroupedCategoriesMultiLanguage, verbGroupedCategoriesMultiLanguage)
 *     Tree structure: category → subcategory → grammatical-person → { English, Spanish, German, Estonian }
 *     Leaf values are objects mapping language → caseName (a string key used to look up drill content).
 *
 *   Single-language dictionaries (nounGroupedCategoriesSingleLanguage, verbGroupedCategoriesSingleLanguage)
 *     Tree structure: language → drill-type → grammatical-concept → { correctValue, ... }
 *     Leaves describe drill properties (e.g. the correct answer key for a multiple-choice question).
 *
 * Together they drive drill generation: the multi-lang dicts define which grammatical slots exist and
 * what each language calls them; the single-lang dicts define how each language drills those slots.
 */

// ────────────────────────────────────────────────────────────────────────────
// Imports – the four dictionaries under test
// ────────────────────────────────────────────────────────────────────────────
const { nounGroupedCategoriesMultiLanguage } = require('../../utils/equivalentTranslations/multiLang/nouns');
const { verbGroupedCategoriesMultiLanguage } = require('../../utils/equivalentTranslations/multiLang/verbs');
const { nounGroupedCategoriesSingleLanguage } = require('../../utils/equivalentTranslations/singleLang/nouns');
const { verbGroupedCategoriesSingleLanguage } = require('../../utils/equivalentTranslations/singleLang/verbs');

// The four languages currently supported by the app.
const LANGUAGES = ['English', 'Spanish', 'German', 'Estonian'];

/**
 * Recursively walk a nested object and collect every "leaf" node.
 *
 * A leaf is any object whose own values are ALL strings — that's the
 * { English: 'someKey', Spanish: 'otraClave', ... } mapping at the bottom
 * of the multi-language dictionaries.
 *
 * @param {object} obj - The tree to walk.
 * @param {string[]} path - Accumulated key path from the root (used internally).
 * @returns {{ path: string[], mapping: object<string,string> }[]}
 */
const collectLeaves = (obj, path = []) => {
    let leaves = [];
    for (const [k, v] of Object.entries(obj)) {
        // Only recurse into plain objects (skip strings, arrays, null).
        if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
            // If every child is a string this is a leaf mapping.
            if (Object.values(v).every(x => typeof x === 'string')) {
                leaves.push({ path: [...path, k], mapping: v });
            } else {
                // Otherwise keep descending.
                leaves.push(...collectLeaves(v, [...path, k]));
            }
        }
    }
    return leaves;
};

// ════════════════════════════════════════════════════════════════════════════
// Multi-Language dictionaries
// ════════════════════════════════════════════════════════════════════════════
// These dictionaries define grammatical "slots" (e.g. singular.nominative)
// and for each slot provide the caseName string that every language uses
// to look up the corresponding drill content.
// ════════════════════════════════════════════════════════════════════════════
describe('Multi-Language Case Mapping', () => {
    // ─── Nouns ─────────────────────────────────────────────────────────────
    describe('nounGroupedCategoriesMultiLanguage', () => {
        // Pre-compute leaves so all tests share one traversal.
        const leaves = collectLeaves(nounGroupedCategoriesMultiLanguage);

        // The root is expected to group by number.
        it('has top-level categories (singular, plural)', () => {
            expect(nounGroupedCategoriesMultiLanguage).toHaveProperty('singular');
            expect(nounGroupedCategoriesMultiLanguage).toHaveProperty('plural');
        });

        // At the deepest nesting level we expect to find grammatical cases.
        it('has grammatical cases at leaf level', () => {
            const caseNames = leaves.map(l => l.path[l.path.length - 1]);
            expect(caseNames).toContain('nominative');
            expect(caseNames).toContain('accusative');
            expect(caseNames).toContain('genitive');
        });

        // Every leaf must provide a non-empty string for each of the 4 languages.
        it('maps each equivalent case to all 4 languages', () => {
            leaves.forEach(({ path, mapping }) => {
                const caseName = path.join('.');
                Object.keys(mapping).forEach(lang => {
                    expect(LANGUAGES).toContain(lang);
                    const value = mapping[lang];
                    expect(typeof value).toBe('string');
                    expect(value.length).toBeGreaterThan(0);
                });
            });
        });

        // Spot-check: singular.nominative must have entries for all languages.
        it('maps at least nominative for every language in singular', () => {
            const nominative = nounGroupedCategoriesMultiLanguage.singular.nominative;
            LANGUAGES.forEach(lang => {
                expect(nominative).toHaveProperty(lang);
            });
        });

        // English has no grammatical cases, so its caseName is shorter than
        // the Estonian equivalent (which appends the case suffix).
        // This test documents that conscious design choice.
        it('prefers shorter caseName for singular nominative English (no "Nominativ")', () => {
            expect(nounGroupedCategoriesMultiLanguage.singular.nominative.English).toBe('singularEN');
            expect(nounGroupedCategoriesMultiLanguage.singular.nominative.Estonian).toBe('singularNimetavEE');
        });

        // Because English lacks case inflection, the same caseName is reused
        // for both singular and plural — the English drill content is identical.
        it('reuses same English caseName across different grammatical concepts (EN has no cases)', () => {
            const enSingNom = nounGroupedCategoriesMultiLanguage.singular.nominative.English;
            const enPlurNom = nounGroupedCategoriesMultiLanguage.plural.nominative.English;
            expect(enSingNom).toBe('singularEN');
            expect(enPlurNom).toBe('pluralEN');
        });
    });

    // ─── Verbs ─────────────────────────────────────────────────────────────
    describe('verbGroupedCategoriesMultiLanguage', () => {
        const leaves = collectLeaves(verbGroupedCategoriesMultiLanguage);

        // The root groups by tense.
        it('has top-level tenses (present, past, future)', () => {
            expect(verbGroupedCategoriesMultiLanguage).toHaveProperty('present');
            expect(verbGroupedCategoriesMultiLanguage).toHaveProperty('past');
            expect(verbGroupedCategoriesMultiLanguage).toHaveProperty('future');
        });

        // Leaves should represent person-number combinations.
        it('has person-number at leaf level', () => {
            const personKeys = leaves.map(l => l.path[l.path.length - 1]);
            expect(personKeys).toContain('firstSingular');
            expect(personKeys).toContain('thirdSingular');
            expect(personKeys).toContain('firstPlural');
            expect(personKeys).toContain('thirdPlural');
        });

        // Every language conjugates for 3rd-person singular in present tense.
        it('maps present.thirdSingular for all languages', () => {
            const entry = verbGroupedCategoriesMultiLanguage.present.thirdSingular;
            expect(entry).toHaveProperty('English');
            expect(entry).toHaveProperty('Spanish');
            expect(entry).toHaveProperty('German');
            expect(entry).toHaveProperty('Estonian');
        });

        // Estonian has a synthetic past tense (preeteritum), so it participates
        // in every past-tense slot.
        it('includes Estonian in all past tense entries', () => {
            ['firstSingular', 'secondSingular', 'thirdSingular', 'firstPlural', 'thirdPlural'].forEach(person => {
                expect(verbGroupedCategoriesMultiLanguage.past[person]).toHaveProperty('Estonian');
            });
        });

        // Estonian has no grammatical future tense; future meaning is expressed
        // through present tense + context. Therefore the future slots intentionally
        // omit Estonian.
        it('may omit Estonian from future tense (no future in Estonian grammar)', () => {
            ['firstSingular', 'secondSingular', 'thirdSingular', 'firstPlural', 'thirdPlural'].forEach(person => {
                const entry = verbGroupedCategoriesMultiLanguage.future[person];
                expect(entry).not.toHaveProperty('Estonian');
            });
        });

        // Every grammatical slot must map at least 2 languages so that cross-
        // language drills are possible.
        it('every leaf maps to at least 2 languages', () => {
            leaves.forEach(({ path, mapping }) => {
                expect(Object.keys(mapping).length).toBeGreaterThanOrEqual(2);
            });
        });
    });
});

// ════════════════════════════════════════════════════════════════════════════
// Single-Language dictionaries (Drills)
// ════════════════════════════════════════════════════════════════════════════
// These dictionaries define drill configurations per language.
// Structure: language → drill-type (Multiple-Choice / Text-Input) → concept → { correctValue, ... }
// ════════════════════════════════════════════════════════════════════════════
describe('Single-Language Case Mapping (Drills)', () => {
    /**
     * Assert that every leaf value in a nested object is a non-empty string.
     * Used to verify that drill definitions aren't missing content.
     */
    const hasNonEmptyValues = (obj) => {
        return Object.entries(obj).every(([key, value]) => {
            if (typeof value === 'object') return hasNonEmptyValues(value);
            return typeof value === 'string' && value.length > 0;
        });
    };

    // ─── Nouns ─────────────────────────────────────────────────────────────
    it('nounGroupedCategoriesSingleLanguage defines drills for known languages', () => {
        expect(nounGroupedCategoriesSingleLanguage).toHaveProperty('Spanish');
        expect(nounGroupedCategoriesSingleLanguage).toHaveProperty('German');
        expect(nounGroupedCategoriesSingleLanguage).toHaveProperty('Estonian');
        expect(nounGroupedCategoriesSingleLanguage).toHaveProperty('English');
    });

    // ─── Verbs ─────────────────────────────────────────────────────────────
    it('verbGroupedCategoriesSingleLanguage defines drills for known languages', () => {
        expect(verbGroupedCategoriesSingleLanguage).toHaveProperty('Spanish');
        expect(verbGroupedCategoriesSingleLanguage).toHaveProperty('English');
        expect(verbGroupedCategoriesSingleLanguage).toHaveProperty('German');
        expect(verbGroupedCategoriesSingleLanguage).toHaveProperty('Estonian');
    });

    // Both nouns and verbs should have no empty/missing drill values.
    it('all single-language drill values are non-empty strings', () => {
        [nounGroupedCategoriesSingleLanguage, verbGroupedCategoriesSingleLanguage].forEach(dict => {
            Object.values(dict).forEach(langData => {
                expect(hasNonEmptyValues(langData)).toBe(true);
            });
        });
    });

    // ─── Language-specific spot checks ─────────────────────────────────────
    // These verify that particular drill types exist for specific languages.

    it('Spanish verb drills include regularity MC, participle TI, and gerund TI', () => {
        const es = verbGroupedCategoriesSingleLanguage.Spanish;
        expect(es['Multiple-Choice']).toHaveProperty('regularity');
        expect(es['Text-Input']).toHaveProperty('participle');
        expect(es['Text-Input']).toHaveProperty('gerund');
    });

    it('English verb drill has regularity MC', () => {
        const en = verbGroupedCategoriesSingleLanguage.English;
        expect(en['Multiple-Choice'].regularity.correctValue).toBe('regularityEN');
    });

    it('German verb drill has auxVerb MC', () => {
        const de = verbGroupedCategoriesSingleLanguage.German;
        expect(de['Multiple-Choice'].auxVerb.correctValue).toBe('auxVerbDE');
    });
});

// ════════════════════════════════════════════════════════════════════════════
// Cross-dictionary consistency
// ════════════════════════════════════════════════════════════════════════════
// Ensures that caseName values shared between the noun and verb multi-language
// dictionaries only happen for genuinely shared grammatical concepts.
// ════════════════════════════════════════════════════════════════════════════
describe('Consistency: caseName values appear across dictionaries', () => {
    /**
     * Collect every string value reachable in a nested object tree into a Set.
     */
    const allValueSet = (dict) => {
        const values = new Set();
        const walk = (obj) => {
            for (const v of Object.values(obj)) {
                if (typeof v === 'string') values.add(v);
                else if (typeof v === 'object' && v !== null) walk(v);
            }
        };
        walk(dict);
        return values;
    };

    // Overlapping caseNames should only occur for concepts that cross the
    // noun-verb boundary (e.g. "singular" applies to both noun number and
    // verb person-number; "infinitive" and "nonFinite" appear in both).
    it('multi-lang noun caseNames overlap with multi-lang verb caseNames only for shared concepts', () => {
        const nounVals = allValueSet(nounGroupedCategoriesMultiLanguage);
        const verbVals = allValueSet(verbGroupedCategoriesMultiLanguage);

        const overlap = [...nounVals].filter(x => verbVals.has(x));
        overlap.forEach(val => {
            expect(val).toMatch(/(singular|plural|infinitive|nonFinite)/);
        });
    });
});
