# Slice G — "One term → whole Word" (plan)

*Status: DRAFT, open questions answered (2026-10-11); waiting for approval to start G1. Nothing is built. Parent plan:
`autocomplete-data-source-strategy.md` §9 (Slice G), decisions D1–D34 in §10.*

*Needs: Slice E (type-ahead), Slice F (translation table and route), Slice H (all four parts of
speech have forms). All are live on production.*

---

## 1. Goal

The user types **one word in any of the four languages**. Ladu lists the **senses** of that word.
The user picks one sense and sees a **preview**: the words of that sense in every language. The user
confirms. Ladu then fills one translation card per language (the forms come from the normal
lookup) and opens them in the normal Add Word form. The user checks the cards and saves.

Why this way:

- Design commandment 1 (fast entry): one word replaces up to four manual lookups.
- Design commandment 4 (all languages equal): any language can be the start.
- Design commandment 5/7: nothing is saved without a check. The cards show what is filled and
  what is missing (completion ring).
- The solo manual path (pick a part of speech, fill cards) stays unchanged.

**Out of scope:** saving a Word without the form; browsing words (Slice I); the German object
cases (Slice H follow-up); parts of speech other than Noun, Verb, Adjective, Adverb.

---

## 2. User flow

1. The user opens `/addWord`. Above the part-of-speech list there is a new section **"Start from a
   word"**. An "—— or ——" line separates it from the list (same style as the auth forms,
   `OAuthButtons.tsx`).
2. The section has three controls: a **language** select (only the languages of the user's account;
   default: the UI language), a
   **part of speech** select (`Any`, Noun, Verb, Adjective, Adverb; default `Any`) and a **text
   field with a type-ahead list** (the `TypeAheadInput` pattern: free text, the list only suggests).
   **The language select says which language the typed text is in.** The list searches only words of
   that language, and the sense the user picks is a meaning of that word. The other languages are
   the targets: their words come from the picked sense (through the English hub, section 3).
3. From 2 characters (150 ms pause) the list shows **senses**, not only words. One line:
   `banco  noun · bank — financial institution`. A word with several senses has several lines (at
   most 4 per word, 10 in all). With `Any`, each line shows its part of speech; with one part of
   speech selected, the list contains only that part of speech.
4. A pick opens the **preview** (same page, replaces the section; a "Back" button returns).
   The preview shows one row per **language of the user's account** (Q-G3), the start language first.
   Languages that are not on the account do not appear. It shows no English hub line (Q-G4).
   - the words of the sense in that language. One word: shown as text. Several words: a radio list,
     the first (Wiktionary's common one) selected. A noun shows its article ("el banco").
   - a language with no word: "No word found" and the row is off.
   - Estonian (only when it is on the account) with no word in the table: the Ekilex words appear,
     marked "from Ekilex" (D22 item 2). If Ekilex is down: "Not available now".
   - a checkbox per row, on by default when the row has a word.
   - the button **"Create draft"** is off while no row is on. **One row is enough** (Q-G1): a sense
     with a word in only one account language still makes a draft with that one card. The user
     adds the other languages by hand with the normal "add language" button. Save still needs
     at least 2 languages, as always.
5. "Create draft": the page calls the draft route (section 4, G3), then shows the normal form with
   the part of speech set and one card per chosen language, already filled. Cards the lookup could
   not fill show only the word (or stay empty) and a short notice. The normal Save rules apply.

*Interpretation of the review answers (please confirm):* the user chooses the sense in the
type-ahead list; the preview then only chooses between several words of that sense and between
languages. The preview does not choose the sense again.

---

## 3. Facts from the code (checked 2026-10-11)

- `lexeme_translations` has one row per (English entry, sense, target word). The key of a sense is
  `(englishLemma, partOfSpeech, entryOrder, senseOrder)`. Its columns: `language`, `word`,
  `searchKey`, `gender`, `wordOrder`, `sense` (the label).
- Existing index `lexeme_translations_word_idx (language, part_of_speech, search_key)` is a plain
  B-tree. The database collation is `en_US`, so it **cannot serve `LIKE 'co%'`** (same trap as
  migration 0023 for `lexemes`). The type-ahead needs new `text_pattern_ops` indexes.
- `translate.ts` already has everything for a full word lookup by exact word (reverse lookup,
  Ekilex gap fill). It has no prefix search and no "one sense by key" function.
- The lookup chain (`registry.ts` `findAdapter`) and `lexiconAdapter` take `entryId`. The `forms`
  of a noun row hold the article (`genderDE` = der/die/das, `genderES` = el/la), so a translation's
  `gender` can choose between homographs ("See": der / die).
- Frontend: `applyLookup` (`AutocompleteRow.tsx`) is the one function that writes a lookup into a
  card, including the branch radios. `TranslationCard` already has `pickSuggestion` (query field +
  fill). `useWordFormState` holds the cards. `AddWordPage` remounts `WordForm` with a `key`.
- `WordForm` create mode shows `PartOfSpeechSelector` while no part of speech is set.

---

## 4. Steps

Each step ends with something that runs, with tests and docs. Each step starts with a plain-language
overview before any file changes. After each step: a commit message for the user.

### G1 — Sense type-ahead (backend)

**DONE 2026-10-11.** `senseSuggestions` in `services/dictionary/translate.ts`, controller
`suggestSenses`, route registered **before** `/:language/:partOfSpeech` (that route would match
`translate/English`). Migration `0026_lexeme_translations_prefix_index`: indexes
`(language, search_key text_pattern_ops)` and `(english_search_key text_pattern_ops)`. Two queries:
the words (one per part of speech and search key, ranked by `lexemes` frequency, then shorter, then
alphabetical, cut at `limit`), then the senses of those words (at most 4 each). `key` is
`{ englishLemma, entryOrder, senseOrder }`; the part of speech is a field of its own. Measured on
the full local table (DE 148k, ES 133k, ET 18k rows): 10–25 ms for common 2-letter prefixes
("co", "be"), about 10 ms for others. A two-step "distinct words first" query was not faster, so the
simple query stays. The planner sometimes keeps the old English index for very common prefixes;
that is fine. Jest: 8 new tests (`sense type-ahead` block in `tests/dictionary.test.js`).

`GET /api/dictionary/translate/:fromLanguage?prefix=&partOfSpeech=Any|Noun|Verb|Adjective|Adverb&limit=`
→ `{ suggestions: [{ word, partOfSpeech, gender?, english, sense, key }] }`.

- `key` carries `(englishLemma, partOfSpeech, entryOrder, senseOrder)`. The path has one segment
  fewer than the existing `translate/:from/:pos/:query` route, so the two do not clash.
- `:fromLanguage` is the language of the typed text (the start language select). The prefix is
  never matched against the other languages.
- From English: distinct English senses whose `english_search_key` starts with the prefix.
  From another language: distinct senses with a word of that language that starts with the prefix.
- Order: frequency rank of the word (`lexemes`, unranked last), shorter word, alphabetical, then
  the word's place in the sense (`wordOrder`), then Wiktionary's sense order. At most 4 senses per
  word, `limit` default 10, max 20. 2 to 100 characters, as the other type-ahead (400 otherwise).
- Migration **0026**: indexes `(language, search_key text_pattern_ops)` and
  `(english_search_key text_pattern_ops)`. No data change and no reload: the normal deploy runs it.
  Measure a 2-letter prefix on the full local table (target: < 20 ms).
- `Any` runs over all four parts of speech in one query (the new index has no part of speech
  column; the part of speech is a filter).
- Jest: each start language, `Any` and one part of speech, ordering, the 4-per-word cap, `%` and
  `_` typed by the user, the 400 cases, English hub rows not repeated per target word.

### G2 — One sense with its words (backend)

**DONE 2026-10-11.** `senseWords` in `services/dictionary/translate.ts`, controller `senseOfKey`, route
`GET /api/dictionary/translate/sense/:partOfSpeech?english=&entry=&sense=&languages=`. Registered
**above** `/:language/:partOfSpeech/:query`, because `translate/sense/Noun` also fits that 3-segment
lookup route. `languages` is a comma-separated list (default: all four). The answer holds only the
asked languages as keys of `sense.words` (a missing key means "not asked", an empty list means "no
word"). The English word is a row of its own when English is asked. Ekilex runs only when Estonian
is asked and the sense has no Estonian word; it asks with the English word of the sense. The Ekilex
call is now one helper (`ekilexEstonian`) shared with `translate()`. 404 when the key matches no
row; 400 for a bad part of speech, language, English word or number. Jest: 7 new tests.

`GET /api/dictionary/translate/sense/:partOfSpeech?english=&entry=&sense=&languages=` →
`{ sense: TranslationSense, ekilex? }` (the same shapes as `translate.ts`).

- One function `senseWords(key)` in `translate.ts`; the Ekilex gap fill (only when no Estonian word)
  moves into a small helper shared with `translate()`.
- A `languages` query value (the account languages): the Ekilex gap fill runs only when Estonian
  is in it, so a user without Estonian never waits for Ekilex. The sense route also returns only
  those languages.
- Jest: a sense with all four languages; a sense without Estonian (Ekilex mocked, also down; and
  Estonian not in `languages`: no Ekilex call); an unknown key → 404.

### G3 — Draft route (backend)

**DONE 2026-10-11.** `services/dictionary/draft.ts`, controller `draft`, `POST /api/dictionary/draft`.
`LookupOptions.gender` (types.ts); `lexiconAdapter` narrows the D15 choice with it: of the non-stub
rows, the one whose `genderDE` / `genderES` equals the gender; no match → the usual choice. Only
German and Spanish nouns use it (English and Estonian nouns have no article). The library
fallbacks ignore the gender. Each pick runs in parallel through the normal chain (`findAdapter`);
a throw gives `status: 'error'` for that language only (logged on the server). The answer keeps
the order of the picks and echoes `language`, `word` and `gender`. A pair with no adapter gives
`not-found`. 400 for a bad part of speech, language, a repeated language, an empty or too long word
or gender, or not 1 to 4 picks. Jest: 7 new tests (including der/die "See" and la/el "mano").

`POST /api/dictionary/draft` with `{ partOfSpeech, picks: [{ language, word, gender? }] }` (1 to 4
picks) → `{ translations: [{ language, word, status, cases }] }`.
It is a POST only because of the body. It reads and changes nothing.

- For each pick, in parallel: the normal `findAdapter` chain, with a new option `gender` on the
  lexicon adapter: among the rows for the word, the row whose `genderDE` / `genderES` equals the
  gender wins; if no row matches, the D15 rule applies. The result keeps its status (`found`,
  `partial`, `not-found`).
- One failure must not fail the others: a language whose lookup throws (Ekilex 502) returns
  `status: 'error'` and no cases; the other languages still fill.
- Jest: "See" with gender die and with das; a noun with a gender but no lexicon entry; one
  language down; unsupported part of speech → 400; more than 4 picks → 400.

### G4 — Start section and preview (frontend)

**DONE 2026-10-11.** New folder `frontend/src/features/words/start-from-word/`: `StartFromWord.tsx`
(language select with the account languages, part of speech select with `Any`, the text field, the
"or" line; its `children` is the part-of-speech list, hidden while the preview is open),
`SenseTypeAhead.tsx` (Base UI Autocomplete; items show the article, the word, the part of speech
while `Any`, and "english — sense"), `SensePreview.tsx` (one row per account language, start
language first; checkbox, one word or a radio list, "from Ekilex", "No word found", "Create draft").
`features/autocomplete`: types, `api.ts` (`suggestSenses`, `fetchSense`, `createDraft`), keys,
hooks (`useSenseSuggestions`, `useSense`, `useCreateDraft`). `WordForm` gets `onStartDraft`
(create mode, gate only); `AddWordPage.handleDraft` moves on to the form of the draft's part of
speech. **Interim:** until G5 the cards stay empty; `handleDraft` does not use the looked-up words
yet. Texts: `wordRelated.startFromWord.*` in the four locales. Test fake:
`test/msw/startFromWordHandlers.ts` (register it before `makeAutocompleteHandlers`: that one's
wildcard routes also match `translate/English`). Vitest: 12 tests in `StartFromWord.test.tsx` and
1 in `AddWordPage.test.tsx`; the whole suite 1569 tests. Not yet looked at in a real browser:
the layout check comes with the G6 e2e run.

- `features/autocomplete`: `api.ts` + `hooks.ts` + `types.ts` for the three routes (G1–G3).
- `features/words/start-from-word/`: `StartFromWord.tsx` (language select, part of speech select,
  the type-ahead), `SenseTypeAhead` (reuses the `TypeAheadInput` list styling; a new item layout,
  not a new library), `SensePreview.tsx` (rows, radios, checkboxes, Create draft).
- `PartOfSpeechSelector` stays unchanged. `WordForm` renders `StartFromWord` above it in the create
  gate only, with the "or" line. The start language defaults from `SessionUser.uiLanguage`.
- All texts in the four locale files (`wordRelated`), with the same key-parity test the other
  features use.
- Vitest: the list (Any and a part of speech), pick → preview, one-word and several-word rows, the
  off and disabled states, the Ekilex marks, "Back".

### G5 — Fill the cards (frontend)

**DONE 2026-10-11.** `AddWordPage` keeps `draft` and passes it to `WordForm` as `initialDraft` (cleared
by `resetToGate`); `useWordFormState` seeds the part of speech and one empty, changed card per word
in the draft's order (the start language first, not the user's language order), and keeps `drafts`
by language; removing or clearing a card (and `reset`) drops its entry, so adding that language
again later gives an empty card. `TranslationCard` has the new prop `draft`: on mount (once, also
under StrictMode) `found` / `partial` run `applyLookup` with the draft's cases; `not-found` / `error`
write only the word into the active query field (if shown) and, for a German or Spanish noun, the
gender when the form has that option. No request is made. The card also puts the draft's answer into
the lookup cache under its query, so the footer shows "applied" / the partial notice / "don't know
this word" from the same answer (it was chosen by gender: "die See"; a plain lookup would give
"der See" and offer to overwrite it). For that, `lookupQueryOptions` got `staleTime: 60 s`. An
`error` draft is not cached (the footer asks again) and shows the line
`startFromWord.draftLookupFailed` until the word is edited. Vitest: 6 card tests, 4 hook tests, and
the page test now walks start → preview → draft → two filled cards → Save enabled. A mutation
check confirmed the cache seeding matters (3 card tests fail without it).

- `AddWordPage` keeps a `draft` state `{ partOfSpeech, translations: DraftTranslation[] }` and
  passes it to `WordForm` (`initialDraft`); the existing `formKey` remount seeds it once.
- `useWordFormState` seeds the cards: part of speech, one `TranslationItem` per language, in the
  user's language order.
- `TranslationCard` gets a `draft?: { word, result }` prop. On mount it writes the query field with
  `word` and runs `applyLookup` with the result (the same code path as a type-ahead pick; no second
  fetch). A not-found noun with a known gender still fills the gender field. `status` shows the
  existing notices: `partial` → "not fully sure"; `not-found` / `error` → a short "nothing found,
  fill by hand" line. The cards report `isDirty` as they do for a pick, so Save works as normal.
- Vitest: seeding, the three statuses, `applyLookup` called with the result, no fetch on mount.
- Nothing in `useCreateWord` or the save route changes.

### G6 — E2E and docs

- E2E spec `e2e/tests/autocomplete-slice-g-start-from-word.spec.ts` (needs fixture rows; the
  translations fixture has 11 English words, 204 rows — check which pairs exist and add rows if
  needed): English start → pick a sense → preview → draft → cards filled → save → the Word has the
  chosen languages. Spanish reverse start; a "See" sense with gender; an Estonian gap with the Ekilex
  stub; the manual part-of-speech path still works.
- Docs: `strategy` §9 (Slice G done) and §14 (no server step: migration 0026 runs with the deploy),
  backend API docs for the 3 routes, `.context/README.md` spec index, the Add Word user doc/`pages-word-flow`
  if it lists the page parts, infrastructure guide only if a step appears.
- Gate: `npm run test:e2e` green, backend Jest, frontend Vitest, `tsc`.

---

## 5. Decisions (proposed — number after approval)

| # | Proposal |
|---|----------|
| G-a | Entry: a section above the part-of-speech list on `/addWord`, with an "or" line (user, 2026-10-11). |
| G-b | The user chooses the **sense** in the type-ahead list; the preview chooses words and languages (user, 2026-10-11). |
| G-c | A preview step comes before the cards (user, 2026-10-11). The draft opens in the normal form; no save without the form. |
| G-d | Part of speech select has `Any`; `Any` lists senses of all four shipped parts of speech. |
| G-e | The sense list comes from the translation table, not from the `lexemes` table. A word with no lexicon entry can still start a draft; its card shows only the word. |
| G-f | The draft route is one server call (not four client calls) so gender can choose the lexicon entry and one failure stays local. |
| G-h | Q-G1 (user): a sense with no word in the user's other languages stays in the list. The preview allows a draft with one language; the user adds the rest by hand. |
| G-i | Q-G3 (user): the language select and the preview show only the languages of the user's account. |
| G-j | Q-G4, Q-G5 (user): no English hub line in the preview; the last choice is not remembered. |
| G-g | No rows are saved or cached by the draft. The Word is created by the existing save route. |

## 6. Questions (all answered 2026-10-11)

| # | Answer |
|---|--------|
| Q-G1 | Show senses that have no word in the user's other languages. The draft then has the languages that do have a word (at least one); the user adds the others by hand. |
| Q-G2 | (This was the sense-choice question.) The type-ahead list chooses the sense; the preview chooses words and languages. |
| Q-G3 | The preview shows only the languages of the user's account. |
| Q-G4 | No English hub line. |
| Q-G5 | The last start language and part of speech are not remembered. |

## 7. Risks

- **A one-card draft** (Q-G1) is not saveable until the user adds a second language. The cards and
  the existing Save message ("at least 2 languages") already say so.
- **Sense labels are English Wiktionary text** ("body of water"). They are not translated into
  the UI language. Accept in v1 (the same limit as the translate route).
- **Thin Estonian** (D22): many drafts will have no Estonian row except through Ekilex. The preview
  makes this visible before the draft.
- **Gender mismatch**: a translation says "die", the lexicon has only "der". D15 then picks the
  entry, and the card shows the lexicon's article. The translation gender is not forced onto the form.
- **Wrong sense for a homograph at the Ekilex gap**: the Ekilex words come from meanings, not from
  the sense (D22). They are marked "from Ekilex" so the user checks them.
- **Index size**: two more indexes on a ~300k-row table (an estimate of 15–20 MB per environment).
  Measure in G1.
