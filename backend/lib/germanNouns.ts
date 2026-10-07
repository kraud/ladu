/**
 * German writes every noun with a capital first letter. The word forms of a
 * German noun are capitalized on save, so the stored data follows the rule
 * whatever client sent it. Only the first letter changes ("haus" -> "Haus");
 * the rest of the text stays as typed.
 *
 * The gender and regularity cases of a noun are not word forms and stay as they are.
 */
const GERMAN_NOUN_FORM = /^(singular|plural)(Nominativ|Akkusativ|Genitiv|Dativ)DE$/;

interface TranslationInput {
  language?: string;
  cases?: Array<{ caseName: string; word: string }>;
  [key: string]: unknown;
}

function capitalizeFirst(text: string): string {
  const first = text.charAt(0);
  return first.toUpperCase() + text.slice(1);
}

/** Returns the translations with the German noun forms capitalized. Other input is returned unchanged. */
function capitalizeGermanNouns<T extends TranslationInput>(partOfSpeech: unknown, translations: T[]): T[] {
  if (partOfSpeech !== "Noun" || !Array.isArray(translations)) return translations;
  return translations.map((translation) => {
    if (translation?.language !== "German" || !Array.isArray(translation.cases)) return translation;
    return {
      ...translation,
      cases: translation.cases.map((c) =>
        typeof c?.word === "string" && GERMAN_NOUN_FORM.test(c.caseName)
          ? { ...c, word: capitalizeFirst(c.word) }
          : c,
      ),
    };
  });
}

export { capitalizeGermanNouns };
