# Data Model — verbatim enum + interface transcription

*2026-09-05. Verbatim transcription of `frontend/src/ts/enums.ts` (602 lines) and `frontend/src/ts/interfaces.ts` (162 lines). Both are pure TypeScript with no runtime behavior and no imports beyond each other — **port verbatim** into the new repo. This is the single source of truth for every case name, part-of-speech, language key, and data shape in the app.*

---

## 1. `enums.ts`

### 1.1 PartOfSpeech (display labels)
```ts
enum PartOfSpeech {
  noun = "Noun", verb = "Verb", adjective = "Adjective", adverb = "Adverb",
  preposition = "Preposition", conjunction = "Conjunction", pronoun = "Pronoun",
  interjection = "Interjection", properNoun = "Proper noun", numerals = "Numerals",
}
```
The app actually implements forms for 4 PoS: **noun, verb, adjective, adverb**. The other 6 values exist for display/filter completeness only.

### 1.2 Lang
```ts
enum Lang { ES = "Spanish", EN = "English", DE = "German", EE = "Estonian" }
```
`Lang` is the canonical language key throughout (stored on `TranslationItem.language`, `WordItem.caseName` suffix, filters). Values are the display names; **keys** (`ES/EN/DE/EE`) are the wire values.

### 1.3 NounCases
```ts
enum NounCases {
  // ENGLISH
  regularityEN = "regularityEN", singularEN = "singularEN", pluralEN = "pluralEN",
  // SPANISH
  regularityES = "regularityES", genderES = "genderES", singularES = "singularES", pluralES = "pluralES",
  // GERMAN
  regularityDE = "regularityDE", genderDE = "genderDE",
  singularNominativDE = "singularNominativDE", pluralNominativDE = "pluralNominativDE",
  singularAkkusativDE = "singularAkkusativDE", pluralAkkusativDE = "pluralAkkusativDE",
  singularGenitivDE = "singularGenitivDE", pluralGenitivDE = "pluralGenitivDE",
  singularDativDE = "singularDativDE", pluralDativDE = "pluralDativDE",
  // ESTONIAN
  regularityEE = "regularityEE",
  singularNimetavEE = "singularNimetavEE", pluralNimetavEE = "pluralNimetavEE",
  singularOmastavEE = "singularOmastavEE", pluralOmastavEE = "pluralOmastavEE",
  singularOsastavEE = "singularOsastavEE", pluralOsastavEE = "pluralOsastavEE",
  shortFormEE = "shortFormEE",
}
```

### 1.4 AdjectiveCases
```ts
enum AdjectiveCases {
  // ENGLISH
  positiveEN = "positiveEN", comparativeEN = "comparativeEN", superlativeEN = "superlativeEN",
  // SPANISH
  maleSingularES = "maleSingularES", malePluralES = "malePluralES",
  femaleSingularES = "femaleSingularES", femalePluralES = "femalePluralES",
  neutralSingularES = "neutralSingularES", neutralPluralES = "neutralPluralES",
  // GERMAN
  positiveDE = "positiveDE", komparativDE = "komparativDE", superlativDE = "superlativDE",
  // ESTONIAN
  algvorreEE = "algvorreEE", keskvorreEE = "keskvorreEE", ulivorreEE = "ulivorreEE",
  pluralNimetavEE = "pluralNimetavEE",          // NB! singularNimetav == algvorre
  singularOmastavEE = "singularOmastavEE", pluralOmastavEE = "pluralOmastavEE",
  singularOsastavEE = "singularOsastavEE", pluralOsastavEE = "pluralOsastavEE",
}
```

### 1.5 AdverbCases
```ts
enum AdverbCases {
  adverbEN = "adverbEN", comparativeEN = "comparativeEN", superlativeEN = "superlativeEN",
  adverbES = "adverbES", comparativeES = "comparativeES", superlativeES = "superlativeES",
  gradableDE = "gradableDE", adverbDE = "adverbDE", comparativeDE = "comparativeDE", superlativeDE = "superlativeDE",
  // NB! no Estonian adverb cases — the EE adverb form does not exist
}
```

### 1.6 VerbCases (all four languages; each key is a `caseName`)
Verbatim, grouped:

**English** (`*EN`): `regularityEN`; simple-present/past/future/conditional × `1s,2s,3s,1pl,3pl` (note: no `2pl` — English 2s/2pl merge); `progressivePPFCAllEN`, `perfectPPFCAllEN`, `perfectProgressivePPFCAllEN` (single all-pronoun rows).

**Spanish** (`*ES`): `regularityES`; non-finite `infinitiveNonFiniteSimpleES`, `gerundNonFiniteSimpleES`, `participleNonFiniteSimpleES`, `infinitiveNonFiniteCompound`, `gerundNonFiniteCompound`; indicative present / imperfect-past / perfect-simple-past / future / conditional × `1s,2s,3s,1pl,2pl,3pl`; imperative × `1s,2s,3s,1pl,2pl,3pl`.

**Estonian** (`*EE`): `regularityEE`; `infinitiveMaEE`, `infinitiveDaEE`; kindel present / simple-past / past-perfect × `1s,2s,3s,1pl,2pl,3pl`.

**German** (`*DE`): `infinitiveDE`, `auxVerbDE`, `caseTypeDE`, `prefixDE`, `regularityDE`; indicative present / perfect / simple-future / simple-past × `1s,2s,3s,1pl,2pl,3pl`.

> Full enumeration is mechanical (language × tense × pronoun) and reproducible from the source file; the schema/pronoun inventory below and `word-cases-data.md` enumerate every concrete instance. Do **not** hand-retype — copy `enums.ts` verbatim.

### 1.7 Auxiliary enums (verb morphology)

| Enum | Members (= value) | Notes |
|------|-------------------|-------|
| `VerbCaseTypeDE` | `accusativeDE`, `dativeDE`, `genitiveDE` | `accusativeDativeDE` commented out |
| `PrefixesVerbDE` | `ab an auf aus bei da dar durch ein fern fest fort gegen her hin los mit nach nieder um vor weg wieder zu zusammen zuryck` | `zuryck = "zurück"` — source comment warns it can cause issues |
| `VerbRegularity` | `regular`, `irregular` | |
| `VerbMoodDE` | `indicativeDE="indicative"`, `subjunctiveDE`, `imperativeDE` | |
| `VerbMoodEN` | `indicativeEN`, `subjunctiveEN`, `imperativeEN`, `conditionalEN` | |
| `VerbMoodES` | `indicativeES`, `subjunctiveES`, `imperativeES`, `conditionalES` | |
| `VerbMoodEE` | `indicativeEE`, `subjunctiveEE`, `conditionalEE`, `jussiveEE` | |
| `VerbTensesIndicativeDE` | `presentDE`, `simplePastDE`, `presentPerfectDE`, `pastPerfectDE`, `simpleFutureDE`, `futurePerfectDE` | |
| `TenseVerbEN` | `pastSimple, pastPerfect, pastContinuous, pastPerfectContinuous, presentSimple, presentPerfect, presentContinuous, presentPerfectContinuous, futureSimple, futurePerfect, futureContinuous, futurePerfectContinuous, conditionalSimple` | display labels "Past-Simple" etc. |
| `TenseVerbES` | `present, imperfectPast, perfectSimplePast, future, conditional` | |
| `TenseVerbDE` | `present, perfect, simpleFuture, simplePast` | |
| `TenseVerbEE` | `present, simplePast, pastPerfect, conditionalPresent, indirectPresent, indirectPast, imperative` | |

### 1.8 Gender / plural / declension
```ts
enum GenderDE { M = "der", F = "die", N = "das" }
enum GenderES { M = "el", F = "la", N = "el/la" }
enum AuxVerbDE { H = "haben", S = "sein", W = "werden" }
enum Plurality { S = "Singular", P = "Plural" }
enum DeclensionNoun { nominative, accusative, genitive, dative, partitive }
```

### 1.9 Exercise/selection enums
```ts
enum MetricsType { WORDS, TRANSLATIONS }                       // numeric enum (0, 1)
enum ExerciseTypeSelection { 'Multiple-Choice', 'Text-Input', 'Random' }
enum CardTypeSelection { 'Multi-Language', 'Single-Language', 'Random' }
enum WordSortingSelection { 'Exercise-Performance', 'Random' }
enum NativeLanguageExerciseSelection { 'Include', 'Ignore' }
```

### 1.10 Pronoun enums
```ts
enum SpanishPronouns { "1S"="yo", "2S"="tú", "3S"="él/ella", "1P"="nosotros/as", "2P"="vosotros/as", "3P"="ellos/as" }
enum EnglishPronouns { "1S"="I", "2S"="you", "3S"="he/she/it", "1P"="we", "2P"="you", "3P"="they" }
enum GermanPronouns  { "1S"="ich", "2S"="du", "3S"="er/sie/es", "1P"="wir", "2P"="ihr", "3P"="sie" }
enum EstonianPronouns{ "1S"="ma", "2S"="sa", "3S"="ta", "1P"="me", "2P"="te", "3P"="nad" }
```
Plus the fuller `PronounDE` (nominative/accusative/dative × 1s/2s/3s/1pl/2pl/3pl, incl. formal `Sie`/`Ihnen` and m/f/n splits) — copy verbatim; used by future features.

---

## 2. `interfaces.ts`

### 2.1 Word / translation core (the create/view model)

```ts
interface WordData {                 // form-local shape
  translations: TranslationItem[],
  partOfSpeech?: string,
  clue?: string,
  tags?: TagData[],
}
interface WordDataBE {               // backend shape (persisted)
  id: string,                        // TODO in source: "should it be _id?"
  translations: TranslationItem[],
  partOfSpeech: PartOfSpeech,
  clue?: string,
  tags?: TagData[],
}
type TranslationItem = { language: Lang, cases: WordItem[] } & InternalStatus
interface WordItem {
  word: string,
  caseName: NounCases | AdjectiveCases | AdverbCases | VerbCases,  // which slot "word" fills
}
type InternalStatus = {              // form-only, NOT persisted
  completionState?: boolean,
  isDirty?: boolean,
}
```
Key invariant: a word is **one PoS + N translations**, each translation is **one language + M cases**, each case is **`{ word, caseName }`**. The `caseName` is the verbatim enum string from §1 (e.g. `"singularEN"`, `"indicativePresent3sES"`).

### 2.2 Search
```ts
type SearchResult = { id: string, label: string } & (WordSearch | TagSearch | UserSearch)
type WordSearch = { type: "word", language: Lang, completeWordInfo: WordDataBE }  // id = wordId
type TagSearch  = { type: "tag",  completeTagInfo?: TagData }
type UserSearch = { type: "user", email: string, username: string, languages: Lang[] }
```

### 2.3 User / friendship
```ts
type UserData = { _id: string, name: string, username: string, email: string, languages: Lang[] }
type FriendshipData = {
  _id?: string, userIds: string[], usernames?: string[],
  status: 'pending' | 'accepted' | 'blocked',
  partnerships?: PartnershipsData[], usersData?: UserData[],   // computed, not stored
}
type PartnershipsData = { mentor: string, language: Lang }
```
> NOTE: this is the **legacy** friendship shape (`userIds` array, no requester/addressee). The rewrite replaces it per §8.2 of the study — the new `friendships` table model is in `new-repo-build-plan.md` Phase 6, not this transcription.

### 2.4 Notification
```ts
type NotificationData = {
  _id: string,
  user: string | string[],
  dismissed: boolean,                 // false => badge; true => read; accepted => deleted
  notificationSender?: UserData,      // BE-only
} & (FriendRequestData | ShareTagRequestData)
type FriendRequestData = { variant: "friendRequest", content: { requesterId: string, requesterUsername: string } }
type ShareTagRequestData = { variant: "shareTagRequest", content: { requesterId: string, tagId: string }, notificationTag?: TagData }
```
> Legacy: notification JSONB carries the pending-action state (§8.1/§8.2 redesign makes it a display-only inbox). New FE shape is in the plan, not here.

### 2.5 Tag
```ts
type TagData = {
  _id?: string, author: string, label: string, description: string,
  public: 'Public' | 'Private' | 'Friends-Only',
  words: WordDataBE[],
} & InternalStatus
```
> Legacy: `public` (reserved word, loose varchar) → renamed `visibility` enum per §8.3.

### 2.6 Filters
```ts
type FilterItem = { _id: string, filterValue: string } & (CaseFilter | TagFilter | PartOfSpeechFilter)
type CaseFilter = { type: 'gender', caseName: NounCases | string, language: Lang }
type TagFilter  = { type: 'tag', restrictiveArray?: TagData[], additiveItem?: TagData }
type PartOfSpeechFilter = { type: 'PoS', partOfSpeech: PartOfSpeech }
```

### 2.7 Autocomplete (Estonian external API)
```ts
interface EstonianAPIRequest { query: string, searchInEnglish?: boolean }
```

### 2.8 Exercise / performance
```ts
type EquivalentTranslationValues = { partOfSpeech: PartOfSpeech, multiLang?: boolean, type?: 'Multiple-Choice'|'Text-Input' } & (TextInput | MultipleChoice)
type PerformanceStats = { knowledge: Number, performance: any, wordId: string }
type TextInput = { type:'Text-Input', matchingTranslations: { itemA: {language,cases?,value}, itemB: {language,case,value,translationId} } } & PerformanceStats
type MultipleChoice = { type:'Multiple-Choice', matchingTranslations: { itemA:{...}, itemB:{..., otherValues:string[], translationId} } } & PerformanceStats
interface ExerciseResult { answer: string, correct: boolean, indexInList: number, time: number }
interface PerformanceParameters { caseName: string, translationLanguage: Lang, record?: boolean, translationId?: string, performanceId?: string, word?: string, user?: any }
interface PerformanceActionParameters { performanceId: string, action?: "master" | "forget" }
```

### 2.9 Misc
```ts
interface PropsButtonData { id, variant?, color?, disabled?, calculateDisabled?, label?, icon?, onClick, setSelectionOnClick?, isVisible?, displayBySelectionAmount?, requiresConfirmation?, confirmationButtonLabel?, cancellationButtonLabel? }
type TagLabelAvailabilityStatus = ({isAvailable:false, tagId:string}) | ({isAvailable:true})
interface LanguageAndLabel { language: Lang, label: string }
interface InfoChipData { label: string, value: string }
```

---

## 3. `wordCasesDataByPoS.ts` — the case registry (drives the form engine)

Interface (verbatim structure):
```ts
type NounCasesData = { caseName: NounCases, language: Lang } & (NounData | NounOtherPropertyData)
type NounData = { isNounProperty: false, plurality: Plurality, declination: DeclensionNoun }
enum NounPropertyCategories { gender = 'Gender', shortForm = 'Short-Form' }
type NounOtherPropertyData = { isNounProperty: true, nounPropertyCategory: NounPropertyCategories }

type VerbCasesData = { caseName: VerbCases, language: Lang } & (VerbTenseData | VerbOtherPropertyData)
type VerbTenseData = { isVerbProperty: false, person: 1|2|3, plurality: Plurality, tense: TenseVerbEN|ES|DE|EE, mood?: VerbMoodDE|EN|ES|EE }
enum VerbPropertyCategories { regularity, infinitive, gerund, participle, verbCaseType, auxiliaryVerb, caseType, prefix, progressive, perfect, perfectProgressive }
type VerbOtherPropertyData = { isVerbProperty: true, verbPropertyCategory: VerbPropertyCategories }

interface WordCasesDataByPoS { Noun: NounCasesData[], Verb: VerbCasesData[] }   // NOTE: Adjective and Adverb are NOT here
const WordCasesData: WordCasesDataByPoS = { Noun: [...], Verb: [...] }
```

**Critical design fact**: `WordCasesData` only has `Noun` and `Verb` keys. Adjective and adverb form fields are **not** registry-driven — they hard-code `AdjectiveCases`/`AdverbCases` lists directly. The form engine must therefore treat noun+verb as config-driven and adjective+adverb as small fixed schemas (still collapsed from 4+3 hand-rolled components into config, but their config source is the enum, not `WordCasesData`).

The complete, verbatim `Noun[]` and `Verb[]` registry (every `caseName` → language + plurality/declension or person/tense/mood/property) is transcribed in [`word-cases-data.md`](./word-cases-data.md) — that listing is the input that generates each language×PoS form's field list.
