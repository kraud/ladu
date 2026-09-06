# Verb Form Field Specifications

Transcribed verbatim from the old form components under `frontend/src/components/forms/verbs/`.
Shared scaffolding (NOT re-transcribed here): every form hydrates via `currentTranslationData.cases` (effect push-up), has a `currentCases` effect, and renders through `TextInputFormWithHook` / `SelectFormHook` / `RadioGroupFormHook` / `CheckboxGroupFormHook`.

Routing — `frontend/src/components/forms/WordFormSelector.tsx:54-103` (`getVerbForm`), switch on `props.currentLang`:
- `Lang.ES` → `VerbFormES`
- `Lang.EN` → `VerbFormEN`
- `Lang.EE` → `VerbFormEE`
- `Lang.DE` → `VerbFormDE`

Case-key enums (`VerbCases`, `VerbRegularity`, `AuxVerbDE`, `PrefixesVerbDE`, `VerbCaseTypeDE`) live in `frontend/src/ts/enums.ts` (see "Enums" at the end).

---

## English Verb — VerbFormEN.tsx

**Source schema:** `frontend/src/components/forms/verbs/VerbFormEN.tsx:35-87` (`validationSchema = Yup.object().shape({ ... })`).

### Yup schema fields (verbatim names + rules)

| Field | Rules |
|---|---|
| `regularity` | `Yup.string().matches(/^[^0-9]+$|^$/, noNumbers).matches(/^(regular\|irregular)?$/, formEN.regularityRequired)` — optional |
| `simplePresent1s` | `.required(formEN.simplePresentRequired).matches(/^[^0-9]+$|^$/, noNumbers)` |
| `simplePresent2s` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `simplePresent3s` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `simplePresent1pl` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `simplePresent3pl` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `simplePast1s` | `.matches(/^[^0-9]+$|^$/, noNumbers)` — **not** `.nullable()`, **not** `.required()` |
| `simplePast2s` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `simplePast3s` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `simplePast1pl` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `simplePast3pl` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `simpleFuture1s` | `.matches(/^[^0-9]+$|^$/, noNumbers)` — not `.nullable()`, not `.required()` |
| `simpleFuture2s` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `simpleFuture3s` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `simpleFuture1pl` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `simpleFuture3pl` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `simpleConditional1s` | `.matches(/^[^0-9]+$|^$/, noNumbers)` — not `.nullable()`, not `.required()` |
| `simpleConditional2s` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `simpleConditional3s` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `simpleConditional1pl` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `simpleConditional3pl` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |

Note the asymmetry: only the Present tense carries a `.required()` field, and only Present `1s` is required. Past/Future/Conditional `1s` are plain `Yup.string()` (not nullable, not required); all non-`1s` fields use `.nullable()`.

### Structural fields

- `regularity` — `RadioGroupWithHook`, label "Regularity", options `[VerbRegularity.regular, VerbRegularity.irregular]` (`"regular"`, `"irregular"`), `defaultValue ""`. State type `"regular"|"irregular"|""`.

### Rendered field order

1. `AutocompleteButtonWithStatus` (query = `simplePresent1s`) → dispatches `getAutocompletedEnglishVerbData(simplePresent1s)`.
2. Regularity (radio).
3. Header `Simple:` (h4, underlined).
4. **Present** (h5): `simplePresent1s` "I", `simplePresent2s` "You", `simplePresent3s` "He/She/it", `simplePresent1pl` "We", `simplePresent3pl` "They".
5. **Past** (h5): `simplePast1s` "I", `simplePast2s` "You", `simplePast3s` "He/She/it", `simplePast1pl` "We", `simplePast3pl` "They".
6. **Future** (h5): `simpleFuture1s` "I", `simpleFuture2s` "You", `simpleFuture3s` "He/She/it", `simpleFuture1pl` "We", `simpleFuture3pl` "They".
7. **Conditional** (h5): `simpleConditional1s` "I", `simpleConditional2s` "You", `simpleConditional3s` "He/She/it", `simpleConditional1pl` "We", `simpleConditional3pl` "They".

### Language-specific notes

- 5 pronoun slots per tense (no distinct 2pl — "You" doubles as 2s/2pl; 1pl and 3pl only). 3s covers m/f/n.
- `VerbCases` enum also defines unused compound cases (`progressivePPFCAllEN`, `perfectPPFCAllEN`, `perfectProgressivePPFCAllEN`) — not in schema, not rendered.

---

## Spanish Verb — VerbFormES.tsx

**Source schema:** `frontend/src/components/forms/verbs/VerbFormES.tsx:33-103`.

### Yup schema fields (verbatim names + rules)

| Field | Rules |
|---|---|
| `regularity` | `Yup.string().matches(/^[^0-9]+$|^$/, noNumbers).matches(/^(regular\|irregular)?$/, formES.regularityRequired)` — optional |
| `infinitiveNonFiniteSimple` | `.required(formES.infinitiveNonFiniteRequired).matches(/^[^0-9]+$/, noNumbers).matches(/^(?!.*\d).*(ar\|er\|ir)$/, "Please input infinitive form (ends in '-ar', '-er' or '-ir').")` |
| `gerundNonFiniteSimple` | `.required(formES.gerundNonFiniteRequired).matches(/^[^0-9]+$/, noNumbers)` |
| `participleNonFiniteSimple` | `.required(formES.participleNonFiniteRequired).matches(/^[^0-9]+$/, noNumbers)` |
| `indicativePresent1s` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativePresent2s` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativePresent3s` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativePresent1pl` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativePresent2pl` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativePresent3pl` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativeImperfectPast1s` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativeImperfectPast2s` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativeImperfectPast3s` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativeImperfectPast1pl` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativeImperfectPast2pl` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativeImperfectPast3pl` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativePerfectSimplePast1s` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativePerfectSimplePast2s` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativePerfectSimplePast3s` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativePerfectSimplePast1pl` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativePerfectSimplePast2pl` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativePerfectSimplePast3pl` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativeFuture1s` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativeFuture2s` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativeFuture3s` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativeFuture1pl` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativeFuture2pl` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativeFuture3pl` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |

### Structural fields

- `regularity` — `RadioGroupWithHook`, label "Regularity", options `[regular, irregular]`, `defaultValue ""`. (Bug note: the ES regularity radio passes `errors={errors.auxiliaryVerb}` instead of `errors.regularity` — copy-paste artifact at line 781.)
- Non-finite forms (mandatory, cannot be autocompleted — declared under "Mandatory fields"):
  - `infinitiveNonFiniteSimple` — text, label "Infinitive non-finite simple".
  - `gerundNonFiniteSimple` — text, label "Gerund non-finite simple".
  - `participleNonFiniteSimple` — text, label "Participle non-finite simple".

### Rendered field order

1. `AutocompleteButtonWithStatus` (query = `infinitiveNonFiniteSimple`) → `getAutocompletedSpanishVerbData`.
2. Infinitive non-finite simple (text).
3. Gerund non-finite simple (text).
4. Participle non-finite simple (text).
5. Regularity (radio).
6. Header `Modo indicativo:` (h3, underlined).
7. Header `Tiempo simple:` (h4).
8. **Presente** (h6): `indicativePresent1s` "Yo", `2s` "Vos", `3s` "Él/Ella/eso", `1pl` "Nosotros/as", `2pl` "Ustedes", `3pl` "Ellos/as".
9. **Pret. imperfecto** (h6): `indicativeImperfectPast1s` "Yo", `2s` "Vos", `3s` "Él/Ella/eso", `1pl` "Nosotros/as", `2pl` "Ustedes", `3pl` "Ellos/as".
10. **Pret. perfecto** (h6): `indicativePerfectSimplePast1s` "Yo", `2s` "Vos", `3s` "Él/Ella/eso", `1pl` "Nosotros/as", `2pl` "Ustedes", `3pl` "Ellos/as".
11. **Future** (h6): `indicativeFuture1s` "Yo", `2s` "Vos", `3s` "Él/Ella/eso", `1pl` "Nosotros/as", `2pl` "Ustedes", `3pl` "Ellos/as".

### Language-specific notes

- 6 pronoun slots per tense (1s/2s/3s/1pl/2pl/3pl). Label uses "Vos"/"Ustedes" with a TODO comment about other Spanish styles.
- The `VerbCases` enum defines additional ES cases NOT implemented in the form: compound non-finites (`infinitiveNonFiniteCompound`, `gerundNonFiniteCompound`), `indicativeConditional*ES` (6), `SUBJECTIVE` (empty), and `imperative*ES` (6). None appear in the schema or JSX — only the indicative simple tenses above are rendered.

---

## German Verb — VerbFormDE.tsx

**Source schema:** `frontend/src/components/forms/verbs/VerbFormDE.tsx:41-105`.

### Yup schema fields (verbatim names + rules)

| Field | Rules |
|---|---|
| `infinitive` | `.required(formDE.infinitiveNonFiniteRequired).matches(/^[^0-9]+$/, noNumbers).matches(/^(?!.*\d).*(en\|ern\|eln)$/, formDE.infinitiveNotMatching)` |
| `auxiliaryVerb` | `Yup.string()` — no rules (comment: `// TODO: should this be mandatory?`) |
| `verbCases` | `Yup.array()` |
| `prefix` | `Yup.string()` — no rules (comment: `// TODO: should this be mandatory?`) |
| `regularity` | `Yup.string().matches(/^[^0-9]+$|^$/, noNumbers).matches(/^(regular\|irregular)?$/, formEN.regularityRequired)` — optional (note: error key is `formEN` here) |
| `indicativePresent1s` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativePresent2s` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativePresent3s` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativePresent1pl` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativePresent2pl` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativePresent3pl` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativePerfect1s` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativePerfect2s` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativePerfect3s` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativePerfect1pl` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativePerfect2pl` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativePerfect3pl` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativeSimpleFuture1s` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativeSimpleFuture2s` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativeSimpleFuture3s` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativeSimpleFuture1pl` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativeSimpleFuture2pl` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativeSimpleFuture3pl` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativeSimplePast1s` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativeSimplePast2s` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativeSimplePast3s` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativeSimplePast1pl` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativeSimplePast2pl` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `indicativeSimplePast3pl` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |

### Structural fields

- `infinitive` — text, label "Infinitive", mandatory, cannot be autocompleted.
- `auxiliaryVerb` — Select, label "Auxiliary verb", options `[AuxVerbDE.H, AuxVerbDE.S]` = `["haben", "sein"]`. State type `"haben"|"sein"|""`. (Note: `AuxVerbDE.W` = `"werden"` exists in the enum but is NOT offered here.)
- `prefix` — Select, label "Prefix", options `Object.values(PrefixesVerbDE)` (all 26 prefixes, see Enums), `defaultValue ""`, `suffix='-'`. Hidden behind a "Display prefixes" / "Hide prefixes" `Button` toggling a `Collapse` (`displayPrefixList` state; auto-shown when `autoDetectedPrefix.detected` is true). Prefix is auto-detected from `infinitive` via `checkForPatternPrefixDE(infinitive)` (debounced ~2s), surfaced as a tooltip.
- `verbCases` — `CheckboxGroupWithHook`, groupLabel "Verb case", options `[{label:'Accusative', value:accusativeDE}, {label:'Dative', value:dativeDE}, {label:'Genitive', value:genitiveDE}]`, `defaultValue []`. Stored as `CheckboxItemData[]`; serialized to an acronym string (acc→`A`, dat→`D`, gen→`G`) via `getAcronymFromVerbCaseTypes` / deserialized via `getVerbCaseTypesFromAcronym`. (Bug note: passes `errors={errors.auxiliaryVerb}` at line 881.)
- `regularity` — `RadioGroupWithHook`, label "Regularity", options `[regular, irregular]`.

### Rendered field order

1. `AutocompleteButtonWithStatus` (query = `infinitive`) → `getAutocompletedGermanVerbData`.
2. Infinitive (text).
3. Regularity (radio).
4. Auxiliary verb (select: haben / sein).
5. "Display prefixes" button → Prefix (select, collapsed by default).
6. Verb case (checkbox group: Accusative / Dative / Genitive).
7. Header `Indicative:` (h4, underlined).
8. **Present** (h5): `indicativePresent1s` "Ich", `2s` "Du", `3s` "Er/Sie/es", `1pl` "Wir", `2pl` "Ihr", `3pl` "Sie".
9. **Present Perfect (Perfekt)** (h5): `indicativePerfect1s..3pl` "Ich/Du/Er-Sie-es/Wir/Ihr/Sie". Each input shows a `startAdornment` of the conjugated auxiliary — `(auxiliaryVerb !== 'haben' ? seinPresentAndPastJSON : habenPresentAndPastJSON).present.<Sg1..Pl3>`.
10. **Simple future (Futur 1)** (h5): `indicativeSimpleFuture1s..3pl` "Ich/Du/Er-Sie-es/Wir/Ihr/Sie", each with `startAdornment` `werdenPresentAndPastJSON.present.<Sg1..Pl3>`.
11. **Simple Past (präteritum)** (h5): `indicativeSimplePast1s..3pl` "Ich/Du/Er-Sie-es/Wir/Ihr/Sie" (no adornment).

### Language-specific notes

- 6 pronoun slots per tense. Perfect/Future inputs carry a read-only conjugated-auxiliary prefix.
- Schema comment ordering slightly differs from render order: schema lists present → perfect → simple future → simple past; the JSX renders present → perfect → future → past (same order).
- `VerbCases` enum also defines `VerbMoodDE` (indicative/subjunctive/imperative) and `VerbTensesIndicativeDE` (6 tenses) — subjunctive/imperative and plusquamperfekt/future-perfect are NOT implemented in this form.

---

## Estonian Verb — VerbFormEE.tsx

**Source schema:** `frontend/src/components/forms/verbs/VerbFormEE.tsx:39-95`.

### Yup schema fields (verbatim names + rules)

| Field | Rules |
|---|---|
| `regularity` | `Yup.string().matches(/^[^0-9]+$|^$/, noNumbers).matches(/^(regular\|irregular)?$/, formEN.regularityRequired)` — optional |
| `infinitiveMa` | conditional on `searchInEnglish`: if true → `.required(formEE.infinitiveMaRequired).matches(/^[^0-9]+$/, noNumbers)`; else → `.required(...).matches(/^[^0-9]+$/, noNumbers).matches(/^(?!.*\d).*(ma)$/, formEE.infinitiveMaNotMatching)` |
| `infinitiveDa` | `.required(formEE.infinitiveDaRequired).matches(/^[^0-9]+$/, noNumbers)` |
| `kindelPresent1s` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `kindelPresent2s` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `kindelPresent3s` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `kindelPresent1pl` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `kindelPresent2pl` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `kindelPresent3pl` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `kindelSimplePast1s` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `kindelSimplePast2s` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `kindelSimplePast3s` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `kindelSimplePast1pl` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `kindelSimplePast2pl` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `kindelSimplePast3pl` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `kindelPastPerfect1s` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `kindelPastPerfect2s` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `kindelPastPerfect3s` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `kindelPastPerfect1pl` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `kindelPastPerfect2pl` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |
| `kindelPastPerfect3pl` | `.nullable().matches(/^[^0-9]+$|^$/, noNumbers)` |

### Structural fields

- `searchInEnglish` — `Checkbox` inside a `FormControlLabel` (labelPlacement "end"), wrapped in a `Tooltip` (title `formEE.searchInEnglishWarning`), label `formEE.searchInEnglishLabel`. State `useState(false)`. When true, the `-ma` infinitive is no longer required to end in `ma` (used for English-query autocomplete).
- `regularity` — `RadioGroupWithHook`, label "Regularity", options `[regular, irregular]`.
- `infinitiveMa` — text, label "-ma infinitive", mandatory.
- `infinitiveDa` — text, label "-da infinitive", mandatory.

### Rendered field order

1. `AutocompleteButtonWithStatus` (query = `infinitiveMa`, `searchInEnglish=searchInEnglish`) → `getAutocompletedEstonianVerbData({ query, searchInEnglish })`.
2. `searchInEnglish` checkbox.
3. `-ma infinitive` (text).
4. `-da infinitive` (text).
5. Regularity (radio).
6. Header `Kindel:` (h4, underlined).
7. **Present** (h6): `kindelPresent1s` "Mina", `2s` "Sina", `3s` "Tema", `1pl` "Meie", `2pl` "Teie", `3pl` "Nad".
8. **Simple past** (h6): `kindelSimplePast1s` "Mina", `2s` "Sina", `3s` "Tema", `1pl` "Meie", `2pl` "Teie", `3pl` "Nad".
9. **Past perfect** (h6): `kindelPastPerfect1s` "Mina", `2s` "Sina", `3s` "Tema", `1pl` "Meie", `2pl` "Teie", `3pl` "Nad".

### Language-specific notes

- 6 pronoun slots per tense; 3 tenses (present / simple past / past perfect) under the single `Kindel` (indicative) mood. No negative (`ei`+`nud`) variants implemented (marked TODO in the enum).
- The `searchInEnglish` toggle is the only per-language special field; the `-ma` infinitive ending-match is conditionally relaxed by it.
- `VerbMoodEE` enum defines indicative/subjunctive/conditional/jussive — only indicative (Kindel) is implemented.

---

## Enums (source `frontend/src/ts/enums.ts`)

- `VerbRegularity` (:398-401): `regular = 'regular'`, `irregular = 'irregular'`.
- `AuxVerbDE` (:458-462): `H = "haben"`, `S = "sein"`, `W = "werden"`.
- `VerbCaseTypeDE` (:304-310): `accusativeDE = 'accusativeDE'`, `dativeDE = 'dativeDE'`, `genitiveDE = 'genitiveDE'` (accusativeDative commented out).
- `PrefixesVerbDE` (:311-396), 26 values: `ab`, `an`, `auf`, `aus`, `bei`, `da`, `dar`, `durch`, `ein`, `fern`, `fest`, `fort`, `gegen`, `her`, `hin`, `los`, `mit`, `nach`, `nieder`, `um`, `vor`, `weg`, `wieder`, `zu`, `zusammen`, `zuryck = 'zurück'` (NB: enum key `zuryck` is a typo in the source; value is `zurück`).
- `VerbMoodDE` (:403-407): indicative/subjunctive/imperative. `VerbMoodEN` (:409-414): indicative/subjunctive/imperative/conditional. `VerbMoodES` (:416-421): indicative/subjunctive/imperative/conditional. `VerbMoodEE` (:423-428): indicative/subjunctive/conditional/jussive. `VerbTensesIndicativeDE` (:430-437): present/simplePast/presentPerfect/pastPerfect/simpleFuture/futurePerfect.

`VerbCases` (:97-303) — verbatim keys by language (used as `caseName` in the push-up effect):
- **EN:** `regularityEN`; `simplePresent1sEN/2sEN/3sEN/1plEN/3plEN`; `simplePast1sEN/2sEN/3sEN/1plEN/3plEN`; `simpleFuture1sEN/2sEN/3sEN/1plEN/3plEN`; `simpleConditional1sEN/2sEN/3sEN/1plEN/3plEN`; `progressivePPFCAllEN`, `perfectPPFCAllEN`, `perfectProgressivePPFCAllEN`.
- **ES:** `regularityES`; `infinitiveNonFiniteSimpleES`, `gerundNonFiniteSimpleES`, `participleNonFiniteSimpleES`; `infinitiveNonFiniteCompound`, `gerundNonFiniteCompound`; `indicativePresent1sES/2sES/3sES/1plES/2plES/3plES`; `indicativeImperfectPast1sES/2sES/3sES/1plES/2plES/3plES`; `indicativePerfectSimplePast1sES/2sES/3sES/1plES/2plES/3plES`; `indicativeFuture1sES/2sES/3sES/1plES/2plES/3plES`; `indicativeConditional1sES/2sES/3sES/1plES/2plES/3plES`; `imperative1sES/2sES/3sES/1plES/2plES/3plES`.
- **EE:** `regularityEE`; `infinitiveMaEE`, `infinitiveDaEE`; `kindelPresent1sEE/2sEE/3sEE/1plEE/2plEE/3plEE`; `kindelSimplePast1sEE/2sEE/3sEE/1plEE/2plEE/3plEE`; `kindelPastPerfect1sEE/2sEE/3sEE/1plEE/2plEE/3plEE`.
- **DE:** `infinitiveDE`, `auxVerbDE`, `caseTypeDE`, `prefixDE`, `regularityDE`; `indicativePresent1sDE/2sDE/3sDE/1plDE/2plDE/3plDE`; `indicativePerfect1sDE/2sDE/3sDE/1plDE/2plDE/3plDE`; `indicativeSimpleFuture1sDE/2sDE/3sDE/1plDE/2plDE/3plDE`; `indicativeSimplePast1sDE/2sDE/3sDE/1plDE/2plDE/3plDE`.
