/**
 * The PLACEHOLDER seed of a demo account (demo-access.md, Slice 1). Slice 2 replaces it with a
 * clone of the template user (`scripts/seed-demo-template.ts`), so the content can change without a
 * code change. Until then: five nouns in the four languages, two Private tags and one saved
 * practice config. No practice session (D5).
 */
const { words, translations, translationCases, tags, tagWords, practiceConfigs } = require("../src/db/schema");
const { db }: typeof import("../src/db") = require("../src/db");

type Executor = Pick<typeof db, "insert">;

interface SeedNoun {
  key: string;
  English: [string, string];
  Spanish: [string, string, string];
  German: [string, string, string];
  Estonian: [string, string];
}

// [singular, plural] for English and Estonian; [gender, singular, plural] for Spanish and German.
const NOUNS: SeedNoun[] = [
  { key: "house", English: ["house", "houses"], Spanish: ["la", "casa", "casas"], German: ["das", "Haus", "Häuser"], Estonian: ["maja", "majad"] },
  { key: "book", English: ["book", "books"], Spanish: ["el", "libro", "libros"], German: ["das", "Buch", "Bücher"], Estonian: ["raamat", "raamatud"] },
  { key: "apple", English: ["apple", "apples"], Spanish: ["la", "manzana", "manzanas"], German: ["der", "Apfel", "Äpfel"], Estonian: ["õun", "õunad"] },
  { key: "dog", English: ["dog", "dogs"], Spanish: ["el", "perro", "perros"], German: ["der", "Hund", "Hunde"], Estonian: ["koer", "koerad"] },
  { key: "cat", English: ["cat", "cats"], Spanish: ["el", "gato", "gatos"], German: ["die", "Katze", "Katzen"], Estonian: ["kass", "kassid"] },
];

const TAGS: { label: string; description: string; words: string[] }[] = [
  { label: "Home", description: "Things around the house", words: ["house", "book"] },
  { label: "Animals", description: "Pets and other animals", words: ["dog", "cat"] },
];

/** A saved config, valid under `validateConfigRequest` (a Jest test checks it). */
export const SEED_PRACTICE_CONFIG = {
  name: "Jump in — mixed practice",
  description: "Multiple choice across all your languages",
  params: {
    languages: ["English", "Spanish", "German", "Estonian"],
    partsOfSpeech: ["Noun"],
    amount: 10,
    type: "Multiple-Choice",
    multiLang: "Multi-Language",
    difficultyMC: 2,
    strictnessTI: 3,
    wordSelection: "Random",
    excludeNative: true,
  },
};

/** What the seed adds. The demo's frozen caps are these plus the configured maximums (D3, D7). */
export const SEED_COUNTS = { words: NOUNS.length, tags: TAGS.length } as const;

const casesOf = (noun: SeedNoun): Record<string, { caseName: string; word: string }[]> => ({
  English: [
    { caseName: "singularEN", word: noun.English[0] },
    { caseName: "pluralEN", word: noun.English[1] },
  ],
  Spanish: [
    { caseName: "genderES", word: noun.Spanish[0] },
    { caseName: "singularES", word: noun.Spanish[1] },
    { caseName: "pluralES", word: noun.Spanish[2] },
  ],
  German: [
    { caseName: "genderDE", word: noun.German[0] },
    { caseName: "singularNominativDE", word: noun.German[1] },
    { caseName: "pluralNominativDE", word: noun.German[2] },
  ],
  Estonian: [
    { caseName: "singularNimetavEE", word: noun.Estonian[0] },
    { caseName: "pluralNimetavEE", word: noun.Estonian[1] },
  ],
});

/** Inserts the placeholder data for `userId`, inside the caller's transaction. */
export const seedDemoData = async (tx: Executor, userId: string): Promise<void> => {
  const wordIdByKey = new Map<string, string>();

  for (const noun of NOUNS) {
    const [word] = await tx.insert(words).values({ userId, partOfSpeech: "Noun" }).returning({ id: words.id });
    wordIdByKey.set(noun.key, word.id);
    for (const [language, cases] of Object.entries(casesOf(noun))) {
      const [translation] = await tx.insert(translations).values({ wordId: word.id, language }).returning({ id: translations.id });
      await tx.insert(translationCases).values(cases.map((c) => ({ translationId: translation.id, ...c })));
    }
  }

  for (const tag of TAGS) {
    const [row] = await tx
      .insert(tags)
      .values({ authorId: userId, label: tag.label, description: tag.description, visibility: "Private" })
      .returning({ id: tags.id });
    await tx.insert(tagWords).values(tag.words.map((key) => ({ tagId: row.id, wordId: wordIdByKey.get(key) as string })));
  }

  await tx.insert(practiceConfigs).values({ userId, ...SEED_PRACTICE_CONFIG, wordIds: null, tagIds: null });
};
