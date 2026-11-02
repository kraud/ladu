# French lexicon: coverage research (slice 8, 2026-10-26)

Research record, kept whole. It was a section of the French plan (archive record `2026-10-language-french`). The design that used it is in `.context/features/french.md`; the method to repeat for the next language is in `.context/guides/add-language.md`. Template of the first coverage report: `research/autocomplete-coverage-report.md`.

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
