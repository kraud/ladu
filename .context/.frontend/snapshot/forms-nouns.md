# Ladu Word Forms — Nouns (field specification)

> Transcribed verbatim from `frontend/src/components/forms/nouns/*.tsx`.
> Shared scaffolding (not re-transcribed): every noun form hydrates via `currentTranslationData.cases` on a first-render effect (`setValuesInForm` / per-field `setValue`), pushes `props.updateFormData({ language, cases, completionState: isValid, isDirty })` in a state-change effect, and renders through `RadioGroupWithHook` (regularity, gender) and `TextInputFormWithHook` (text cases). Every text case (except the `singular`/`singularNominativ`/`singularNimetav` required field) is wrapped in `getDisabledInputFieldDisplayLogic(props.displayOnly!, <value>)`, which hides the field in display-only mode when its value is empty.
> Regularity options in every language come from `VerbRegularity` (`regular` = `'regular'`, `irregular` = `'irregular'`) — `frontend/src/ts/enums.ts:398-401`.
> Gender enums — `frontend/src/ts/enums.ts:446-456`.

## Routing (PoS + Lang → form)

`frontend/src/components/forms/WordFormSelector.tsx`:
- `getPartOfSpeechForm()` switches on `props.partOfSpeech`; `PartOfSpeech.noun` → `getNounForm()` (lines 34-52).
- `getNounForm()` switches on `props.currentLang` (lines 207-244):
  - `Lang.EN` → `NounFormEN`
  - `Lang.ES` → `NounFormES`
  - `Lang.DE` → `NounFormDE`
  - `Lang.EE` → `NounFormEE`
  - default → `<p>{t('wordFormSelector.languageNotAvailable', {ns: 'wordRelated'})}</p>`
- Every routed form receives `currentTranslationData`, `updateFormData` (re-wrapped as `(formData) => props.updateFormData(formData)`), and `displayOnly={props.displayFieldsAsText}`.

---

## English Noun — NounFormEN.tsx

**yup schema** (`frontend/src/components/forms/nouns/NounFormEN.tsx:23-33`) — field names verbatim:

| Field | Rules |
|---|---|
| `regularity` | `Yup.string()` · `.matches(/^[^0-9]+$|^$/, noNumbers)` · `.matches(/^(regular|irregular)?$/, regularityRequired)` |
| `singular` | `Yup.string()` · `.required(singularFormRequired)` · `.matches(/^[^0-9]+$/, noNumbers)` |
| `plural` | `Yup.string().nullable()` · `.matches(/^[^0-9]+$|^$/, noNumbers)` |

**Structural fields**:
- `regularity` — Radio (`RadioGroupWithHook`), options `[VerbRegularity.regular, VerbRegularity.irregular]`, `defaultValue=""`, `fullWidth={false}`.

**Case names pushed to `updateFormData`** (from the state effect): `regularityEN`, `singularEN`, `pluralEN` (singular/plural pushed `toLowerCase()`).

**Rendered field order** (JSX):
1. Regularity (Radio) — hidden in display-only when `regularity` empty.
2. Singular — `TextInputFormWithHook`, `label="Singular"`, `name="singular"`.
3. Plural — `TextInputFormWithHook`, `label="Plural"`, `name="plural"`.

**Language-specific notes**: Minimal 2-case declension (singular + plural); no gender, no autocomplete. `singular` is the only required case.

---

## Spanish Noun — NounFormES.tsx

**yup schema** (`frontend/src/components/forms/nouns/NounFormES.tsx:33-46`) — field names verbatim:

| Field | Rules |
|---|---|
| `regularity` | `Yup.string()` · `.matches(/^[^0-9]+$|^$/, noNumbers)` · `.matches(/^(regular|irregular)?$/, regularityRequired)` |
| `gender` | `Yup.string()` · `.required(genderRequired)` · `.oneOf(["el", "la", "el/la"], genderRequired)` |
| `singular` | `Yup.string()` · `.required(singularFormRequired)` · `.matches(/^[^0-9]+$/, noNumbers)` |
| `plural` | `Yup.string().nullable()` · `.matches(/^[^0-9]+$|^$/, noNumbers)` |

**Structural fields**:
- `gender` — Radio (`RadioGroupWithHook`), `label="Gender"`, options `[GenderES.M, GenderES.F, GenderES.N]` = `["el", "la", "el/la"]`, `defaultValue=""`, `fullWidth={true}`.
- `regularity` — Radio, options `[VerbRegularity.regular, VerbRegularity.irregular]`, `fullWidth={false}`.

**Case names pushed to `updateFormData`**: `regularityES`, `singularES`, `pluralES`, `genderES` (singular/plural `toLowerCase()`).

**Rendered field order** (JSX):
1. Autocomplete button (gender autocomplete; hidden when `displayOnly`).
2. Gender (Radio) — always rendered in display-only (not gated by `getDisabledInputFieldDisplayLogic`).
3. Regularity (Radio) — hidden in display-only when `regularity` empty.
4. Singular — `label="Singular palabra"`, `name="singular"`.
5. Plural — `label="Plural palabra"`, `name="plural"`.

**Language-specific notes**: Gender + 2-case (singular/plural). Gender is `required` and must be one of `el`/`la`/`el/la`. Autocomplete (`getAutocompletedSpanishNounGender`) fills only gender; singular/plural/regularity are manually merged back in `onAutocompleteClick` (note: regularity is written to `VerbCases.regularityES` there).

---

## German Noun — NounFormDE.tsx

**yup schema** (`frontend/src/components/forms/nouns/NounFormDE.tsx:34-61`) — field names verbatim:

| Field | Rules |
|---|---|
| `regularity` | `Yup.string()` · `.matches(/^[^0-9]+$|^$/, noNumbers)` · `.matches(/^(regular|irregular)?$/, regularityRequired)` |
| `gender` | `Yup.string().required(genderRequired)` · `.oneOf([GenderDE.M as string, GenderDE.F as string, GenderDE.N as string], genderRequired)` |
| `singularNominativ` | `Yup.string()` · `.required(singularFormRequired)` · `.matches(/^[^0-9]+$/, noNumbers)` |
| `pluralNominativ` | `Yup.string().nullable()` · `.matches(/^[^0-9]+$|^$/, noNumbers)` |
| `singularAkkusativ` | `Yup.string().nullable()` · `.matches(/^[^0-9]+$|^$/, noNumbers)` |
| `pluralAkkusativ` | `Yup.string().nullable()` · `.matches(/^[^0-9]+$|^$/, noNumbers)` |
| `singularGenitiv` | `Yup.string().nullable()` · `.matches(/^[^0-9]+$|^$/, noNumbers)` |
| `pluralGenitiv` | `Yup.string().nullable()` · `.matches(/^[^0-9]+$|^$/, noNumbers)` |
| `singularDativ` | `Yup.string().nullable()` · `.matches(/^[^0-9]+$|^$/, noNumbers)` |
| `pluralDativ` | `Yup.string().nullable()` · `.matches(/^[^0-9]+$|^$/, noNumbers)` |

**Structural fields**:
- `gender` — Radio, `label="Gender"`, options `[GenderDE.M, GenderDE.F, GenderDE.N]` = `["der", "die", "das"]`, `defaultValue=""`, `fullWidth={false}`.
- `regularity` — Radio, options `[VerbRegularity.regular, VerbRegularity.irregular]`, `fullWidth={false}`.

**Case names pushed to `updateFormData`** (order as in the state effect): `regularityDE`, `genderDE`, `singularNominativDE`, `pluralNominativDE`, `singularAkkusativDE`, `pluralAkkusativDE`, `singularGenitivDE`, `pluralGenitivDE`, `singularDativDE`, `pluralDativDE`. (Not lowercased — German nouns keep capitalisation.)

**Rendered field order** (JSX):
1. Autocomplete button (hidden when `displayOnly`).
2. Gender (Radio).
3. Regularity (Radio) — hidden in display-only when `regularity` empty.
4. Singular nominativ — `name="singularNominativ"`.
5. Plural nominativ — `name="pluralNominativ"`.
6. Singular akkusativ — `name="singularAkkusativ"`.
7. Plural akkusativ — `name="pluralAkkusativ"`.
8. Singular genitiv — `name="singularGenitiv"`.
9. Plural genitiv — `name="pluralGenitiv"`.
10. Singular dativ — `name="singularDativ"`.
11. Plural dativ — `name="pluralDativ"`.

Labels use German capitalization: "Singular nominativ", "Plural nominativ", "Singular akkusativ", "Plural akkusativ", "Singular genitiv", "Plural genitiv", "Singular dativ", "Plural dativ".

**Language-specific notes**: 4-case noun declension (nominativ/akkusativ/genitiv/dativ) × singular/plural = 8 case fields + gender + regularity. Only `singularNominativ` and `gender` are required. Autocomplete (`getAutocompletedGermanNounData`) fills cases; only regularity is manually merged back (`VerbCases.regularityDE`).

---

## Estonian Noun — NounFormEE.tsx

**yup schema** (`frontend/src/components/forms/nouns/NounFormEE.tsx:39-59`) — field names verbatim:

| Field | Rules |
|---|---|
| `regularity` | `Yup.string()` · `.matches(/^[^0-9]+$|^$/, noNumbers)` · `.matches(/^(regular|irregular)?$/, regularityRequired)` |
| `singularNimetav` | `Yup.string()` · `.required(singularFormRequired)` · `.matches(/^[^0-9]+$/, noNumbers)` |
| `pluralNimetav` | `Yup.string().nullable()` · `.matches(/^[^0-9]+$|^$/, noNumbers)` |
| `singularOmastav` | `Yup.string().nullable()` · `.matches(/^[^0-9]+$|^$/, noNumbers)` |
| `pluralOmastav` | `Yup.string().nullable()` · `.matches(/^[^0-9]+$|^$/, noNumbers)` |
| `singularOsastav` | `Yup.string().nullable()` · `.matches(/^[^0-9]+$|^$/, noNumbers)` |
| `pluralOsastav` | `Yup.string().nullable()` · `.matches(/^[^0-9]+$|^$/, noNumbers)` |
| `shortForm` | `Yup.string().nullable()` · `.matches(/^[^0-9]+$|^$/, noNumbers)` |

**Structural fields**:
- `regularity` — Radio, options `[VerbRegularity.regular, VerbRegularity.irregular]`, `fullWidth={false}`.
- `searchInEnglish` — Checkbox (`Checkbox` inside `FormControlLabel` + `Tooltip`), local `useState<boolean>(false)`, `label=t('wordForm.noun.errors.formEE.searchInEnglishLabel', {ns:'wordRelated'})`, `labelPlacement="end"`. Only shown inside the autocomplete row (hidden when `displayOnly`).

**Case names pushed to `updateFormData`** (order as in the state effect): `regularityEE`, `singularNimetavEE`, `pluralNimetavEE`, `singularOmastavEE`, `pluralOmastavEE`, `singularOsastavEE`, `pluralOsastavEE`, `shortFormEE`. (All text cases pushed `toLowerCase()`.)

**Rendered field order** (JSX):
1. Autocomplete button + "search in English" checkbox (hidden when `displayOnly`).
2. Regularity (Radio) — hidden in display-only when `regularity` empty.
3. Ainsus nimetav (singular nominative) — `name="singularNimetav"`.
4. Mitmus nimetav (plural nominative) — `name="pluralNimetav"`.
5. Ainsus omastav (singular genitive) — `name="singularOmastav"`.
6. Mitmus omastav (plural genitive) — `name="pluralOmastav"`.
7. Ainsus osastav (singular partitive) — `name="singularOsastav"`.
8. Mitmus osastav (plural partitive) — `name="pluralOsastav"`.
9. Lühike sisseütlev (short illative) — `name="shortForm"`.

**Language-specific notes**: 3 cases (nimetav/omastav/osastav) × singular/plural = 6 case fields + `shortForm` (short illative) + regularity. Only `singularNimetav` is required. No gender. Autocomplete (`getAutocompletedEstonianNounData`) takes `{ query, searchInEnglish }`; only regularity is manually merged back (`VerbCases.regularityEE`), and `setSearchInEnglish(false)` is reset after autocomplete fill.
