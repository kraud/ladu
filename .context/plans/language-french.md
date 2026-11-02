# Plan: Add French to Ladu (+ a reusable "add a language" guide)

Status: plan agreed on 2026-10-25. All slices (0–12) done 2026-10-26 (all committed). What is left: the teacher's review and the V10 fix (see "State"); the branch is merged. Side task done 2026-10-26: e2e on its own ports and its own database.

## State (updated 2026-11-02)

All slices (0–12) are done, and the branch `new-language-french` is merged into `main`. The slice sections below keep the detail of each slice. What is left:

- The French teacher reads `language-french-review.md` (forms and practice) and `language-french-strings.md` (interface). Each answer is a small follow-up (decision M1: the French text was merged as a first draft). The open questions are listed in the review log.
- V10: the type-ahead does not offer "se laver" (found on staging, 2026-10-27). Cause and fix plan: "V10 fix plan". It is not a blocker.
- The rollout runbook (below) is the record of the rollout steps. Its step 7 is a reminder: delete the safety copy of the lexicon on the VPS on or after 2026-10-31.

## Review log

| # | Severity | Finding | Resolution |
|---|---|---|---|
| M1 | Moderate | Decision L1 puts machine-made French in the interface before any review. A French user sees it at the merge. | **Decided 2026-10-26 (user, slice 7): merge anyway, review later.** French goes live as a first draft. The teacher reads the two sheets afterwards; each change is a small follow-up. The rollout runbook says so (slice 12). |
| M2 | Moderate | French elides the article (l'arbre, l'homme; but le héros, with an aspirated h). Wherever the UI joins article and noun, "le arbre" is wrong. | Open: slice 4 finds each join (Review chip, demo intro, practice). First iteration: show the gender chip apart from the noun, with no join. Teacher question. |
| M3 | Moderate | Exercises map French "past" to the imparfait, not the passé composé. | Accepted for the first iteration. Teacher question. |
| S3-1 | Major (found in slice 3) | `MAX_TRANSLATIONS = 4` was hard-coded in `CellDialog.tsx:50` and `useWordFormState.ts:31`, and the message said "maximum of 4 translations". With a fifth language a word could never get its fifth translation. | Fixed: one `MAX_TRANSLATIONS` in `lib/language.ts` (= number of languages), message with `{{max}}` in all five locales. |
| S3-2 | Minor | The overview of slice 3 promised "vous". The existing languages are informal (tú, du, imperative). | Decision R1 in `language-french-strings.md`: "tu", for one product voice. The teacher confirms. |
| S3-3 | Minor | `supportedLngs` and Turnstile `fr` were planned for slice 2. A code in `supportedLngs` without files makes i18next request missing files. | Moved to slice 3, with the files. |
| S3-4 | Minor | Running e2e needs :5001 and :5173 free; a running `npm run dev` (or its leftover `nodemon`) blocks it and restarts the backend on every backend edit. | Fixed 2026-10-26 (side task): e2e has its own ports and its own database. `npm run dev` can keep running. |
| F1 | Moderate (decision in slice 4, changed by the user the same day) | Slice 4 first built no superlative field: French forms it from the comparative. The user asked for it, locked like the Estonian "kõige" field, so a learner has the form to study and exercises can compare it with languages that have superlative forms. | Done: `superlativeFR` is always locked, shows and saves `le ` + the comparative (also through the locked comparative: "le plus beau"), and shows a placeholder while there is no comparative. New in the form engine: a derivation without `when`, `via` (a source that is itself derived) and `emptyPlaceholderKey`. |
| F5 | Minor | The comparative and the superlative are stored in the male singular only. French agrees them (plus grande, les plus grands; meilleure). The form cannot store those. | Accepted: the positive's agreement forms are in the card. Teacher question: add the agreement forms later? |
| F2 | Minor | The words-table gender filter holds the article, not the language: "la" selects Spanish and French feminine nouns together. | Accepted. A fix needs the case name in the filter (`genderFR=la`); not worth it for two languages. |
| F3 | Minor (found in slice 4) | `languageToFieldName` in `wordController.ts` hard-coded the four `registeredCasesXX` names; slice 1 missed it. | Fixed: it reads the language table. Recorded in the guide. |
| F4 | Minor | The adjective "position" options are English text ("Before the noun"), the same as the preposition. They are grammar terms shown in every interface language. | Accepted, as for prepositions. Teacher question: wording of the three positions. |
| m1 | Minor | `verbGroupFR` replaces `regularityFR`, so French verbs have no regular/irregular radio. | Decided in slice 5 (the user asked whether French has no regular/irregular verbs: it does; groups 1 and 2 are the regular verbs, group 3 holds the irregular ones). The group radio has its own practice drill (multiple choice). Teacher question: a few group 1 verbs change their spelling (appeler, manger). Adding the radio later is one field. |
| V1 | Moderate (found in slice 5 by e2e) | The form engine refused every digit in an optional radio value (`buildYupSchema.ts`, the "no numbers" rule of the old app). "1er groupe", "2e groupe", "3e groupe" all have a digit, so choosing a verb group made the form invalid and the Save button stayed off. The unit tests passed: only a real form shows it. | Fixed: the optional radio is checked against its options only (the options pattern); the digit rule added nothing on top of it. Two new tests in `buildYupSchema.test.ts`. |
| V2 | Minor (decision in slice 5) | In the passé composé the German engine puts the pronoun after the auxiliary ("habe mich"). French needs the opposite: "me suis" + lavé. | Fixed: new `reflexive.position: 'beforeAuxiliary'` (`types.ts`, `FieldRenderer.tsx`) with a test. |
| V3 | Minor | The reflexive hint shows full pronouns (me, te, se); the French elision (m', t', s') before a vowel is not shown. The label "Je/J'" has both forms. | Accepted. Teacher question: show "me/m'"? |
| V4 | Minor | Participles are typed in each passé composé box (so être agreement fits) and also in the optional `pastParticipleFR` field (so a drill can ask it). The two can differ. | Accepted, as for the German Perfekt. Later: fill the boxes from the participle field. |
| S6-1 | Moderate (decision in slice 6, confirmed by the user) | The Spanish mood select has three values. French has a fourth rule: "au cas où", "quand (bien) même" and "alors même que" take the conditional (Le Robert, guide "Conjonctions de subordination"; the page returned 403 to a direct fetch, so the rule is from the search summary). Marking them "Depends on meaning" would be wrong. | Done: `MOOD_OPTIONS_FR` = Indicative / Subjunctive / Conditional / Depends on meaning. Teacher question: check the list against Grevisse (the conditional after "même si"?). |
| S6-2 | Minor | The adverb superlative is stored with its article ("le mieux"), as for the adjective. The comparatives of *beaucoup* (plus) and *peu* (moins) are typed by hand with the box off; my sources named *bien → mieux → le mieux* only. | Accepted. Teacher question: are there other irregular adverb degrees to pre-fill? |
| S6-3 | Minor | The "Paired" label shows its example in the interface language ("neither … nor" in English), as for the other languages; it is not a French example. | Accepted (same as ES, DE, EE). |
| S6-4 | Minor | The position of *nonobstant* ("nonobstant appel") as a postposition is not confirmed by a source; *durant* is (Wiktionnaire: "trois heures durant"). The radio is optional, so no word is blocked. | Accepted. Teacher question with F4. |
| S6-5 | Minor | The adverb reuses the placeholder key `wordRelated:wordForm.adjective.derivedFromComparative` ("Depends on the comparative"): it is the same sentence in all five locales. | Accepted: one string, not two copies. |
| S7-1 | Minor (found in slice 7 by the practice test, fixed) | The French past-participle and verb-group drills had no task sentence (`practice:card.task`) and no placeholder, so the card read "Past participle" over a box that said "Your answer…". | Fixed: `Past-Participle` and `Verb-Group` in `card.task`, `Past-Participle` in `card.placeholder`, all five locales. The test pins the sentence and the placeholder. |
| S7-2 | Minor | The practice card shows the label of the pronoun, "Je/J'", before the prompt and before the answer box ("Je/J' vais"). A card should read "je vais" or "j'ai". Elision needs a vowel / mute-h rule. | Accepted for the first version, like V3. Teacher question X2 in the review sheet. |
| S7-3 | Minor | The set-up page remembers the last choice (languages, answer style). A test that opens it twice must set every chip, not only switch some off. | Recorded in the test helper (`keepLanguages` sets each chip). |
| A1 | Moderate (slice 8) | 58 of 3,253 top verbs (1.8%) list both auxiliaries in two rows ("present indicative of avoir" and "être + past participle"): partir, sortir, tomber, passer, monter, rentrer. The first row gives *avoir* for partir and tomber. | **Decided Q1 (user): leave `auxVerbFR` empty for these verbs.** The field is optional. The passé composé cells still fill. |
| A2 | Moderate (slice 8) | Wiktionary has no passé composé row per person, only "present indicative of avoir + past participle". Agreement with *être* (allés) is not in the data. | **Decided Q2 (user): write the masculine singular participle in all six boxes.** The learner adds the agreement. Teacher question V4 stays open. |
| A3 | Minor (slice 8) | One entry holds the plain table and the pronominal table; pronominal rows carry the tag `reflexive` ("me lave"). 22 always-reflexive verbs have only the pronominal table, and their infinitive is "se souvenir". | Fixed in the selectors (slice 9b): skip `reflexive` rows when a plain table exists; strip "se " / "s'" from the infinitive and set "Always reflexive" when only the pronominal table exists. |
| A4 | Minor (slice 8) | Wiktionary gives no verb group. The template name is always `fr-conj-auto`. | Derived by rule (slice 9b): `-er` → 1er (except aller → 3e); `-ir` with a present participle in `-issant` → 2e; all others → 3e. Right on every real verb among the first 40 (the noise entries get no group). Known miss: a few rare verbs (fleurir). |
| A5 | Minor (slice 8) | No source for: adverb gradable and comparative (0.3%, only irregulars like bien → mieux), adjective comparative, superlative and vowel form (0.1%: bon → meilleur, beau → bel), conjunction type and mood, preposition position, adjective position, noun regularity. | Left empty; the learner fills them. "Gradable" is set only when a degree row exists (as in Spanish). |
| A6 | Minor (slice 8) | `landing/credits.html:55` says "Dictionary word forms (English, German and Spanish)". | Add French (slice 9a). The licence is the same (CC BY-SA 4.0), and `fr_50k` (FrequencyWords) is CC BY-SA 4.0 too, so `licence-study.md` needs no new row. |
| A7 | Minor (slice 8) | The French frequency list has noise (Mes, Dr, peut, voilà) and 26.8% of its words have no match (ES 19%, DE 25%). The top unmatched words are determiners (des, du, au), hyphenated questions (est-ce) and names. | Accepted, as for the other languages. Ladu has no determiner part of speech. |
| A5b | Correction (slice 9a) | A5 said French Wiktionary gives no conjunction type. The build shows it does for some: `et` is Coordinating, `parce que` Subordinating (12 of the 28 conjunctions in the top 5,000 have a type). The shared rule fills a type only when the entry states exactly one. | Nothing to change: the shared `conjunctionSelectors('FR')` does it. The mood and the preposition position stay empty (the position is the entry kind, as for the other languages: `durant` is "Before or after the noun" because it is both a preposition and a postposition entry; teacher question S6-4/F4). |
| A8 | Moderate (found in slice 9a) | `controllers/dictionaryController.ts` allowed 1 to 4 picks per draft (`MAX_PICKS = 4`). A word with a translation in all five languages could never be drafted: the route answered 400. Same family as S3-1. | Fixed: `MAX_PICKS` is the number of languages. A test makes a five-pick draft (French, Spanish, German, Estonian, English) and refuses six. |
| A9 | Minor (slice 9a) | Wiktionary lists `gens` as a masculine noun with no singular; the lexicon sends gender "le" and the lemma as the singular, like the Spanish plural-only nouns. A homograph such as `souris` has two rows (la: the animal, le: the computer mouse). | Accepted. The gender hint of the translation picker chooses the row. |
| A10 | Minor (slice 9a, checked on the dev server) | Question: does typing `oeil` or `oeuf` (no ligature) find `œil` / `œuf`? | Yes: Wiktionary has `oeil` and `oeuf` as entries of their own, so a lookup of `oeil` is found and the prefix `oeu` lists oeuf, oeuvre. An unaccented prefix (`ecole`) finds nothing, the rule for every language (`searchKey` keeps accents on purpose). Accepted; no change. |
| V5 | Moderate (found in slice 9b) | The slice 8 draft told the plain table from the pronominal table by the tag `reflexive` on the rows. The second table of "appeler" ("s'appeler") has no such tag, and a verb with two tables could give the wrong auxiliary or forms. The draft only worked because the first match wins. | Fixed in the real selectors: split the forms into tables at each `table-tags` row; a table is pronominal when its infinitive starts with "se " or "s'". Unit test with "appeler" and a made-up "s'en aller". |
| V6 | Decision (slice 9b, user) | Slice 8 decision A3 said to strip "se" from the infinitive of a pronominal verb. | **Decided (user): keep "se laver" / "s'appeler".** It is how the form and its e2e test write it. A3 is replaced: only the forms lose the pronoun, never the infinitive. |
| V7 | Moderate (found in slice 9b) | Wiktionary gives only 257 pronominal verbs an entry of their own ("se souvenir", "s'appeler"). "se laver" lives inside "laver", so the form's own convention found nothing. | Fixed: `withPronominalFallback` in `registry.ts`. When "se X" / "s'X" is not found, X is looked up; if it is marked reflexive, its forms come back as a **partial** answer with the infinitive as typed, "Always reflexive" and être. A verb not marked reflexive stays not-found. Teacher question: are the forms of a pronominal verb always those of the plain verb (yes for the tenses we store: the pronoun is the only change)? |
| V8 | Minor (slice 9b) | "Optionally reflexive" is 556 of 3,253 verbs (17%), including *pouvoir*, *envoyer*, even *être* (from an "s'être" table). The slice 8 draft counted 71 because it read row tags. | Accepted: 552 of the 556 also have a sense tagged reflexive or pronominal, so Wiktionary states it twice. |
| V9 | Minor (slice 9b) | Verb entries with no conjugation table (noise such as *peut*, *voilà*, *vader*) have no infinitive. The lexicon does not copy the lemma as an infinitive (the Spanish table does): it would invent forms for non-verbs. | Accepted: 4,249 entries are skipped as "nothing beyond the lemma". |
| V10 | Minor (found on staging, 2026-10-27; **open, fix planned**) | In the French verb form, the type-ahead list does not offer "se laver" (typing "se la…" lists nothing; typing "laver" lists only the plain verb). The lookup does work: typing "se laver" whole and pressing "Use autocomplete values" fills the card (`être`, "Always reflexive"), and so does "Start from a word". Picking `laver` from the list gives the plain verb (`avoir`, "Optionally reflexive"), which is correct for that word (V6, V7) but hides the pronominal use. | Cause and fix plan: section "V10 fix plan" below. Feasible, small, no data rebuild, no reload, no migration. |
| Q3 | Decision (slice 8) | Which forms to store. | **Decided (user): only what the form uses**: present, imperfect, simple future, both participles, plus the properties. Conditional and subjunctive are not stored. A new tense later needs one rebuild and reload of the lexicon file. |
| Q4 | Decision (slice 8) | Slice 9 touches many files. | **Decided (user): split** into 9a (nouns, adjectives, adverbs, function words) and 9b (verbs). |

## V10 fix plan: pronominal verbs in the type-ahead (written 2026-10-27, not built)

**Cause (read in the code; the SQL counts below are from the built lexicon file).**
- The list is `lexiconSuggestions` in `backend/services/dictionary/lexicon.ts`. It selects rows of `lexemes` whose `search_key` starts with the typed prefix (`searchKey` is only lowercase + NFC + trim). A pronominal infinitive such as "se laver" is a row only when Wiktionary gives it an entry of its own. The built French file has **27** such lemmas (`se souvenir`, `s'en aller`, `se pouvoir` …; the other pronominal entries have no conjugation table and were skipped, review log V9). "se laver" lives inside the entry "laver".
- The lookup has a fallback for that case, `withPronominalFallback` in `services/dictionary/registry.ts`: for "se X" / "s'X" with no row, it looks up X, and if X is marked reflexive it answers `partial` with the infinitive as typed, "Always reflexive" and `être`. The suggest route (`controllers/dictionaryController.ts` `suggest`) does not use the adapters, so it has no such fallback.
- "Start from a word" does not use `lexemes` for its list. It reads `lexeme_translations`, where "se laver" is a French translation of an English sense, so it shows up there.
- Data in the built file (7,374 verbs): Not reflexive 6,475, Optionally reflexive 791, Always reflexive 108. So **899 verbs** can take "se" / "s'", and 27 of them already have their own entry.

**Fix (all in the suggest path; the lookup needs no change).**
1. `lexiconSuggestions` (French verbs only; guard with `language === 'French' && partOfSpeech === 'Verb'`, ideally through a small helper in `services/dictionary/` so other languages stay untouched):
   - Build the normal list as today.
   - For each suggestion whose row has `forms.reflexivityFR` of `Optionally reflexive` or `Always reflexive` (`forms` is already selected), add a second suggestion right after it: `lemma` = "se " + lemma, or "s'" + lemma when the lemma starts with a vowel or a mute h (`/^[aeiouyàâäéèêëîïôöùûüœæh]/i`); `entryId` = **the id of the plain verb's row**. Skip it when the lemma is already in the list (the 27 own entries) and cut the result at `limit`.
   - When the prefix starts with `se ` or `s'` / `s’` (use `PRONOMINAL_PREFIX` from `registry.ts`, export it), strip it, query the verbs whose key starts with the rest, **filtered in SQL** to reflexive-marked verbs (`forms->>'reflexivityFR' <> 'Not reflexive'`, else the overfetch fills with plain verbs), and return them as "se X" / "s'X". Keep frequency order. The rows of the 27 own entries match the first query by themselves; remove duplicates by lemma.
2. Why a plain-verb `entryId` is safe: when the user picks "se laver", `TranslationCard.tsx` (`pickSuggestion`) sets the field to "se laver" and calls the lookup with `query = "se laver"` and `entry = <id of laver>`. `lexiconAdapter` first selects rows by the **query's** search key ("se laver": no row), returns `not-found` before it looks at `entryId`, and `withPronominalFallback` then runs, with the entry id dropped. The result is the pronominal answer. The controller only requires the `entry` value to be a UUID, which the plain verb's id is.
3. Frontend, one line: `TypeAheadInput.tsx` uses `key={item.entryId}` for the list items. "laver" and "se laver" would share a key. Use `` `${item.entryId}:${item.lemma}` ``. Nothing else changes (`Suggestion` keeps its shape; `AutocompleteRow` compares the field with the picked lemma).

**Choices to take when you build it.**
- *How many "se" suggestions.* The plan above adds "se X" after every reflexive-marked verb, so typing "lav" shows `laver` and `se laver`. For 899 verbs this is the complete answer but lengthens some lists. A quieter variant: add "se X" only when the typed text equals X (the user finished typing "laver") or starts with "se ". I recommend the full version first: the pronominal use stays visible (a user who picks `laver` otherwise never sees `être`).
- *Elision.* The vowel / mute-h rule gets aspirated-h verbs wrong ("se hâter", "se hisser" are written with "se"). The form still works either way (the lookup strips both pronouns), but the list would show "s'hâter". Option: a short exception list for aspirated h, or store the real pronominal infinitive from the Wiktionary table (a new form such as `pronominalInfinitiveFR` in `selectors/fr.ts` `VERB_SELECTORS_FR`, then `ingest.ts fr`, a reload of the French file in every environment, and a lexicon fixture rebuild). That is exact and also marks which verbs really have a pronominal use, but it needs the rebuild and the Ansible reload again. Recommended order: runtime rule now, the stored infinitive only if the teacher finds errors.
- *Fallback result is `partial`.* The card shows the "not fully sure" notice for a "se X" pick, as it does today for a typed "se laver". The teacher question in V7 (are the forms of a pronominal verb always those of the plain verb?) applies.

**Tests to add.**
- `backend/tests/dictionary.test.js`, in the French block (fixture has `laver` = Optionally reflexive, `se souvenir` own entry, `appeler`, `aimer` = Not reflexive): `prefix=se la` → `["se laver"]`; `prefix=lav` → `["laver", "se laver"]`; `prefix=aim` has no "se aimer"; `prefix=se so` has "se souvenir" **once**; `prefix=s'ap` → "s'appeler" with the elision; the "se laver" entry id equals the id of `laver`; German and Spanish lists are unchanged. A unit test of the elision rule.
- `backend/tests/dictionary.test.js` lookup test: `French/Verb/se%20laver?entry=<laver id>` gives `être` and "Always reflexive" (pins step 2).
- `e2e/tests/autocomplete-j-french-lexicon.spec.ts`: type `se la`, pick "se laver" from the list, expect "Always reflexive" and `être`; type `laver`, expect both `laver` and `se laver` in the list. Close the list with `closeTypeAheadList` where the next step uses roles.
- Frontend: a `TypeAheadInput` test with two suggestions that share an `entryId` (no React key warning).
- Docs: the French block of `add-language.md` (verbs: the suggest route needs the same fallback as the lookup), `forms-french.md`, and this plan (tick V10).

**Size.** About 40 lines of backend code, one line of frontend, the tests above. No migration, no data rebuild, no reload, no new secret. A normal deploy is enough.

## Slice 8 results (autocomplete research, 2026-10-26)

**Answer: go for all six parts of speech.** Wiktionary (kaikki) fills French as well as Spanish and German. Only the fields in review-log A5 have no source.

**Method.** The raw dump (kaikki, Last-Modified 2026-10-03) was streamed once with a throw-away script. It wrote 120 MB of French entries (`kaikki-fr.jsonl`) and the 128,303 English → French translation rows of 77,020 English entries (`translations-en-fr.jsonl`). The sample is the top 5,000 lemmas per part of speech from `fr_50k` (hermitdave FrequencyWords 2018, downloaded 2026-10-26), mapped to lemmas with the logic of `sample.ts`. The fill rates come from **draft selectors** run with the real engine (`lib/lexicon/select.ts`). The drafts are throw-away; slices 9a and 9b write the real `selectors/fr.ts`. About 35 words were also read by hand (cheval, œil, travail, souris, aimer, finir, aller, être, avoir, venir, partir, appeler, beau, vieux, facile, marron, bon, bien …). All values were right except the partir auxiliary (A1).

**Fill rates** (share of the sampled lemmas; "entry found" was 100% everywhere):

| Part of speech | Lemmas | Fields |
|---|---|---|
| Noun | 5,000 | gender 99.6%, singular 100%, plural 95.9% (the rest are plural-only, uncountable, or noise such as *Mes*, *Dr*) |
| Verb | 3,253 | infinitive 98.2%, group 98.1% (derived), auxiliary 97.5% (before A1), reflexivity 100%, past participle 97.5%, present participle 97.4%, present / imperfect / simple future 97.0–97.5% per person, passé composé (derived) 97.5%. 97.0% of verbs have all 18 cells, both participles and the auxiliary. |
| Adjective | 3,990 | masculine singular 100%, feminine singular 99.4%, masculine plural 99.4%, feminine plural 99.5%, comparative / superlative / vowel form 0.1% each |
| Adverb | 604 | the word 100%, comparative and superlative 0.3% |
| Conjunction | 35 | the word 100% (no type, no mood) |
| Preposition | 64 | the word 100% (no position) |

Verb group of the 3,253 verbs, derived by rule: 1er 2,719, 2e 160, 3e 313, none 61 (noise). Auxiliary: avoir 3,050, être 41, both 58, none 104 (the 104 are mostly noise or always-reflexive verbs). Reflexivity: Not 3,160, Optionally 71, Always 22.

**Shape of a French entry** (facts for the selectors):
- Noun: gender is a sense tag (`masculine`, `feminine`, both → "le/la"). Plural is a form row `plural`; the feminine counterpart is a row `feminine` (chat → chatte), not needed. Invariable nouns have the sense tag `invariable` (souris → souris).
- Verb: rows with the tags `indicative present|imperfect|future` + person (`first-person singular` …). Participles: `participle past`, `gerund participle present`. Placeholders are `-` (pleuvoir has no 1st or 2nd person). The passé composé is one row of text, "present indicative of avoir + past participle", tagged `perfect`, `multiword-construction`. Other rows with `multiword-construction` are text, not forms, and must be skipped. Some verbs also carry IPA rows with the same tags (`ɛm` next to `aime`). The spelling row comes first, so the first match is right (0 of 3,253 verbs gave IPA); still, slice 9b must keep the first match and test it.
- Adjective: rows `feminine`, `masculine plural`, `feminine plural`. An adjective with one shape for both genders (facile, rouge) has a row `plural` only: fill the feminine singular from the lemma and both plurals from that row. Invariable adjectives (marron) have the sense tag `invariable`: all four cells are the lemma. `before-vowel masculine singular` is the vowel form (bel, nouvel, vieil). `comparative` and `superlative` rows exist only for irregular adjectives (bon → meilleur).
- Adverb: `comparative` / `superlative` rows only for irregulars (bien → mieux, le mieux).
- Conjunction and preposition: categories are only "French conjunctions" and "French prepositions". Wiktionary has no type, mood or position for French.

**Translations** (top 5,000 English lemmas; same method as the report of slice 0):

| | Noun | Verb | Adjective |
|---|---|---|---|
| English lemmas with a French translation | 70.7% | 55.0% | 57.8% |
| (for comparison, Spanish / German) | 70.1% / 70.1% | 57.3% / 57.1% | — |

Reverse (can French start a lookup): the share of the top French lemmas that appear as a French translation word of an English entry. Noun 90.3%, verb 78.2%, adjective 75.7%, adverb 74.7% (top 1,000: 92.4%, 87.2%, 82.7%). Spanish and German: nouns 91.8% / 91.9%, verbs 84.2% / 78.9%. So the plan of the English-hub lookup works for French.

**Size.** 100,881 French lexemes (noun 53,990, adjective 19,195, verb 11,383, adverb 4,597, proper noun 10,086, others 1,630) and 481,337 forms before filtering (verbs 391,934, because of the moods the form does not use). With decision Q3 (store only what the form uses), the French file is close to Spanish: about 30 MB in layout B, no problem for the VPS.

**Sources and licence.** English Wiktionary through kaikki.org (CC BY-SA 4.0): the same source and licence as EN, ES and DE. `fr_50k` of hermitdave FrequencyWords (CC BY-SA 4.0): already credited. Only the languages list on the credits page changes (A6).

**What slice 9a / 9b must do with this** (the touchpoints are in the slice text below). For the lookup, the French frequency file name is `frequency-fr.txt`; `common.ts` `LANG_CODES` gets `'fr'`.

## Context

Ladu has had exactly four languages (EN, ES, DE, EE) for its whole life. The product goal is many more. French is the first new one, and the first one the user does not speak. This plan has two outcomes:

1. **French works end to end.** It is a language to learn and an interface language. It has forms for all 6 parts of speech, exercises, autocomplete from Wiktionary, an onboarding pool and a demo template.
2. **The next language is easier.** A guide `.context/guides/add-language.md` is written *while* we add French. Each slice adds the files it touched. A first refactor slice reduces the number of hand-copied language lists, so the guide is shorter.

The user trusts the first design of the French forms to the assistant. A French teacher reviews it when a working version exists. So the plan also produces a **teacher review sheet** (slice 7).

## Decisions from the user (2026-10-25)

- **L1. Full language.** French is a language to learn **and** an interface language: 14 `fr/*.json` locale files, emails, landing page. One list keeps both meanings (no split).
- **L2. Scope.** Forms first, then autocomplete (kaikki/Wiktionary) with a coverage check.
- **L3. Consolidate first.** One language module per tier before French is added (no behaviour change).
- **L4. Include the onboarding pool and the demo template** as late slices.
- **L5. Working mode.** Auto mode from phase 0 (2026-10-26). The slice rules in `CLAUDE.md` still apply: overview first, tests with the code, no commits by the assistant.

## Facts checked in the code (2026-10-25)

- **No migration.** `translations.language`, `users.languages`, `ui_language`, `native_language` and `lexemes.language` are `varchar` or `text[]` (`backend/src/db/schema.ts:196-202, 394, 881`). The backend validates no case names.
- Stored language value = the full English name (`'French'`). Case-name suffix = `FR`. i18n code `fr`. kaikki/ISO code `fr`. There is no `ee`/`et` trap like Estonian.
- Frontend: the `Lang` enum (`frontend/src/ts/enums.ts:527`) and the `UI_LANGUAGES` table (`frontend/src/lib/language.ts:24`) feed menus, flags, review, practice and onboarding. The form engine is config-driven: no new components. `getFormConfig` returns `undefined` for a missing (PoS, language) pair and `TranslationCard` shows "not available". `coverage.ts` already models partial coverage.
- `NOUN_CONFIGS`, `VERB_CONFIGS` and `ADJECTIVE_CONFIGS` are `Record<Lang>` (required). The other three are `Partial`. Each config file has its own `LANG_SUFFIX` copy.
- Backend copies of the language set: `controllers/userController.ts:67` (`SUPPORTED_LANGUAGES`), `controllers/demoController.ts:29`, `services/exercises/types.ts:9` and `validate.ts:9`, `services/dictionary/registry.ts:18` and `translate.ts:30,66`, `lib/wordSort.ts:17`, `services/exercises/catalogue.ts:57` (`LANGUAGE_SUFFIX`; `SingleLanguageCatalogue = Record<Language, …>`), `scripts/lexicon/common.ts:11`, `extract.ts:24,46`, `ingest.ts:32`, `load.js:46`, `lib/onboardingPool.ts`, `scripts/lexicon/onboarding-pool.ts:47`, `utils/resources/emailStrings.js`, `services/onboarding/labels.ts`.
- i18n: `frontend/src/i18n.ts:43` has `supportedLngs`; `fallbackLng` is `'en'`. Missing French keys show English, so the interface can land in steps. About 1,400 strings in 14 namespaces. Locale parity tests: `features/{practice,auth,demo}/locales.test.ts` and `onboarding.test.tsx`.
- No special-character palette exists. Users type accents with their own keyboard. French needs nothing extra.
- The raw Wiktionary dump `backend/scripts/lexicon/.data/raw-wiktextract-data.jsonl.gz` (2.98 GB, 2026-10-03) is on the local disk. `extract.ts` filters it to `en|es|de|et`.
- Outside the app: `landing/app.js` (`LANGS`, `STRINGS`), `landing/index.html:70`, `landing/credits.html`, `landing/flags/`, the demo intro (`DemoIntro.tsx:53`), `.github/workflows/ci.yml:150` (lexicon fixtures) and `e2e/playwright.config.ts:93`.

## French form design (first iteration; for the teacher to check)

Sources for the research: Bescherelle (conjugation), Grevisse *Le Bon Usage*, CNRTL/TLFi, Académie française, Wiktionary, Universal Dependencies. Not blogs or AI sites. Every label, heading and pronoun is in French, like the other languages (the headings in `verbs.ts` are native terms).

| PoS | Fields (case names end in `FR`) | Notes |
|---|---|---|
| **Noun** | `genderFR` radio, required: `le` / `la` / `le/la` (new `GenderFR`, same shape as `GenderES`) · `regularityFR` radio · `singularFR` required · `pluralFR` | Plural irregulars: cheval/chevaux, œil/yeux. Elision (l'arbre) is a display rule only (review log M2). |
| **Verb** | `infinitiveFR` required, pattern `/(er\|ir\|re)$/` · `verbGroupFR` radio: 1er groupe / 2e groupe / 3e groupe (replaces regularity for French) · `auxVerbFR` toggle avoir / être · `reflexivityFR` radio (pronominal: se laver) · `pastParticipleFR`, `presentParticipleFR` · grid **Indicatif**: Présent, Imparfait, Passé composé, Futur simple × Je / Tu / Il/Elle/On / Nous / Vous / Ils/Elles | Case names `indicativePresent1sFR`, `indicativeImperfect…FR`, `indicativePerfect…FR`, `indicativeSimpleFuture…FR`. The passé composé gets an adornment, like the German Perfekt (`deAdornment`, `verbs.ts:272`): ai/as/a/avons/avez/ont or suis/es/est/sommes/êtes/sont. The user types the participle per person, so être agreement (allés) fits. The reflexive hint is me/te/se/nous/vous/se, before the verb. Subjunctive and conditional are deferred (teacher question). |
| **Adjective** | `maleSingularFR` required, `femaleSingularFR` required, `malePluralFR`, `femalePluralFR` (2×2 grid like ES) · `comparativeFR` with the box `periphrasticFR` ("plus " + the male singular, saved) · `superlativeFR`, always locked ("le " + the comparative, saved) · box `hasVowelFormFR` shows `vowelFormFR` (bel, nouvel, vieil) · optional `positionFR` radio: before / after / either | **Built in slice 4.** The superlative is a locked field (review log F1). The box and the form have two names because a property needs a prefix and a written form must not have one. |
| **Adverb** | `adverbFR` required · `gradableFR` radio (required, like EN/ES/EE) · `comparativeFR`, `superlativeFR` visible when gradable, periphrastic checkbox ("plus " / "le plus ") | Irregular: bien → mieux → le mieux, beaucoup → plus. Copy the ES adverb builder. |
| **Conjunction** | The shared `buildConfig` (`conjunctions.ts:89`): `conjunctionFR`, `conjunctionTypeFR`, `correlativeFR` + `secondPartFR` (ni … ni, soit … soit) · `moodFR` select like ES (bien que, pour que → subjonctif) | |
| **Preposition** | `prepositionFR` required · `positionFR` radio (durant can follow: "sa vie durant") | au/aux/du/des are a general rule for à and de (same as ES al/del): no field. |

New property prefixes (in `PROPERTY_PREFIXES`, `catalogue.ts`): `hasVowelForm` (slice 4, done) and `verbGroup` (slice 5). Check that `beforeVowel…`, `pastParticiple…` and `presentParticiple…` start with no property prefix (regression test).

Exercises (`catalogue.ts`): nouns use `singularFR` / `pluralFR`. Verbs: present → `indicativePresent`, past → `indicativeImperfect` (the passé composé form is a participle, so it is too easy), future → `indicativeSimpleFuture`. Drills: noun gender multiple choice (le, la, le/la), verb auxiliary multiple choice (avoir, être), text input infinitive → past participle.

## Slices

One slice at a time. Each slice starts with a plain-language overview, ends runnable with its tests green, adds its touchpoints to `add-language.md` and gets a suggested commit message.

**Slice 0 — Guide skeleton.** Create `.context/guides/add-language.md`. Sections: research template per language, decisions to take, touchpoint checklist by tier, what needs no change, rollout. Add its row to `.context/README.md`. Add a link in `add-part-of-speech.md` (its "do this for each of EN, ES, DE and EE" becomes "each language in the language table").

**Slice 1 — Consolidate the language lists (no behaviour change).**
- Backend: new `backend/lib/languages.ts`, the one table `{ name: 'German', suffix: 'DE', iso: 'de', i18n: 'de' }[]`. The lists in `userController`, `demoController`, `exercises/{types,validate,catalogue}`, `dictionary/{registry,translate}`, `wordSort`, `lexicon/translations.ts` and `scripts/lexicon/common.ts` read it. `load.js` is plain JS: it reads the table through `tsx`, or it keeps its list with a test that checks both are equal (decide in the slice overview).
- Frontend: one `LANG_SUFFIX` / key map in `lib/language.ts`, used by the six config files and by `review/{row,completion}.ts` (`LANG_BY_KEY`). The `UiLanguage['key']` and `['i18n']` unions are built from the table.
- All six `*_CONFIGS` maps become `Partial<Record<Lang, …>>`, so a language can land one PoS at a time (coverage already handles this).
- A cross-tier parity test: backend table = frontend `Lang` enum (pattern: `tests/demoTemplate.test.js:18` reads the frontend enum).
- Gate: `npm test`, `npm test -w frontend`, `npm run build`, `npm run test:e2e`.

**Slice 2 — French as a language (no forms yet).** `Lang.FR = 'French'`; a `UI_LANGUAGES` row (`FR`, `Français`, `fr`, `/FR.svg`); `public/FR.svg`; the `--lang-fr` token (light and dark, `tokens.css:51,80`); the backend table row; `common:languages.french` and `startFromWord.inLanguage.french` in the four old locales; the tests that pin the language count (`language.test.ts`, `metrics/selectors.test.ts`, `WelcomeBanner.test.tsx`, `test/msw/authHandlers.ts`, `wordHandlers.ts` …). Result: French can be picked, its card says "not available", and the interface falls back to English.

**Slice 3 — French interface.** 3a: `fr` in `supportedLngs` (`i18n.ts:43`) and in the Turnstile whitelist (`captcha/turnstile.ts:62`), moved here from slice 2 so that no file is requested before it exists; the 14 `frontend/public/locales/fr/*.json` files, and `fr` in the locale parity tests. 3b: emails (`emailStrings.js`), onboarding topic names (`services/onboarding/labels.ts`), the demo strings, and the landing page (`landing/app.js` `LANGS` and `STRINGS`, `landing/flags/FR.svg`, `index.html:70`). The strings get a review list for the teacher (by screen, not by key).

**Slice 4 — Noun and adjective forms.** Enums (`NounCases`, `AdjectiveCases`, `GenderFR`); `WordCasesData` noun rows; the `CaseName` and `interfaces.ts` unions; builders in `nouns.ts` and `adjectives.ts`; locales (`wordForm.noun|adjective.fields` and `errors.formFR` in all five); Review gender (`row.ts:33`, `FilterBar.tsx:46`, `WordCell.tsx:11` chip class for "le"); the `TranslationCard.tsx:349` gender lookup; backend `getRequiredFieldsData`, `wordSort` main case, catalogue nouns and drills; MSW `wordHandlers.ts`. Tests: config field lists, and a backend round trip of "le cheval / les chevaux". Put French back into the `LANGUAGES` list of `tests/unit/caseMapping.test.js` (explicit since slice 2).

**Slice 5 — Verb form.** `VerbCases` FR, `TenseVerbFR`, `VerbMoodFR`, the `VerbTenseData` unions (`wordCasesDataByPoS.ts:46`), registry rows, `PRONOUN_LABELS[FR]`, `buildFrConfig` (avoir/être adornment, reflexive hint), `lib/cases.ts` `TENSE_BUCKET`, catalogue `VERB_TENSES` and drills, `PROPERTY_PREFIXES` `verbGroup` with a regression test.

**Slice 6 — Adverb, conjunction and preposition forms.** Done 2026-10-26. `adverbs.ts` (the Spanish builder with the adjective's "plus" mechanism), `conjunctions.ts` (one `buildConfig` call + a mood select with the conditional), `prepositions.ts` (word + position).

**Slice 7 — Forms e2e spec and the teacher sheet.** Done 2026-10-26 (the e2e tests of the forms were added in slices 4 to 6). `e2e/tests/language-french-forms.spec.ts`: register with French, add a noun, a verb (with être) and an adjective, see them in `/words`, answer one practice card in French. Snapshot docs (`data-model.md`, `forms-*.md` French sections). `.context/plans/language-french-review.md` for the teacher: one section per PoS with each field, its French label, two example words filled in, and the open questions. Full `npm run test:e2e` green.

**Slice 8 — Autocomplete research.** Done 2026-10-26 (see "Slice 8 results"). The licence needed no new row in `licence-study.md`; the credits page needs French in its language list (slice 9a). `fr_50k` exists.

**Slice 9a — French lexicon and lookup: nouns, adjectives, adverbs, conjunctions, prepositions.** `common.ts` (`LANG_CODES` + `'fr'`, frequency URL; the file `frequency-fr.txt` exists); `extract.ts` (regex, and the translation target `fr`; the extract must stay repeatable); `selectors/fr.ts` per part of speech (like `es.ts`; rules in "Slice 8 results"; shared function-word selectors) + `lexiconSelectorsFR.test.js` + a fixture; `ingest.ts` `LANGUAGES` + `FIXTURE_WORDS`; `load.js`; `registry.ts` adapters; the gender → article map in `translations.ts`; the frontend `autocomplete/transforms.ts` registry; `StartFromWord`; the credits page (add French). Rebuild locally (extract about 5 minutes on this machine, then ingest, translations, load). Check with SQL counts per part of speech for `language = 'French'`.

**Slice 9b — French lexicon and lookup: verbs.** Done 2026-10-26. The verb selectors, with decisions A1–A2, A4, Q1–Q3 and V6 (the infinitive keeps its "se "); group by rule; auxiliary from the text row, empty for the dual verbs; reflexivity; both participles; present, imperfect and simple future per person; passé composé boxes filled with the masculine singular participle; skip `reflexive` rows when a plain table exists; skip `multiword-construction` text rows. Test the 35 hand-checked verbs and a regression for the dual-auxiliary and always-reflexive verbs. Then rebuild, reload and count.

**Slice 10 — Autocomplete e2e spec.** The fixture file `lexicon-fr-fixture.jsonl` exists since slice 9a. Wire it in `backend/package.json` (`lexicon:load:fixture`), `e2e/playwright.config.ts:93`, `ci.yml:150`. Spec `autocomplete-j-french-lexicon.spec.ts` (pattern: `autocomplete-c-spanish-lexicon`).

**Slice 11 — Onboarding pool and demo template.** Also: the texts "four languages" in `demo.json` (five locales) and the landing word card ("dance, in four languages"), and a French row in `DemoIntro.tsx`. `pool.tsv` gets `fr` and `fr_gender` from the English-hub translations (`scripts/lexicon/onboarding-pool.ts:47,193`, `onboarding-forms.ts:24`, `lib/onboardingPool.ts`, the pool README). `pool-forms.json` is rebuilt from the French lexicon. The demo `data.json` gets French translations, and `DemoIntro.tsx:53` gets an example row. `controllers/demoController.ts` `ALL_LANGUAGES` gets French (it is explicit since slice 2). Tests and an e2e touch.

**Slice 12 — Close.** Finish `add-language.md` and check it against the real diff of this branch (`git diff main --stat`). Write the final rollout runbook. Run the final full e2e suite.

## Rollout runbook (at or after the merge; written 2026-10-26, slice 12)

**Status (2026-10-27): staging loaded and tested (the user found one small issue, V10). Production: the user is loading it. Open item: step 7, delete the safety copy.**

**What and why.** The code (French forms, interface, onboarding pool, demo and landing page) goes out with the normal deploy when the branch merges to `main`: no migration, no new secret, no server step for the interface or the pool. Two kinds of server data need a manual step, because they live in the database and not in the repo:
1. **Reference data** (tables `lexemes` and `lexeme_translations`): the French lexicon and the translation file that now has French rows. Loaded with `deploy/ansible/lexicon.yml` (role `lexicon`). No user data changes.
2. **The demo template** (words of the template account): reseeded with `--reset` so it has the French words.

**When.** After the merge has reached staging and production (the merge deploys both, infrastructure guide 03). Before the load, a French lookup says "Sorry, we don't know this word" and a French draft from "Start from a word" has no French words. Both are harmless. A French user can still type words by hand.

**1. Check the files** (from `backend/`; they are already built, on 2026-10-26, in `scripts/lexicon/.data/out/`, which is git-ignored). Rebuild only if a selector, `extract.ts` or `ingest*.ts` changed after that date: `npx tsx scripts/lexicon/ingest.ts fr` and `npx tsx scripts/lexicon/ingest-translations.ts`.

| File | Size | Rows |
|---|---|---|
| `lexicon-fr-2026-10-03.jsonl.gz` | 2.4 MB | 84,873 lexemes (noun 53,261, adjective 19,161, verb 7,374, adverb 4,597, preposition 319, conjunction 161) |
| `translations-en-2026-10-03.jsonl.gz` | 7.3 MB (was 5.7 MB) | 413,356 rows, of which 113,115 are French |

The German, Spanish, English and Estonian lexicon files were not rebuilt, and the branch changed no selector of theirs (it only added French to `ingest.ts`, `extract.ts` and `common.ts`): do **not** reload them. The translation file is replaced as a whole (it holds every language).

**2. Safety copy on the VPS (optional).** The load overwrites `translations-en-2026-10-03.jsonl.gz` in `/opt/ladu/lexicon/`, which a database restore reloads. The new file has all the old rows, so a restore still works. To keep the old file: `ansible vps -b -m ansible.builtin.command -a "cp -a /opt/ladu/lexicon /opt/ladu/lexicon.before-french creates=/opt/ladu/lexicon.before-french"` (from `deploy/ansible/`).

**3. Staging first** (from `deploy/ansible/`; one command per file; each copies the file and runs `load.js` in `backend-staging` in one transaction):

```bash
ansible-playbook lexicon.yml -e lexicon_file=../../backend/scripts/lexicon/.data/out/lexicon-fr-2026-10-03.jsonl.gz -e '{"lexicon_environments": ["staging"]}'
ansible-playbook lexicon.yml -e lexicon_file=../../backend/scripts/lexicon/.data/out/translations-en-2026-10-03.jsonl.gz -e '{"lexicon_environments": ["staging"]}'
```

**4. Check staging** (SQL shell as in guide 02, "Check what is loaded"):

```sql
SELECT language, part_of_speech, count(*) FROM lexemes WHERE language = 'French' GROUP BY 1, 2 ORDER BY 2;
SELECT language, count(*) FROM lexeme_translations GROUP BY 1 ORDER BY 1;
```

Expected: the lexeme counts of the table above (French only; the other languages unchanged) and 113,115 French translation rows. Then, at `staging.ladu.com.ar`, try: French noun `cheval` (le, `chevaux`), verb `aimer` (group, `avoir`, forms), `partir` (no auxiliary), `se laver` (Always reflexive, `être`), adjective `beau` (`bel`), conjunction `parce que` (Subordinating); and "Start from a word": English `dog` → the French card has `chien`.

**5. Reseed the demo template on staging**, then check it: `docker exec backend-staging node scripts/seed-demo-template.js --reset` (guide 02, "demo template"). Start a demo with all five languages; the words have a French card. Then try the onboarding with a French learner account (the pool has French words for 558 of 583 concepts).

**6. Production**: the same two load commands with `-e '{"lexicon_environments": ["prod"]}'`, the same SQL checks and two lookups on `ladu.com.ar`, then `docker exec backend-prod node scripts/seed-demo-template.js --reset`.

- [ ] **7. REMINDER, on or after 2026-10-31: delete the safety copy** (if it was made in step 2). Command, from `deploy/ansible/`: `ansible vps -b -m ansible.builtin.file -a "path=/opt/ladu/lexicon.before-french state=absent"`. Tick this box when done.

**7 (details). Delete the safety copy a few days after production works** (it is about 30 MB and nothing deletes it by itself): `ansible vps -b -m ansible.builtin.file -a "path=/opt/ladu/lexicon.before-french state=absent"`.

**Cautions.** A load replaces one language (a translation load replaces all translations) in one transaction: a failed load changes nothing. A reload keeps the old rows until autovacuum frees them (guide 02). `--reset` of the demo template replaces the template account; running demos are copies and are not touched.

**After the rollout (not server work).** French is a first draft (decision M1). Say so in the release note. The teacher answers the two sheets and the starter-word questions (`language-french-review.md`, `language-french-strings.md`); each answer is a small follow-up.

## Verification

- Per slice: `npm test` (backend), `npm test -w frontend`, `npm run build`. Do not pipe them through `tail` or `head`.
- Manual: `npm run dev`, register with French, add the example words of the slice on `/addWord`, switch the interface to Français.
- e2e: `npm run test:e2e` at slices 1, 7, 10, 11 and 12. It has its own ports and database: `npm run dev` can keep running.
- Lexicon: SQL counts per PoS for `language = 'French'` after the local load (slice 9).
