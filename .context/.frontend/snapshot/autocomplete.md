# Autocomplete — endpoint variants & sanitization transforms

*2026-09-05. Full spec of the word-form autocomplete: the 8 backend endpoints, the external-API response shapes, and the 4 shared sanitize transforms in `frontend/src/components/forms/autocompleteFormFunctions.ts` (392 lines). Complements `data-model.md` §2.7 (`EstonianAPIRequest`) and `forms-*.md` (which form calls which endpoint).*

---

## 1. Endpoint variants (8, from `autocompletedTranslationService.ts`)

All `GET`, Bearer-token, base `/api/autocompleteTranslations`:

| Service method | Path | Query params | Sanitize | Consumer (form) |
|----------------|------|--------------|----------|-----------------|
| `getEstonianNounData` | `/estonian/noun/:query` | `searchInEnglish` (bool) | `sanitizeDataStructureEENoun` | NounFormEE |
| `getEstonianAdjectiveData` | `/estonian/adjective/:query` | — | `sanitizeDataStructureEEAdjective` | AdjectiveFormEE |
| `getEstonianVerbData` | `/estonian/verb/:query` | `searchInEnglish` (bool) | `sanitizeDataStructureEEVerb` | VerbFormEE |
| `getSpanishVerbData` | `/spanish/verb/:query` | — | `sanitizeDataStructureESVerb` | VerbFormES |
| `getSpanishNounGender` | `/spanish/noun/:query` | — | *inline (gender only)* | NounFormES |
| `getGermanVerbData` | `/german/verb/:query` | — | *inline* | VerbFormDE |
| `getGermanNounData` | `/german/noun/:query` | — | *inline* | NounFormDE |
| `getEnglishVerbData` | `/english/verb/:query` | — | *inline* | VerbFormEN |

**Key architectural fact**: only the 4 Estonian + Spanish-verb cases have shared sanitize transforms in `autocompleteFormFunctions.ts`. The other 4 (ES noun gender, DE verb, DE noun, EN verb) sanitize **inline** inside their form components (`forms-nouns.md`/`forms-verbs.md` note which). The rewrite lifts all 8 into query transforms with a typed key factory (`useAutocompleteTranslation(lang, pos, query)` — study §9 flow #7).

The query key factory needs 8 variants: `['autocompleteTranslation', 'estonian'|'spanish'|'german'|'english', 'noun'|'verb'|'adjective', query]`; `searchInEnglish` rides the EE noun/verb params (`EstonianAPIRequest`, `data-model.md` §2.7).

## 2. External-API response types (EE — `autocompleteFormFunctions.ts:5-45`)

The Estonian dictionary API returns a verbose `WordSearchResultStructureEE`; the sanitizers reduce it to a sparse `TranslationItem`.

```ts
interface WordSearchResultStructureEE {
  requestedWord: string, estonianWord: string,
  searchResult: SearchResultStructure[],   // usually [0] is the match
  translations: TranslationStructure[],
}
interface SearchResultStructure {
  wordClasses: string[],                   // e.g. ['noomen'] | ['verb']
  wordForms: WordFormStructure[],          // code → value
  meanings: MeaningStructure[],
  similarWords: string[],
}
interface WordFormStructure { inflectionType: string, code: string, morphValue: string, value: string }
interface MeaningStructure { definition: string, partOfSpeech: PartOfSpeechStructure[], examples: string[], synonyms: string[] }
```

The sanitizers read `request.searchResult[0].wordForms` via `getWordFromWordFormsList(wordForms, code)` which finds the `WordFormStructure` whose `code === propertyNameInAPI` and returns its `value` (else `""`).

### EE word-form codes used

| Code | Meaning | Feeds case |
|------|---------|-----------|
| `SgN` | singular nominative | `singularNimetavEE` / `algvorreEE` |
| `PlN` | plural nominative | `pluralNimetavEE` |
| `SgG` | singular genitive | `singularOmastavEE` |
| `PlG` | plural genitive | `pluralOmastavEE` |
| `SgP` | singular partitive | `singularOsastavEE` |
| `PlP` | plural partitive | `pluralOsastavEE` |
| `SgAdt` | short illative | `shortFormEE` (noun) |
| `Sup` | -ma infinitive (supine) | `infinitiveMaEE` |
| `Inf` | -da infinitive | `infinitiveDaEE` |
| `IndPrSg1..3` / `IndPrPl1..3` | indicative present | `kindelPresent*EE` |
| `IndIpfSg1..3` / `IndIpfPl1..3` | indicative simple past | `kindelSimplePast*EE` |
| `PtsPtPs` | past participle | `kindelPastPerfect*EE` (all six — same value) |

## 3. Sanitize transforms (4)

Each returns a discriminated union: `{ foundX: true, xData: TranslationItem }` or `{ foundX: false }`.

### 3.1 `sanitizeDataStructureEENoun(request)` — `:95-145`

Gate: `searchResult.length > 0 && searchResult[0].wordClasses[0] === 'noomen'`.
Cases → `singularNimetavEE`(SgN), `pluralNimetavEE`(PlN), `singularOmastavEE`(SgG), `pluralOmastavEE`(PlG), `singularOsastavEE`(SgP), `pluralOsastavEE`(PlP), and **conditionally** `shortFormEE` (SgAdt, split on `,` taking `[0]`) only if the short form exists (`getShortFormEENounIfExist` — `:85-91`). Note: `shortFormExists` checks the raw `SgAdt` value `!== "-"`.

### 3.2 `sanitizeDataStructureEEAdjective(request)` — `:148-191`

Gate: `searchResult.length > 0 && searchResult[0].meanings[0].partOfSpeech[0].code === 'adj'`.
Cases: `algvorreEE`(SgN), `pluralNimetavEE`(PlN), `singularOmastavEE`(SgG), `pluralOmastavEE`(PlG), `singularOsastavEE`(SgP), `pluralOsastavEE`(PlP). **Does not** fill comparative/superlative (`keskvorreEE`/`ulivorreEE`) — those remain manual.

### 3.3 `sanitizeDataStructureEEVerb(request)` — `:194-289`

Gate: `searchResult[0].wordClasses[0] === 'verb'`.
Cases (in order): `infinitiveMaEE`(Sup), `infinitiveDaEE`(Inf), kindel present ×6 (`IndPrSg1..3`/`IndPrPl1..3`), kindel simple past ×6 (`IndIpf*`), kindel past perfect ×6 — **all from `PtsPtPs`** (same participle; auxiliary verb per pronoun is not filled).

### 3.4 `sanitizeDataStructureESVerb(request)` — `:340-392`

Input is `VerbESResponse { foundVerb, verbData: VerbConjugation }` (not the EE shape). Gate: `request.foundVerb`.
Cases: **indicative present only** — `indicativePresent1s/2s/3s/1pl/2pl/3plES` from `verbData.indicative.present.{singular,plural}.{first,second,third}`. The `VerbConjugation` interface (`:300-339`) declares the full subjunctive/conditional/imperative/perfect conjugation, but the sanitizer only extracts indicative present — **the rest of the Spanish verb is manual**.

## 4. Rebuild checklist

1. One axios/query layer for all 8 endpoints; typed key factory (`['autocompleteTranslation', lang, pos, query]`).
2. Port the 4 transforms verbatim as query `select`/transform fns; lift the 4 inline sanitizers (ES noun gender, DE noun/verb, EN verb) into the same layer.
3. Keep the found/partial/not-found status (`foundX` boolean) feeding `AutocompleteButtonWithStatus`.
4. Debounce via per-instance `useDebouncedCallback` (not the module-global `setTimerTriggerFunction`, `general-use-functions.md` §6).
5. Known limits to preserve (or consciously change): EE adjective lacks comparative/superlative; EE verb past-perfect all share one participle; ES verb fills indicative-present only.
