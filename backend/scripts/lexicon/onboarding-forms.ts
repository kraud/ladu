/**
 * Precomputes the forms of the onboarding pool (.context/plans/onboarding.md, Slice 3a, decision D20).
 * For every `keep` concept of scripts/onboarding/pool.tsv it runs the "Start from a word" draft
 * lookup (services/dictionary/draft.ts) once per language: the local lexicon in DATABASE_URL, then
 * the usual fallbacks (Ekilex for Estonian, needs EKILEX_API_KEY). A translation is kept only when
 * the lookup found it and it has the key cases of the word list (lib/onboardingPool.ts KEY_CASES).
 *
 * Output: scripts/onboarding/pool-forms.json (committed, one concept per line). Onboarding reads
 * it at runtime and makes no lookups. Run it again after every edit of pool.tsv; the Jest test
 * onboardingPool.test.js fails while the two files disagree.
 *
 *   cd backend && npx tsx scripts/lexicon/onboarding-forms.ts
 */

const fs: typeof import('fs') = require('fs');
const path: typeof import('path') = require('path');
const { readPool, hasKeyCases, pluralOnlyCases, adverbPoolCases, PLURAL_ONLY_NOUNS_EN, FORMS_FILE }: typeof import('../../lib/onboardingPool') = require('../../lib/onboardingPool');
const { draft }: typeof import('../../services/dictionary/draft') = require('../../services/dictionary/draft');
const { pool: dbPool }: typeof import('../../src/db') = require('../../src/db');
type ConceptForms = import('../../lib/onboardingPool').ConceptForms;

/** Concepts looked up at the same time (each one runs its languages in parallel). Polite to Ekilex. */
const PARALLEL = 4;
const GENDER_CASE: Record<string, string> = { Spanish: 'genderES', German: 'genderDE' };

async function main(): Promise<void> {
    const concepts = readPool().filter((concept) => concept.status === 'keep');
    const forms: Record<string, ConceptForms> = {};
    const missing: string[] = [];
    const unusable: string[] = [];

    let next = 0;
    const worker = async (): Promise<void> => {
        while (next < concepts.length) {
            const concept = concepts[next++];
            const picks = Object.entries(concept.words).map(([language, { word, gender }]) => ({ language, word, ...(gender ? { gender } : {}) }));
            const results = await draft(concept.partOfSpeech, picks);
            const entry: ConceptForms = {};
            for (const result of results) {
                const cases = Object.fromEntries(result.cases.map((c) => [c.caseName, c.word]));
                // A lexicon row may lack the gender ("Teller", "sartén"); the pool has the hub's gender,
                // as the "Start from a word" form fills it from the draft.
                const genderCase = GENDER_CASE[result.language];
                if (concept.partOfSpeech === 'Noun' && genderCase && !cases[genderCase] && result.gender) cases[genderCase] = result.gender;
                // A plural-only English noun has no lexicon entry: its forms are built from the word.
                if (concept.partOfSpeech === 'Noun' && result.language === 'English' && result.status === 'not-found'
                    && PLURAL_ONLY_NOUNS_EN.includes(result.word.toLowerCase())) {
                    entry[result.language] = { word: result.word, cases: pluralOnlyCases(result.word) };
                    continue;
                }
                const usable = (result.status === 'found' || result.status === 'partial') && hasKeyCases(concept.partOfSpeech, result.language, cases, result.word);
                if (usable) entry[result.language] = { word: result.word, cases: concept.partOfSpeech === 'Adverb' ? adverbPoolCases(result.language, cases) : cases };
                else missing.push(`${concept.id} ${result.language} "${result.word}" (${result.status})`);
            }
            forms[concept.id] = entry;
            if (Object.keys(entry).length < 2) unusable.push(concept.id);
            const done = Object.keys(forms).length;
            if (done % 50 === 0) console.log(`${done}/${concepts.length}`);
        }
    };
    await Promise.all(Array.from({ length: PARALLEL }, worker));

    // Pool order, one concept per line: readable diffs.
    const lines = concepts.map((concept) => `    ${JSON.stringify(concept.id)}: ${JSON.stringify(forms[concept.id])}`);
    fs.writeFileSync(FORMS_FILE, [
        '{',
        '  "format": "ladu-onboarding-forms/1",',
        `  "generatedAt": ${JSON.stringify(new Date().toISOString())},`,
        '  "concepts": {',
        lines.join(',\n'),
        '  }',
        '}',
        '',
    ].join('\n'));

    console.log(`wrote ${path.relative(process.cwd(), FORMS_FILE)}: ${concepts.length} concepts`);
    console.log(`translations left out (lookup missed or key cases missing): ${missing.length}`);
    missing.forEach((line) => console.log(`  ${line}`));
    console.log(`concepts with fewer than 2 languages (onboarding skips them; consider "drop"): ${unusable.length}`);
    if (unusable.length) console.log(`  ${unusable.join(' ')}`);
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => dbPool.end());
