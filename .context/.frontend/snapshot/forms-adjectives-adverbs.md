# Ladu Word Forms — Adjectives & Adverbs (Field Spec)

Transcribed verbatim from the old React form components. Every form hydrates via `currentTranslationData.cases` (effect push-up), has a `currentCases` effect mapping field state → `WordItem[]` (each `.word` lowercased with `.toLowerCase()`), and renders through `TextInputFormWithHook` / `RadioGroupFormHook`. Each schema is resolved via `yupResolver(schema)` with `mode: "all"` (validates on every change, no submit).

Routing (`frontend/src/components/forms/WordFormSelector.tsx`) is keyed on `PartOfSpeech` then `Lang`:

- `getPartOfSpeechForm()` (lines 33–52): `noun` → `getNounForm()`, `adjective` → `getAdjectiveForm()`, `adverb` → `getAdverbForm()`, `verb` → `getVerbForm()`, else `wordFormSelector.partOfSpeechNotAvailable`.
- `getAdjectiveForm()` (lines 148–198): EN → `AdjectiveFormEN`, ES → `AdjectiveFormES`, DE → `AdjectiveFormDE`, EE → `AdjectiveFormEE`, default → hardcoded `"That language is not available yet"`.
- `getAdverbForm()` (lines 106–146): EN → `AdverbFormEN`, ES → `AdverbFormES`, DE → `AdverbFormDE`, default → `wordFormSelector.languageNotAvailable`. **There is NO `Lang.EE` case → NO Estonian adverb form.**

---

## EN Adjective — `AdjectiveFormEN.tsx`
Source: `frontend/src/components/forms/adjectives/AdjectiveFormEN.tsx`

### yup schema (lines 22–30)
`Yup.object().shape({ … })`

| Field | Type | Rules (verbatim) |
|---|---|---|
| `positive` | `Yup.string()` | `.required(t('wordForm.adjective.errors.formEN.positiveDegreeRequired'))` + `.matches(/^[^0-9]+$/, t('wordForm.errors.noNumbers'))` |
| `comparative` | `Yup.string().nullable()` | `.matches(/^[^0-9]+$|^$/, t('wordForm.errors.noNumbers'))` |
| `superlative` | `Yup.string().nullable()` | `.matches(/^[^0-9]+$|^$/, t('wordForm.errors.noNumbers'))` |

`AdjectiveData` interface (lines 32–36): `positive`, `comparative`, `superlative` — all `string`, default `""`.

### Structural fields
None (no gender / regularity / prefix toggles).

### Rendered field order (all `TextInputFormWithHook`, `xs=12 md=4`)
1. `positive` — label `"Positive"`
2. `comparative` — label `"Comparative"`
3. `superlative` — label `"Superlative"`

### Notes
- English adjective = 3 degree fields; `positive` required, comparative/superlative optional (nullable, allow empty).
- All values `.toLowerCase()` before being pushed to cases (`AdjectiveCases.positiveEN` / `comparativeEN` / `superlativeEN`).

---

## ES Adjective — `AdjectiveFormES.tsx`
Source: `frontend/src/components/forms/adjectives/AdjectiveFormES.tsx`

Two schemas; the resolver switches on `adjective.gender === "Neutral"`:
```
resolver: yupResolver((adjective.gender === "Neutral") ? validationSchemaNeutral : validationSchemaByGender)
```

### yup schema A — `validationSchemaByGender` (lines 24–40)
`Yup.object().shape({ … })`

| Field | Type | Rules (verbatim) |
|---|---|---|
| `gender` | `Yup.string()` | `.required(t('wordForm.adjective.errors.formES.genderRequired'))` + `.oneOf(["Neutral", "M/F"], "Required")` |
| `maleSingular` | `Yup.string()` | `.required(t('wordForm.adjective.errors.formES.singularMasculineDegreeRequired'))` + `.matches(/^[^0-9]+$/, t('wordForm.errors.noNumbers'))` |
| `femaleSingular` | `Yup.string()` | `.required(t('wordForm.adjective.errors.formES.singularFemaleDegreeRequired'))` + `.matches(/^[^0-9]+$|^$/, t('wordForm.errors.noNumbers'))` |
| `malePlural` | `Yup.string().nullable()` | `.matches(/^[^0-9]+$|^$/, t('wordForm.errors.noNumbers'))` |
| `femalePlural` | `Yup.string().nullable()` | `.matches(/^[^0-9]+$|^$/, t('wordForm.errors.noNumbers'))` |
| (commented) | — | `// neutralSingular`, `// neutralPlural` omitted for TS compat |

### yup schema B — `validationSchemaNeutral` (lines 43–57)
`Yup.object().shape({ … })`

| Field | Type | Rules (verbatim) |
|---|---|---|
| `gender` | `Yup.string()` | `.required(t('wordForm.adjective.errors.formES.genderRequired'))` + `.oneOf(["Neutral", "M/F"], t('wordForm.adjective.errors.formES.genderRequired'))` |
| `neutralSingular` | `Yup.string()` | `.required(t('wordForm.adjective.errors.formES.singularNeutralDegreeRequired'))` + `.matches(/^[^0-9]+$/, t('wordForm.errors.noNumbers'))` |
| `neutralPlural` | `Yup.string()` | `.required(t('wordForm.adjective.errors.formES.pluralNeutralDegreeRequired'))` + `.matches(/^[^0-9]+$/, t('wordForm.errors.noNumbers'))` |
| (commented) | — | `// maleSingular`, `// femaleSingular`, `// malePlural`, `// femalePlural` omitted for TS compat |

`AdjectiveData` interface (lines 59–73): `gender: "Neutral" | "M/F" | ""`, plus `maleSingular`, `femaleSingular`, `malePlural`, `femalePlural`, `neutralSingular`, `neutralPlural` (all `string`, default `""`; `gender` default `""`).

### Structural field
- `gender` — `RadioGroupWithHook`, label `"Gender"`, `options={["Neutral", "M/F"]}`, default `""`. Always rendered first, full width (`xs=12`). Controls which schema and which case fields show.

### Rendered field order
1. `gender` (RadioGroup, always visible)
2. If `gender === "Neutral"`:
   - `neutralSingular` — label `"Neutral singular"` (`xs=12 md=6`)
   - `neutralPlural` — label `"Neutral plural"` (`xs=12 md=6`)
3. Else (gender `"M/F"`):
   - `maleSingular` — label `"Male singular"`
   - `malePlural` — label `"Male plural"`
   - `femaleSingular` — label `"Female singular"`
   - `femalePlural` — label `"Female plural"`
   (each `xs=12 md=6`)

### Notes
- Spanish adjective varies by gender+number; `gender` is required and drives schema choice.
- Cases mapped: `maleSingularES`, `femaleSingularES`, `malePluralES`, `femalePluralES`, `neutralSingularES`, `neutralPluralES` (all lowercased).
- `femaleSingular` uses `matches(/^[^0-9]+$|^$/)` (allows empty) unlike `maleSingular` (`matches(/^[^0-9]+$/)`) despite both being `.required` — asymmetry is verbatim.

---

## DE Adjective — `AdjectiveFormDE.tsx`
Source: `frontend/src/components/forms/adjectives/AdjectiveFormDE.tsx`

### yup schema (lines 23–31)
`Yup.object({ … })` (note: `Yup.object`, not `Yup.object().shape`)

| Field | Type | Rules (verbatim) |
|---|---|---|
| `positive` | `Yup.string()` | `.required(t('wordForm.adjective.errors.formDE.positiveDegreeRequired'))` + `.matches(/^[^0-9]+$/, t('wordForm.errors.noNumbers'))` |
| `komparativ` | `Yup.string().nullable()` | `.matches(/^[^0-9]+$|^$/, t('wordForm.errors.noNumbers'))` |
| `superlativ` | `Yup.string().nullable()` | `.matches(/^[^0-9]+$|^$/, t('wordForm.errors.noNumbers'))` |

`AdjectiveData` interface (lines 33–37): `positive`, `komparativ`, `superlativ` — all `string`, default `""`.

### Structural fields
None.

### Rendered field order (all `TextInputFormWithHook`, `xs=12 md=4`)
1. `positive` — label `"Positive"`
2. `komparativ` — label `"Komparativ"`
3. `superlativ` — label `"Superlativ"`

### Notes
- German adjective is indeclinable in this app (base/comparative/superlative only, no case/gender inflection).
- Field names use German (`komparativ`, `superlativ`), not English (`comparative`, `superlative`) as in EN.
- Cases: `positiveDE`, `komparativDE`, `superlativDE` (lowercased).

---

## EE Adjective — `AdjectiveFormEE.tsx`
Source: `frontend/src/components/forms/adjectives/AdjectiveFormEE.tsx`

### yup schema (lines 35–60)
`Yup.object().shape({ … })`

| Field | Type | Rules (verbatim) |
|---|---|---|
| `algvorre` | `Yup.string()` | `.required(t('wordForm.adjective.errors.formEE.algvorreFormRequired'))` + `.matches(/^[^0-9]+$/, t('wordForm.errors.noNumbers'))` |
| `keskvorre` | `Yup.string().nullable()` | `.required(t('wordForm.adjective.errors.formEE.keskvorreFormRequired'))` + `.matches(/^[^0-9]+$/, t('wordForm.errors.noNumbers'))` |
| `ulivorre` | `Yup.string().nullable()` | `.required(t('wordForm.adjective.errors.formEE.ulivorreFormRequired'))` + `.matches(/^[^0-9]+$/, t('wordForm.errors.noNumbers'))` |
| `pluralNimetav` | `Yup.string().nullable()` | `.matches(/^[^0-9]+$|^$/, t('wordForm.errors.noNumbers'))` |
| `singularOmastav` | `Yup.string().nullable()` | `.matches(/^[^0-9]+$|^$/, t('wordForm.errors.noNumbers'))` |
| `pluralOmastav` | `Yup.string().nullable()` | `.matches(/^[^0-9]+$|^$/, t('wordForm.errors.noNumbers'))` |
| `singularOsastav` | `Yup.string().nullable()` | `.matches(/^[^0-9]+$|^$/, t('wordForm.errors.noNumbers'))` |
| `pluralOsastav` | `Yup.string().nullable()` | `.matches(/^[^0-9]+$|^$/, t('wordForm.errors.noNumbers'))` |
| (commented) | — | `// singularNimetav` — "SAME AS ALGVÕRRE" |

`AdjectiveData` interface (lines 62–71): `algvorre`, `keskvorre`, `ulivorre`, `pluralNimetav`, `singularOmastav`, `pluralOmastav`, `singularOsastav`, `pluralOsastav` — all `string`, default `""`.

### Structural fields
- `AutocompleteButtonWithStatus` (only when NOT `displayOnly`): rendered above the fields, uses `adjective.algvorre` as the query; `forceDisabled={!validAutocompleteRequest}` where `validAutocompleteRequest = errors['infinitiveMa'] === undefined` (note: references `infinitiveMa`, an unrelated verb-field key — verbatim). Debounced 600ms via `setTimerTriggerFunction`, dispatching `getAutocompletedEstonianAdjectiveData(adjective.algvorre)`.

### Rendered field order
Grades (each `TextInputFormWithHook`, `xs=12 md=4`):
1. `algvorre` — label `"Algvõrre"`
2. `keskvorre` — label `"Keskvõrre"`
3. `ulivorre` — label `"Ülivõrre"`

Cases (each `TextInputFormWithHook`, `xs=6`):
4. `pluralNimetav` — label `"Plural nimetav"`
5. `singularOmastav` — label `"Singular omastav"`
6. `pluralOmastav` — label `"Plural omastav"`
7. `singularOsastav` — label `"Singular osastav"`
8. `pluralOsastav` — label `"Plural osastav"`

### Notes
- Estonian adjective = 3 degrees (algvõrre/keskvõrre/ülivõrre) + short case declension. `algvorre` doubles as `singularNimetav` (commented out, "SAME AS ALGVÕRRE").
- `keskvorre` and `ulivorre` are both `.nullable()` AND `.required()` (verbatim).
- Cases: `algvorreEE`, `keskvorreEE`, `ulivorreEE`, `pluralNimetavEE`, `singularOmastavEE`, `pluralOmastavEE`, `singularOsastavEE`, `pluralOsastavEE` (all lowercased).
- Uses Redux autocomplete slice (`getAutocompletedEstonianAdjectiveData`), `AutocompleteButtonWithStatus`, and `LinearIndeterminate` spinner.

---

## EN Adverb — `AdverbFormEN.tsx`
Source: `frontend/src/components/forms/adverbs/AdverbFormEN.tsx`

### yup schema (lines 22–30)
`Yup.object().shape({ … })`

| Field | Type | Rules (verbatim) |
|---|---|---|
| `adverb` | `Yup.string()` | `.required(t('wordForm.adverb.errors.formEN.adverbRequired'))` + `.matches(/^[^0-9]+$/, t('wordForm.errors.noNumbers'))` |
| `comparative` | `Yup.string().nullable()` | `.matches(/^[^0-9]+$|^$/, t('wordForm.errors.noNumbers'))` |
| `superlative` | `Yup.string().nullable()` | `.matches(/^[^0-9]+$|^$/, t('wordForm.errors.noNumbers'))` |

`AdverbData` interface (lines 32–36): `adverb`, `comparative`, `superlative` — all `string`, default `""`.

### Structural fields
None.

### Rendered field order (all `TextInputFormWithHook`, `xs=12 md=4`)
1. `adverb` — label `"Adverb"`
2. `comparative` — label `"Comparative"`
3. `superlative` — label `"Superlative"`

### Notes
- Same shape as EN adjective (base + comparative + superlative); `adverb` required, others optional.
- Cases: `adverbEN`, `comparativeEN`, `superlativeEN` (lowercased).

---

## ES Adverb — `AdverbFormES.tsx`
Source: `frontend/src/components/forms/adverbs/AdverbFormES.tsx`

### yup schema (lines 23–31)
`Yup.object().shape({ … })`

| Field | Type | Rules (verbatim) |
|---|---|---|
| `adverb` | `Yup.string()` | `.required(t('wordForm.adverb.errors.formES.adverbRequired'))` + `.matches(/^[^0-9]+$/, t('wordForm.errors.noNumbers'))` |
| `comparative` | `Yup.string().nullable()` | `.matches(/^[^0-9]+$|^$/, t('wordForm.errors.noNumbers'))` |
| `superlative` | `Yup.string().nullable()` | `.matches(/^[^0-9]+$|^$/, t('wordForm.errors.noNumbers'))` |

`AdverbData` interface (lines 33–37): `adverb`, `comparative`, `superlative` — all `string`, default `""`.

### Structural fields
None.

### Rendered field order (all `TextInputFormWithHook`, `xs=12 md=4`)
1. `adverb` — label `"Adverbio"`
2. `comparative` — label `"Comparativo"`
3. `superlative` — label `"Superlativo"`

### Notes
- Identical field set to EN adverb; only labels are Spanish.
- Cases: `adverbES`, `comparativeES`, `superlativeES` (lowercased).

---

## DE Adverb — `AdverbFormDE.tsx`
Source: `frontend/src/components/forms/adverbs/AdverbFormDE.tsx`

### yup schema (lines 23–33)
`Yup.object().shape({ … })`

| Field | Type | Rules (verbatim) |
|---|---|---|
| `gradable` | `Yup.string()` | `.required(t('wordForm.adverb.errors.formDE.gradableRequired'))` + `.oneOf(["Gradable", "Non-gradable", ""], t('wordForm.adverb.errors.formDE.gradableRequired'))` |
| `adverb` | `Yup.string()` | `.required(t('wordForm.adverb.errors.formDE.adverbRequired'))` + `.matches(/^[^0-9]+$/, t('wordForm.errors.noNumbers'))` |
| `comparative` | `Yup.string().nullable()` | `.matches(/^[^0-9]+$|^$/, t('wordForm.errors.noNumbers'))` |
| `superlative` | `Yup.string().nullable()` | `.matches(/^[^0-9]+$|^$/, t('wordForm.errors.noNumbers'))` |

`AdverbData` interface (lines 35–40): `gradable: "Gradable" | "Non-gradable" | ""` (default `""`), plus `adverb`, `comparative`, `superlative` (all `string`, default `""`).

### Structural field
- `gradable` — `RadioGroupWithHook`, label `"Gradable"`, `options={["Gradable", "Non-gradable"]}`, default `""`, always rendered first, full width (`xs=12`). `oneOf` also accepts `""` (uncommitted state).

### Rendered field order
1. `gradable` (RadioGroup, always visible)
2. `adverb` — label `"Adverb"`; `xs=12`, `md = (adjective.gradable === "Non-gradable") ? 12 : 4`
3. `comparative` — label `"Komparativ"` (`xs=12 md=4`) — hidden when `gradable === "Non-gradable"` (shown when `""` or `"Gradable"`)
4. `superlative` — label `"Superlativ"` (`xs=12 md=4`) — hidden when `gradable === "Non-gradable"`

### Notes
- German adverb distinguishes gradable vs non-gradable. When `"Non-gradable"`, comparative/superlative are hidden AND their case values are forced to `""` on push-up (via `(adjective.gradable !== "Non-gradable") ? … : ""`).
- `gradable` value is NOT lowercased on push-up (stored as-is in `AdverbCases.gradableDE`); `adverb`, `comparative`, `superlative` are lowercased.
- Cases: `gradableDE`, `adverbDE`, `comparativeDE`, `superlativeDE`.

---

## Routing summary (from `WordFormSelector.tsx`)
- `PartOfSpeech.adjective` → `getAdjectiveForm()`: EN/ES/DE/EE all implemented; any other lang → `"That language is not available yet"` (hardcoded, not i18n).
- `PartOfSpeech.adverb` → `getAdverbForm()`: EN/ES/DE implemented; **EE (Estonian) adverb is NOT implemented** — falls to default `t('wordFormSelector.languageNotAvailable')`.
