/**
 * The languages Ladu supports: the one table on the server.
 *
 * Adding a language starts here (guide: .context/guides/add-language.md). The key is the name
 * the database stores (`translations.language`, `users.languages`) and the `Lang` enum value of
 * the frontend (`frontend/src/ts/enums.ts`). A test checks that both lists are equal.
 *
 * - `suffix`: the last two letters of every case name (`singularES`) and the `?sort=` key.
 * - `wiktionary`: the language code of the kaikki dump and of the frequency lists. It is not
 *   always the suffix: Estonian is `EE` in the app and `et` in the dump.
 *
 * `scripts/lexicon/load.js` (plain JavaScript) reads this table when it needs it, after it has
 * registered `tsx`, as it does for `lib/lexicon/searchKey`.
 */
export const LANGUAGE_INFO = {
    English: { suffix: 'EN', wiktionary: 'en' },
    Spanish: { suffix: 'ES', wiktionary: 'es' },
    German: { suffix: 'DE', wiktionary: 'de' },
    Estonian: { suffix: 'EE', wiktionary: 'et' },
    French: { suffix: 'FR', wiktionary: 'fr' },
} as const satisfies Record<string, { suffix: string; wiktionary: string }>;

export type LanguageName = keyof typeof LANGUAGE_INFO;
export type WiktionaryCode = (typeof LANGUAGE_INFO)[LanguageName]['wiktionary'];

/** In display order. */
export const LANGUAGE_NAMES = Object.keys(LANGUAGE_INFO) as LanguageName[];

/** English is the hub of the translation table: every sense is an English sense. */
export const HUB_LANGUAGE: LanguageName = 'English';

/** The languages a sense can be translated into (everything but the hub). */
export const TRANSLATION_TARGETS = LANGUAGE_NAMES.filter((name) => name !== HUB_LANGUAGE);

/** `'Spanish'` → `'ES'`. */
export const LANGUAGE_SUFFIX = Object.fromEntries(
    LANGUAGE_NAMES.map((name) => [name, LANGUAGE_INFO[name].suffix]),
) as Record<LanguageName, string>;

/** `'ES'` → `'Spanish'`. */
export const LANGUAGE_BY_SUFFIX = Object.fromEntries(
    LANGUAGE_NAMES.map((name) => [LANGUAGE_INFO[name].suffix, name]),
) as Record<string, LanguageName>;

/** `'et'` → `'Estonian'`, for every language but the hub. */
export const TARGET_BY_WIKTIONARY_CODE = Object.fromEntries(
    TRANSLATION_TARGETS.map((name) => [LANGUAGE_INFO[name].wiktionary, name]),
) as Record<string, LanguageName>;
