# Exercise Flow — full specification (parameter menu → practice → results)

*2026-09-05. Consolidated spec for the exercise/practice domain — the parameter-configuration menu (`ExerciseParameterSelector`), the exercise card (`ExerciseCard`), the results screen (`EndScreen`/`ResultRow`), and the two performance endpoints. This is the same "rebuild from this" treatment the Review table received (`review-table.md`). Every claim `file:line`-grounded. Complements `pages-review-practice.md` (page-level flows) and `data-model.md` §2.8 (exercise/performance types).*

---

## 1. The two surfaces

`/practice` runs one state machine with three phases, all driven by Redux slices `features/exercises` (list + `wordsSelectedForExercises`) and `features/exercisePerformance` (per-answer saves):

1. **Parameter menu** (`ExerciseParameterSelector`) — configures the exercise set; "Accept" is disabled until the form is valid.
2. **Cards** (`ExerciseCard`) — one card per generated exercise; answer, evaluate, record performance; prev/next navigation; per-card master/forget actions.
3. **End screen** (`EndScreen` + `ResultRow`) — final score + per-result rows, with jump-back-to-card review.

Phase transition: `acceptedParameters` flips true on Accept (`Practice.tsx:113-128`); `displayEndScreen` triggers when `cardAnswers.length === exercises.length && currentCardIndex === exercises.length` (`Practice.tsx:91-99`).

## 2. Parameter model — `ExerciseParameters` (`Practice.tsx:29-55`)

```ts
type ExerciseParameters = {
  amountOfExercises: number,
  multiLang: CardTypeSelection,        // 'Multi-Language' | 'Single-Language' | 'Random'
  mode: 'Single-Try' | 'Multiple-Tries',
  preSelectedWords?: any[],            // simple-word data; BE receives ids only
  wordSelection: WordSortingSelection, // 'Exercise-Performance' | 'Random'
  nativeLanguage?: Lang,
} & (MCType | TIType | RandomType)

type MCType   = { type: "Multiple-Choice", difficultyMC: number }
type TIType   = { type: "Text-Input", difficultyTI: number }
type RandomType = { type: 'Random', difficultyTI: number, difficultyMC: number }
```

**Default parameters** (`Practice.tsx:63-78`):
| Field | Default |
|-------|---------|
| `languages` | `user.languages` |
| `partsOfSpeech` | `[noun, verb]` (TODO: add more PoS as BE supports exercise creation) |
| `amountOfExercises` | `10` |
| `multiLang` | `Random` |
| `type` | `Text-Input` |
| `mode` | `'Single-Try'` (forced — `Multiple-Tries` exists in the type but is dead) |
| `wordSelection` | `Exercise-Performance` |
| `difficultyMC` | `1`, `difficultyTI` | `2` |
| `nativeLanguage` | `user.nativeLanguage` |

## 3. Parameter menu (`ExerciseParameterSelector.tsx`)

### 3.1 Fields & controls

| Control | State | Notes |
|---------|-------|-------|
| Languages | `DnDLanguageOrderSelector` (drag-reorder) → `allSelectedLanguages` | order = user preference; feeds `languages` |
| Parts of speech | `CheckboxGroupWithHook` | seeded by `availablePoS` (narrowed by preselected words via `relevantPoSForPreSelectedWords`) |
| Amount | `TextInputFormWithHook` number field | `parseInt` on change |
| Type | `RadioGroupWithHook`: Multiple-Choice / Text-Input / Random | |
| multiLang | `RadioGroupWithHook`: Multi-Language / Single-Language / Random | |
| Advanced options | collapsible divider → `displayAdvancedOptions` toggle | |
| difficulty MC | `Slider` 0–3 (hidden when type = Text-Input) | |
| difficulty TI | `Slider` 1–3 (hidden when type = Multiple-Choice) | |
| wordSelection | `RadioGroupWithHook`: Exercise-Performance / Random | |
| native language | `RadioGroupWithHook`: Include / Ignore (only when `nativeLanguage` set AND `multiLang !== 'Multi-Language'`) | Ignore → `nativeLanguage = user.nativeLanguage`; Include → undefined |

### 3.2 Difficulty semantics (slider tooltips)

- **MC** (`ExerciseParameterSelector.tsx:42-66`): Level 0 "Any word-type - any language"; 1 "Any word-type - same language"; 2 "Same word-type - same language"; 3 "Same word - same language - different cases". Defaults `marks[1].value`.
- **TI** (`ExerciseParameterSelector.tsx:68-100`): Level 1 "Ignores capitalization and special characters"; 2 "Only ignores capitalization"; 3 "Zero tolerance - exact". Defaults `marks[1].value`.

### 3.3 Validation (`ExerciseParameterSelector.tsx:104-143`)

- `partsOfSpeech`: array, ≥1 item.
- `amountOfExercises`: required number, integer, regex `^[0-9]+$`, positive (`> 0 && 1/value !== -Infinity`). Known TODO: `+1` still accepted by the number-only test.

### 3.4 Change flow

Every control edit → `runOnParametersChange()` composes the full `ExerciseParameters` from form state (`type` from `getValues`, `difficultyMC`/`difficultyTI` from local slider state, `nativeLanguage` from `user.nativeLanguage`, `mode: 'Single-Try'` hard-coded) and calls `props.onParametersChange` (`ExerciseParameterSelector.tsx:130-145`). Accept (valid + not loading) → `onAcceptParameters` in `Practice.tsx:112-128`: strips `preSelectedWords` to ids, dispatches `getExercisesForUser(dispatchParameters)`, sets `acceptedParameters = true`.

## 4. Exercise generation (`features/exercises`)

`getUserExercises` → `GET /api/exercises/getUserExercises` with `params: { parameters: <ExerciseParameters> }` (`exerciseService.ts:6-17`; slice thunk `exerciseSlice.ts:38-51`). Response = an exercise list (`EquivalentTranslationValues[]`, `data-model.md` §2.8). Slice state: `{exercises, wordsSelectedForExercises, isLoadingExercises, isSuccessExercises, isErrorExercises, message}`.

`wordsSelectedForExercises` is the cross-page transport: Review's "create exercises" action sets it + navigates to `/practice` (`Review.tsx:535-539`); Practice constrains parameters to those words when present (`Practice.tsx:130-141`).

## 5. Exercise card (`ExerciseCard.tsx` — 1,127 lines, the largest file)

### 5.1 Question → answer model

Each exercise (`EquivalentTranslationValues`) pairs `matchingTranslations.itemA` (prompt: language + case + value) with `itemB` (answer: language + case + value [+ `otherValues` for MC] [+ `translationId`]). `multiLang` controls whether itemA/itemB languages differ.

### 5.2 Text-Input evaluation (`ExerciseCard.tsx:99-130`)

`checkTextInputAnswerByDifficulty(answer, correctValue, difficulty)`:

| Difficulty | Normalization | Result |
|-----------|---------------|--------|
| 1 | NFD-normalize + strip combining accents + lowercase | `partially-correct` if differs-but-normalized-equal; else `correct`/`wrong` |
| 2 | lowercase only | `partially-correct` if differs-but-case-insensitive-equal; else `correct`/`wrong` |
| 3 | none | `correct` iff exact match, else `wrong` |

`checkIfCorrectAnswer` (`ExerciseCard.tsx:132-236`): trims the answer; for `Text-Input` uses `difficultyTI` (falls back to 2 if the exercise `type` isn't MC); for `Multiple-Choice` compares case-insensitively. Result → toast (success/error/warning per status) + build `PerformanceParameters` + `ExerciseResult`.

### 5.3 Multiple-Choice option generation (`ExerciseCard.tsx:238-276`)

`getOptionsToDisplay` builds options as `[itemB.value, ...itemB.otherValues.filter(v => v !== itemB.value)]`, then `deterministicSort`. Buttons are colored success/error/inherit after answering; border-radius 10px (multiLang) vs 50px (single). Double-submit guarded by `currentCardAnswer === undefined`.

### 5.4 Performance recording

`checkIfCorrectAnswer` builds `PerformanceParameters` (`ExerciseCard.tsx:151-171`):
- always: `translationLanguage` + `caseName` from `itemB`.
- first answer (no `performance` yet): `user: user._id`, `translationId: itemB.translationId`, `word: wordId`.
- subsequent: `performanceId: currentExerciseData.performance._id`.
- `record: true` (correct / partially-correct) or `false` (wrong).

Then `dispatch(saveTranslationPerformance(parameters))` → `POST /api/exercises/saveTranslationPerformance` (`exercisePerformanceService.ts:10-17`). On success the slice sets `exercisePerformance`, and an effect merges it into `exercises[currentCardIndex].performance` and resets the slice (`ExerciseCard.tsx:378-394`).

### 5.5 Master / forget

`performanceShortcutButtons` render per-case performance as % + 4 thumb icons; Master/Forget `ConfirmationModal` buttons call `savePerformanceAction({performanceId, action: 'master'|'forget'})` → `POST /api/exercises/savePerformanceAction` (`ExerciseCard.tsx:404-418, 948-979`; `exercisePerformanceService.ts:20-26`). Toggling is tracked via `isPerformanceMastered`/`isPerformanceRevise` + `reviseCounter` (`ExerciseCard.tsx:69-73`).

### 5.6 Navigation & state

Prev/Next chevrons adjust `currentCardIndex` (forward resets the performance slice); read-only/disabled during save or while unanswered; `textInputAnswer` restored per index; empty exercise list → no-match state with LaduLogo (`ExerciseCard.tsx:760-878`). Known defect: `isErrorSendingPerformance` unhandled (`ExerciseCard.tsx` TODO:396) → answer/fetched-exercises desync on navigation.

## 6. End screen (`EndScreen.tsx` + `ResultRow.tsx`)

- **EndScreen**: collapsible parameters summary (type badges incl. Random-as-both, multiLang/single, language flags, PoS chips); collapsible selected-words list (`WordSimpleList` if `wordsSelectedForExercises > 0`); `ResultRow` list pairing `exercises[i]` with `cardAnswers[i]`; "go back to parameters" → `onClickReset`.
- **ResultRow**: green/red border + check/cancel icon by correctness; MC/TI type icon tooltip; itemA/itemB flags + prompt + user answer; PoS/case chips; "review" button → `setCurrentCardIndex(index)` (jump back to that card).

Score header: live `amountCorrectExercises`/N with color interpolation; final green (`Practice.tsx:91-100, 219-235`).

## 7. Rebuild checklist

1. Port `ExerciseParameters` + the `EquivalentTranslationValues`/`PerformanceStats`/`TextInput`/`MultipleChoice`/`ExerciseResult`/`PerformanceParameters`/`PerformanceActionParameters` types (`data-model.md` §2.8) verbatim.
2. Parameter menu = 9 controls (§3.1) with the difficulty-slider semantics (§3.2) and the two-field validation (§3.3); `mode` stays single-try (drop `Multiple-Tries` unless the backend grows it).
3. Generation = `GET /api/exercises/getUserExercises?parameters=<ExerciseParameters>`; preselected words sent as ids.
4. Evaluation = `checkTextInputAnswerByDifficulty` verbatim (it is pure, accent-normalization logic — the only truly bespoke evaluation code) + MC case-insensitive compare; option generation `[value, ...otherValues]` + `deterministicSort`.
5. Performance = `saveTranslationPerformance` (first-answer vs subsequent payload shapes) + `savePerformanceAction` (master/forget); merge-into-card via `setQueryData`, not slice splicing.
6. Keep the three-phase state machine (params → cards → end), the cross-page `wordsSelectedForExercises` transport, and the index-jump review on the end screen.
7. Fix the known defects: unhandled `isErrorSendingPerformance`; `+1` accepted by the amount validator; add PoS beyond noun/verb once the backend can generate them.
