# Practice (exercises and performance tracking)

## Summary

Practice turns the words a learner has stored into exercises, checks the answers, and keeps a knowledge score for every translation and case. The score fades with time (a forgetting curve), so the next sessions show the weakest items first. The learner sets the languages, parts of speech, order (adaptive or random), multiple-choice difficulty (0 to 3) and text-input strictness, answers cards, and sees a results screen. A learner can mark a word "Mastered" or "Revise" by hand. Saved configurations and sessions are a separate feature (`features/saved-practice.md`).

Live spec. It replaces a finished plan (archive record: `.context/archive/2026-09-phase-5-practice.md`). Built 2026-09-29 to 2026-09-30 (slices 0 to 9). Gate: `e2e/tests/phase-5-practice.spec.ts`. **Section numbers are kept** (A.1 to A.12, B.1 to B.3, B.7, C.1 to C.7, and the decision IDs D1 to D7 and C4), because backend and frontend code cite them (for example `§A.8`, `§B.3`, `Part C §C.3`). The slices (B.4), the file list (B.5) and the verification (B.6) are in `.context/research/practice-build-record.md`. Ideas that were deferred are idea I-8 in `.context/research/deferred-ideas.md`.

Code map: backend `backend/services/exercises/` (`catalogue.ts`, `generate.ts`, `select.ts`, `knowledge.ts`, `distractors.ts`, `present.ts`, `validate.ts`, `types.ts`), `services/exerciseService.ts`, `controllers/exerciseController.ts`, `routes/exerciseRoutes.js`, migration `0007_exercise_performance_integrity.sql`; frontend `frontend/src/features/practice/` (`params.ts`, `preselection.ts`, `session.ts`, `evaluate.ts`, `api.ts`); `backend/scripts/bench-exercises.ts`.

---

## Part A — Practice knowledge base

### A.1 Purpose

Practice is the second half of the core loop (words → exercises). It turns the stored words into
exercises, checks answers, and stores a **knowledge score per user, per translation, per case**. The score
decays with time (forgetting curve). The next sessions use the score to show the weakest items first.
Performance tracking is a core feature. Its underlying behaviour must stay the same as in the old app,
except where Part B lists a decision.

### A.2 Vocabulary used in this document

| Term | Meaning |
|---|---|
| Word | One concept with one part of speech (PoS) and translations in ≥2 languages. |
| Translation | The word in one language (EN/ES/DE/EE). It has an id. |
| Case | One grammatical form in a translation: `caseName` + value (e.g. `pluralGenitivDE` = "Häuser"). |
| Exercise | One question: a **prompt** (itemA: language + case + value) and an expected **answer** (itemB: language + case + value + translationId). |
| Card type | `Text-Input` (TI, type the answer) or `Multiple-Choice` (MC, pick the answer). |
| Language mode | `Multi-Language` (prompt in language A, answer in language B, same grammatical slot) or `Single-Language` (prompt and answer in the same language, a grammatical drill). |
| Performance | One row per (user, translation): modifier, revise counter, average knowledge, last-modified date. |
| Case stat | One row per (performance, caseName): last-4 record, knowledge, last date. |
| Modifier | `Mastered` or `Revise` (or none), set by the user on a translation. |

### A.3 Parameters (what the user configures)

| Parameter | Values | Default | Notes |
|---|---|---|---|
| Languages | subset of user languages, ordered | `user.languages` | Old UI: drag to order. Order has no effect on the backend (it shuffles). |
| Parts of speech | Noun / Verb / Adjective / Adverb, ≥1 | Noun + Verb | Only Noun and Verb produce exercises (A.5). With pre-selected words, limited to their PoS. |
| Amount | positive integer | 10 | Old: no maximum; `+1` was accepted (bug). |
| Card type | `Text-Input` / `Multiple-Choice` / `Random` | Text-Input | `Random` = backend picks TI or MC per exercise, 50/50. |
| Language mode | `Multi-Language` / `Single-Language` / `Random` | Random | `Random` = both sets of exercises are generated and mixed. |
| MC difficulty | 0–3 | 1 | Only used for multi-language MC (A.6). Hidden/disabled for TI-only. |
| TI strictness | 1–3 | 2 | Frontend only (A.7). Hidden/disabled for MC-only. |
| Word selection | `Exercise-Performance` / `Random` | Exercise-Performance | Adaptive vs random order (A.9). |
| Native language | Include / Exclude | Include | Only shown when the user has a native language and mode ≠ Multi-Language. Exclude = no single-language drills in the native language. It never affects multi-language exercises (by design: the old tooltip says "in the case of single-language exercises"). |
| Pre-selected words | word ids | none | Comes from Review's bulk action. Replaces the automatic word pool. |
| Mode | `Single-Try` | Single-Try | `Multiple-Tries` exists in old types but is dead. Dropped. |

Old slider texts (keep the meaning):
- MC — L0 "Any word-type – any language"; L1 "Any word-type – same language"; L2 "Same word-type – same
  language"; L3 "Same word – same language – different cases".
- TI — L1 "Ignores capitalization and special characters"; L2 "Only ignores capitalization"; L3 "Zero
  tolerance – exact".

### A.4 Word pool

- Without pre-selected words: the user's own words + words from followed tags that are still visible
  (Public, or Friends-Only with an accepted friendship — re-checked on every call,
  `tagController.getWordsIdFromFollowedTagsByUserId`). After an unfollow, those words leave the pool; their
  performance rows stay.
- With pre-selected words: exactly those ids. (Old backend did not check ownership/visibility — security bug,
  fixed in Part B.)
- Filter by the selected PoS.
- Old: if more than 50 words match (and no pre-selection), take a **random 50**, then rank. **Removed** in
  Part B (D2).

### A.5 Exercise catalogue (parity — no new exercises this phase, D1)

Source: `backend/utils/equivalentTranslations/{multiLang,singleLang}/{nouns,verbs}.js`. Adjectives and adverbs
have **no** catalogue, so they produce zero exercises.

**Multi-language groups** — a group maps one grammatical slot to the matching `caseName` per language. For
each unordered language pair (A,B) from the valid languages (shuffled per word, so direction is random),
where both languages have the slot and the word has both values: one exercise, prompt = A, answer = B.

Nouns:

| Group | EN | ES | DE | EE |
|---|---|---|---|---|
| singular nominative | singularEN | singularES | singularNominativDE | singularNimetavEE |
| singular accusative | – | – | singularAkkusativDE | singularOsastavEE |
| singular genitive | – | – | singularGenitivDE | singularOmastavEE |
| singular dative | – | – | singularDativDE | – |
| plural nominative | pluralEN | pluralES | pluralNominativDE | pluralNimetavEE |
| plural accusative | – | – | pluralAkkusativDE | pluralOsastavEE |
| plural genitive | – | – | pluralGenitivDE | pluralOmastavEE |
| plural dative | – | – | pluralDativDE | – |

Gender is deliberately not compared across languages.

Verbs (persons 1s, 2s, 3s, 1pl, 3pl — no 2pl):

| Tense | EN | ES | DE | EE |
|---|---|---|---|---|
| present | simplePresent{p}EN | indicativePresent{p}ES | indicativePresent{p}DE | kindelPresent{p}EE |
| past | simplePast{p}EN | indicativePerfectSimplePast{p}ES | indicativeSimplePast{p}DE | kindelSimplePast{p}EE |
| future | simpleFuture{p}EN | indicativeFuture{p}ES | indicativeSimpleFuture{p}DE | – |

**Single-language drills** (the native language is skipped when "Exclude" is set):

| PoS | Lang | Card | Prompt case | Answer case | Options |
|---|---|---|---|---|---|
| Noun | ES | MC | singularES | genderES | el / la / el/la |
| Noun | DE | MC | singularNominativDE | genderDE | der / die / das |
| Noun | EE | TI | singularNimetavEE | shortFormEE | – |
| Verb | ES | MC | infinitiveNonFiniteSimpleES | regularityES | regular / irregular |
| Verb | ES | TI | infinitiveNonFiniteSimpleES | participleNonFiniteSimpleES | – |
| Verb | ES | TI | infinitiveNonFiniteSimpleES | gerundNonFiniteSimpleES | – |
| Verb | EN | MC | simplePresent1sEN | regularityEN | regular / irregular |
| Verb | DE | MC | infinitiveDE | auxVerbDE | haben / sein |

With card type `Random`, single-language uses every drill for the language (both MC and TI). With a fixed
type, only drills of that type. With multi-language and card type `Random`, each exercise is TI or MC at
50/50.

### A.6 Multiple-choice options

- **Single-language MC:** options = the fixed list above (correct value included). 2 or 3 options.
- **Multi-language MC:** the answer + **2 distractors** (so 3 options). Distractors come from the other words
  in the pool (old: the sampled ≤50 words, already PoS-filtered). Per candidate word (shuffled), by MC
  difficulty:
  - **L0:** from a random translation of that word (any language) that is not the answer's own translation:
    one random non-property case value. (Because the pool is PoS-filtered, "any word-type" is only true when
    several PoS are selected.)
  - **L1:** same language as the answer; one random non-property case value from that word.
  - **L2:** as L1, but only words with the same PoS.
  - **L3:** same PoS, same language. For **verbs**, it takes **other cases of the same word** (e.g. other
    conjugations of the answer verb). For nouns, other words' case values that differ from the answer.
  - "Non-property" excludes cases starting with `gender`, `gradable`, `regularity`, `auxVerb`, `caseType`,
    `prefix`.
  - If no distractor is found, the exercise is **dropped** (so the session can have fewer cards than asked).
- Old frontend: options = `[answer, ...others without duplicates]`, ordered by `deterministicSort` (sum of
  char codes). Answer comparison for MC is case-insensitive.

### A.7 Answer checking (frontend, pure)

The typed answer is trimmed first. Result is `correct`, `partial` or `wrong`.

| TI strictness | Rule |
|---|---|
| 1 | Exact → correct. Else, if equal after NFD + strip combining accents + lowercase → **partial**. Else wrong. |
| 2 | Exact → correct. Else, if equal after lowercase → **partial**. Else wrong. |
| 3 | Exact → correct. Else wrong. |

MC: case-insensitive equal → correct, else wrong. **Partial counts as correct** for the score and is saved as
`record: true`. `Random` card type uses the chosen TI strictness for TI cards.

### A.8 Knowledge math (by design — keep exactly, D2a)

Per **case stat** (one grammatical form of one translation, per user):

- `record` = last up-to-4 answers (booleans), oldest first. A new answer is pushed; if 4 already exist, the
  oldest is dropped.
- `window = (count of true in record) / 4 × 100` — always divided by 4, so it takes 4 answers to fill the
  window. By design: one correct answer = 25 %.
- New knowledge:
  - first answer on this case (no previous knowledge, or previous = 0): `knowledge = window`
  - otherwise: `knowledge = (0.5 × previous + 3.5 × window) / 4` (12.5 % old value, 87.5 % window)
  - Note: `previous` is the stored (not time-decayed) value.
- Example, all correct: 25 → 46.9 → 71.5 → 96.4 → 99.6 → … (approaches 100). Then one wrong: window 75 →
  78.1.

**Aging (forgetting curve):** `aged = knowledge × e^(−0.01 × days)`, `days = floor(days since lastDate)`.
30 days → ×0.74; 69 days → ×0.50; 180 days → ×0.17.

Per **translation performance** (updated on every answer to any case of the translation):

- `averageTranslationKnowledge = mean over the translation's case stats of aged(knowledge, lastDate)`,
  computed at save time; `lastDateModifiedTranslation = now`.
- At selection time this average is **aged again** from `lastDateModifiedTranslation`. By design: old
  answers weigh less than recent ones.

**Modifiers** (per translation, all its cases):

| Action | Effect |
|---|---|
| Master | modifier = `Mastered`, reviseCounter = 0. Selection treats the translation as knowledge 100. |
| Revise ("forget") | modifier = `Revise`, reviseCounter = 0. Selection treats it as knowledge 0. |
| Same action again | clears the modifier (toggle off), reviseCounter = 0. |
| Master while Revise / Revise while Mastered | switches to the other modifier. |
| Correct answer while `Revise` | reviseCounter + 1; at **5**, the modifier is cleared automatically and the counter reset. |

Knowledge values keep being updated while a modifier is set. The old dialog says Mastered means "you will not
see exercises about this translation" — in reality it is only ranked last. The new copy must say the truth.

### A.9 Selection (which exercises go into a session)

1. Generate all candidate exercises per word (A.5).
2. **Word score** (Exercise-Performance mode): over the user's performance rows for the word whose
   `translationLanguage` is in the user's profile languages: Mastered → 100, Revise → 0, else
   aged(averageTranslationKnowledge, lastDateModifiedTranslation); score = mean; no rows → 0.
3. Order words by score ascending (Random mode: shuffle).
4. **Exercise score** within a word: the case stat for (answer translation, answer case): Mastered → 100,
   Revise → 0, no stat → 0, else aged(knowledge, lastDate).
5. Pick per word, in word order, the lowest-scored exercise (Random mode: a random one). One exercise per
   word per round.
   - Amount < words with exercises: first `amount` words, one exercise each.
   - Amount > words: repeat rounds (each round removes the already-picked exercise identity — same PoS, type,
     language mode, prompt case, answer case) until amount is reached or nothing is left.
6. Multi-language MC exercises get distractors (A.6); those without any are dropped.

Performance is always stored on the **answer** side (itemB translation + case), whatever the prompt language.

### A.10 Saving

- Old `POST /api/exercises/saveTranslationPerformance`: first answer sends `{translationId, word, caseName,
  translationLanguage, record}`; later answers send `{performanceId, caseName, translationLanguage, record}`.
  The response is the full performance with all case stats; the card merges it.
- Old `POST /api/exercises/savePerformanceAction`: `{performanceId, action?: 'master'|'forget'}`.
- Old `GET /api/exercises/getUserExercises?parameters=<nested object>`.

### A.11 Old UI behaviour (for reference, not to copy)

- Three phases on one route: parameters → cards → end screen.
- Card: prompt flag + value; verb pronoun shown before the prompt (`getVerbPronoun`) and inside the TI input;
  case shown as small untranslated chips ("Noun · Nominative · Singular"). Answer-side case chips only for
  single-language TI. No question text (e.g. MC gender cards never say "gender").
- Feedback by toast: "Correct! ✅" / "Incorrect! ❌ – Correct answer: X" / "Partially correct! ⚠ – Correct
  answer: X" (hard-coded English). MC: the chosen option turns green/red; the correct option is not
  highlighted.
- Performance strip: `(trues/4) %` + 4 thumbs for the answer case, tooltip with last date ("Invalid Date"
  before the first answer). Master/Forget icon buttons, enabled only after answering, with confirm dialogs.
- Navigation: previous/next; next disabled until answered or while saving; "Go to results" when all
  answered.
- End screen: score, collapsible parameter summary, collapsible pre-selected words, one row per exercise
  (status, type, flags, prompt, **user's** answer — not the correct one, chips), "review" jumps back to the
  card read-only, "Go back to parameters".
- Review → Practice: "Create exercises" when ≥3 rows are selected.
- `clue` is never used in practice. `ExerciseResult.time` is recorded but never used. Nothing outside
  Practice shows performance.

### A.12 Known defects (all fixed in Part B)

| # | Defect | Where |
|---|---|---|
| 1 | Any user can change any performance row (IDOR) via `performanceId`. | `exercisePerformanceController.ts:250, 386` |
| 2 | `preSelectedWords` loads any user's words, private ones included. | `exerciseController.ts:707-722` |
| 3 | No input validation; missing params → 500; NaN amount. | `exerciseController.ts:691-699` |
| 4 | "Adaptive" only inside a random 50-word sample. | `exerciseController.ts:729-736` |
| 5 | Removing a language leaves followers' rows with `translationId = NULL`; they still count in the word score. | `wordController.ts:657-669`, schema FK `set null` |
| 6 | Removing a case deletes only the owner's first performance's case stats. | `wordController.ts:676-698` |
| 7 | Tag clone copies no performance history. | `tagController.ts:568-658` |
| 8 | No unique `(user, translation)` / `(performance, caseName)` → duplicates on double submit. | schema |
| 9 | Save errors unhandled on the card → state desync. | old `ExerciseCard.tsx:396` |
| 10 | Master/Forget result not stored → stale button state. | old `exercisePerformanceSlice.ts:98-101` |
| 11 | `nativeLanguage` cannot be set in the new app; `updateUser` clears it when the key is omitted. | `userController.ts:414` |
| 12 | Session lost on reload. | old `Practice.tsx` |
| 13 | Hard-coded English toasts/placeholders; locale typos ("willbe", "When your reach"). | old card, `practice.json` |

---

## Part B — Implementation plan

### B.1 Context

Phase 4 (Tags) is merged. `/practice` is a placeholder (`frontend/src/app/router.tsx:149-153`). Review's
bulk bar has no practice action (`features/words/review/BulkActionBar.tsx:11`). `stores/uiStore.ts:3`
already reserves a slot for the pre-selected-words hand-off. The `practice` i18n namespace exists (58 keys,
4 languages, old copy). The invalidation graph (`app/query-client.ts:39-41`) already notes that performance
does not touch `['metrics']`.

The backend endpoints work but have security holes, no validation, a sampling compromise, and data-integrity
gaps (A.12). The user allowed a backend rework for quality and performance, as long as the knowledge-tracking
behaviour stays the same.

### B.2 Decisions taken with the user (2026-09-29)

- **D1 — Catalogue: parity only.** No new exercise types (no adjective/adverb, no new single-language
  drills). The catalogue moves to typed TS so it is easy to extend later (Part D).
- **D2 — Knowledge math: keep exactly.** The /4 window and the double aging are by design (A.8).
- **D2b — Selection: full-pool ranking.** Remove the random-50 sample. One SQL query ranks all candidate
  words by the A.9 word score; random tie-break; the backend loads full word data in batches of ~50, weakest
  first, until it has enough exercises. Random mode uses the same batching with random order. MC distractors
  come from a separate random pool (≤50 words of the candidate set, same PoS filter as before).
- **D3 — Reload restores the session** (sessionStorage, this tab only). Leaving `/practice` by navigation
  *parks* it: the header link then opens the settings with a banner (Resume / Dismiss). A finished session
  (results view) is dropped on leave. Only a reload reopens the exercise card directly.
- **D4 — Mastery/activity statistics: later phase.** Phase 5 = practice flow only.
- **D5 — Stale data: delete for all users.** Removing a translation deletes every user's performance for it
  (FK cascade). Removing a case deletes every user's case stats for it. A migration cleans existing orphans.
- **D6 — Native language: add an optional select to the Account profile form**, backend-validated. The
  practice option shows only when it is set.
- **D7 — Clone copies the cloner's own history** from the source translations to the new copies, in the
  clone transaction.

#### Calls made by the agent (reversible — the user can change them at review)

- **C1 — Evaluation stays on the client** (instant feedback). The client sends a result
  (`correct|partial|wrong`); the server maps it to `record` and validates everything else.
- **C2 — New endpoint contract** (B.3). Old three routes are removed. Enum strings stay the old ones
  (`Multiple-Choice`, `Text-Input`, `Random`, `Multi-Language`, `Single-Language`, `Exercise-Performance`).
- **C3 — Amount: integer 1–100** (backend + frontend). The old app had no maximum.
- **C4 — Review "Practice" action for ≥1 selected word** (old: ≥3). Selected ids travel via `uiStore`
  (the reserved slot), not the URL (a long id list does not belong in a URL).
- **C5 — Parameters live in typed URL search params** (`validateSearch`, same pattern as
  `features/words/review/search.ts`) and are also remembered per browser as the next default.
- **C6 — The running session lives in a Zustand store persisted to sessionStorage**, driven by a pure
  reducer. It is a client-owned snapshot (like a form draft), so it does not go into TanStack Query. The
  invalidation graph records "practice ⇒ no query edges".
- **C7 — Master/Revise stays available only after the card is answered** (parity; the answer creates the
  performance row).
- **C8 — MC keeps 3 options for multi-language** (answer + 2 distractors, parity) — the old UI blueprint's
  "4 options" was wrong. The server builds and shuffles the full option list.
- **C9 — Cards show readable case labels** in the UI language (the old app showed raw enum chips), including
  the target category for single-language drills ("Gender", "Participle"…). A new `caseLabel()` helper reuses
  the form-engine configs.
- **C10 — `practice.json` is rewritten** (new keys, typos fixed) in 4 languages; EE flagged for user review.

### B.3 Architecture

#### Backend — new exercise API

| Method + path | Purpose |
|---|---|
| `POST /api/exercises/generate` | Body = parameters (validated). Returns `{ exercises: Exercise[] }`. POST because it is not idempotent (random). |
| `POST /api/exercises/answers` | Body `{ translationId, caseName, result }`. Upserts the performance + case stat in one transaction. Returns `PerformanceSummary`. |
| `PUT /api/exercises/performances/:translationId/modifier` | Body `{ modifier: 'Mastered' \| 'Revise' \| null }`. 404 if the user has no performance for it. Returns `PerformanceSummary`. |

Response shapes (no `_id`):

```ts
type Exercise = {
  key: string                      // stable client key (wordId + cases + index)
  type: 'Multiple-Choice' | 'Text-Input'
  multiLang: boolean
  partOfSpeech: PartOfSpeech
  wordId: string
  translationId: string            // answer translation
  prompt: { language: Lang; caseName: string; value: string }
  answer: { language: Lang; caseName: string; value: string }
  options?: string[]               // MC only: answer included, no duplicates. Multi-language: shuffled. Single-language: catalogue order.
  performance: PerformanceSummary | null
}
type PerformanceSummary = {
  translationId: string
  modifier: 'Mastered' | 'Revise' | null
  reviseCounter: number
  cases: { caseName: string; record: boolean[]; knowledge: number; lastDate: string }[]
}
```

Rules:
- **Validation** (hand-written validators, same style as the Phase 4 tag controller; 400 with stable error
  codes): languages ⊆ Lang (≥1; ≥2 for Multi-Language), PoS ⊆ PartOfSpeech (≥1), amount 1–100, enums, MC
  difficulty 0–3, `wordIds` = array of uuids (≤ 500).
- **Visibility:** `wordIds` are filtered to words the user owns or can see through a followed visible tag
  (reuse the Phase 4 visibility helper); invisible ids are ignored (not an error), so a stale Review selection
  does not break the session. `answers`: the translation must belong to such a word and `caseName` must exist
  in it (else 404). Performance rows are always looked up by `(req.user.id, translationId)`, never by a
  client-sent performance id — this closes the IDOR.
- `nativeLanguage` comes from `req.user`, not the request. Body only says `excludeNative: boolean`.
- **Ranking query (D2b):** candidate words (own ∪ visible followed, PoS filter, has translations in the
  needed languages) LEFT JOIN performances; compute the A.9 word score in SQL (`exp(-0.01 * floor(...))`,
  CASE on modifier, languages filter on `req.user.languages`); `ORDER BY score, random()`. Then batches of 50
  go through the pure generator until enough words produced exercises; multi-round only if the whole pool is
  exhausted. A unit test pins the SQL score against the JS `calculateWordAverageKnowledge` on the same data.

#### Backend — pure domain module

`backend/services/exercises/` (TypeScript, no DB access, injectable RNG so tests are deterministic):
- `catalogue.ts` — the four `equivalentTranslations/*.js` files as typed data (then those files are deleted).
- `knowledge.ts` — `calculateAging`, `calculateNewPercentageOfKnowledge`, `applyAnswer(caseStat, record)`,
  `translationAverage`, `wordScore`, `exerciseScore`, `applyModifierAction`, revise-counter rule.
- `generate.ts` — per-word exercise building (multi + single language, native exclusion).
- `select.ts` — the A.9 picking algorithm.
- `distractors.ts` — the A.6 MC levels.
- Existing `tests/unit/forgettingCurve.test.js` keeps passing; new unit tests pin every A.8/A.9 example.

#### Migration 0007 (performance integrity)

1. Delete performance rows with `translation_id IS NULL` (orphans).
2. De-duplicate `(user_id, translation_id)`: keep the row with the latest `last_date_modified_translation`,
   delete the others (their cases cascade). De-duplicate `(exercise_performance_id, case_name)`: keep the
   latest `last_date`.
3. `translation_id` → `NOT NULL`, FK `ON DELETE CASCADE`.
4. Unique indexes on `(user_id, translation_id)` and `(exercise_performance_id, case_name)`.
5. CHECK `performance_modifier IN ('Mastered','Revise')`.
- The migration must also run cleanly on a dump of the live DB at cutover (Phase 8 checklist item).

#### Backend — changes outside the exercise controller

- `wordController.updateWord`: a removed case deletes that case's stats for **all** users (D5). Wrap the
  update in a transaction.
- `tagController.cloneTagForUser`: copy the cloner's performance + case rows to the new translation ids (D7),
  inside the existing transaction; also move the source reads onto `tx`.
- `userController.updateUser`: validate `nativeLanguage` (Lang or null); only change it when the key is
  present (fixes defect 11); `serializeUser` already exposes it.

#### Frontend — `features/practice/`

```
features/practice/
  types.ts            # PracticeParams, Exercise, PerformanceSummary, AnswerResult
  api.ts              # generateExercises, saveAnswer, setModifier
  hooks.ts            # useGenerateExercises, useSaveAnswer, useSetModifier (mutations)
  search.ts           # validatePracticeSearch (+ test)
  evaluate.ts         # evaluateTextInput / evaluateChoice — A.7 verbatim (+ test)
  session.ts          # pure reducer: start, answer, saveSucceeded, saveFailed, goTo, finish, reset (+ test)
  sessionStore.ts     # Zustand persist(sessionStorage) around the reducer
  components/         # ParametersForm, PreselectedWords, SessionView, ExerciseCard, TextInputAnswer,
                      # ChoiceAnswer, AnswerFeedback, ProgressHeader, PerformanceIndicator,
                      # ModifierActions, ResultsView, ResultRow, ParametersSummary
  pages/PracticePage.tsx
lib/cases.ts          # caseLabel(pos, lang, caseName) + pronoun lookup (+ test)
test/msw/practiceHandlers.ts
```

- `caseLabel` reuses `getFormConfig` (`features/words/form-engine/configs/index.ts`), `WordCasesData`
  (`ts/wordCasesDataByPoS.ts`) and the pronoun tables (export `pronounLabel` from `configs/verbs.ts`).
- Reuse: `FlagIcon`, `lib/language.ts` (`langTint`, `languageByLabel`), `partOfSpeechLabelKey`,
  `ConfirmDialog`, `SegmentedToggle`, `LanguagePicker`, the `ui/` primitives.
- Save failures: the answer stays in the session with status `unsaved`; the card and results show it with a
  retry action; navigation is never blocked by a failed save (fixes defect 9).
- `uiStore`: `practicePreselectedWordIds` set by Review, read and cleared by the parameters screen.

### B.7 Risks

- **Ranking SQL drifts from the JS math.** Mitigation: the unit test that compares both on the same data.
- **Migration 0007 deletes data** (orphans, duplicates). Mitigation: counts logged by the migration; tested on
  a seeded DB; run on a live-DB dump before cutover.
- **Fewer cards than asked** (dropped MC, sparse catalogue). Mitigation: the session states "N of M exercises
  could be created" — never silent.
- **Catalogue sparsity** makes single-language mode feel thin. Accepted (D1); Part D.

---

## Part C — Design brief: the practice process

*Copy this part into the design tool. It describes steps, logic and requirements only. It does not describe
layout, placement or visual style. Do not copy the old app's design. The app has light and dark themes, four
UI languages (EN, ES, DE, ET), and must work on phone and desktop.*

### C.1 What practice is

Ladu stores words in several languages at once (English, Spanish, German, Estonian), with all their
grammatical forms. Practice makes short exercise sessions from those words. Each answer updates a knowledge
score for that exact form (for example "German, plural genitive of *Haus*"). Scores fade with time. The next
session shows the weakest forms first. The user must always understand what is asked, whether the answer was
right, and how well they know the item.

Design principles that apply here:
- All languages are equal. Never treat one language as the main one. Each language has a flag and an accent
  colour already used in the app.
- Starting a session must be fast. Good defaults; advanced options hidden until asked for.
- A session is focused: one exercise at a time, few distractions.
- Progress and knowledge status are always visible and easy to read.

### C.2 The flow (three stages on one page)

```
[Entry] → Stage 1: Set up → Stage 2: Exercises (one card at a time) → Stage 3: Results
              ↑__________________ new session / change setup ______________|
```

Entry points:
1. **Practice** in the main navigation → set-up with the last-used settings (first time: defaults).
2. **Review table** → user selects words → "Practice" action → set-up with those words pre-selected.
3. **Reload / return** during an active session → the session continues at the same exercise.

### C.3 Stage 1 — Set up

**Inputs** (defaults in brackets):

| Setting | Choices | Rules |
|---|---|---|
| Languages | the user's languages, multi-select [all] | ≥1; ≥2 when "different languages" is chosen. |
| Word types | Noun, Verb, Adjective, Adverb, multi-select [Noun + Verb] | ≥1. Adjective and Adverb must say "no exercises available yet". With pre-selected words, only their word types can be chosen. |
| Number of exercises | 1–100 [10] | Whole number only. |
| Answer style | Type the answer / Choose the answer / Mixed [Type] | |
| Languages per exercise | Different languages / Same language / Mixed [Mixed] | "Different": see a word in one language, answer in another. "Same": a grammar drill inside one language (e.g. "gender of *Haus*"). |
| Advanced: choice difficulty | 4 levels [level 1] | Only relevant when choices are shown. L0 wrong options from any language; L1 same language; L2 same language and word type; L3 same word, different forms. |
| Advanced: typing strictness | 3 levels [level 2] | Only relevant when typing. L1 ignores accents and capitals; L2 ignores capitals only; L3 exact. |
| Advanced: word order | Weakest first / Random [Weakest first] | |
| Advanced: native language | Include / Exclude [Include] | Only shown when the user has a native language and the mode is not "Different languages". Exclude = no grammar drills in the native language. |

**Pre-selected words** (entry 2): show which words will be used (each with its language flags and main
form) and their count, with a way to remove the pre-selection and practice from the whole vocabulary.

**Start:**
- Disabled while the settings are invalid; field errors say what to fix.
- While exercises are generated (short wait): a loading state; Start cannot be pressed twice.
- Result cases:
  - **Exercises found:** go to Stage 2.
  - **Fewer found than asked:** go to Stage 2 and say "8 of 10 exercises could be created".
  - **None found:** stay in Stage 1 and explain the likely reasons (not enough words with these word types
    or languages, words missing the needed forms, only adjectives/adverbs selected) with a way to adjust.
  - **Error:** message + retry.
- Special case: user has no words at all → explain and link to "Add word".

### C.4 Stage 2 — Exercises

**Session progress (always visible):** current position (e.g. 4 of 10), how many answered, how many
correct so far. A way to leave the session (asks for confirmation; answers already given stay saved).

**One exercise shows:**
1. **The prompt**: the word form, its language (flag), and a readable label of its grammatical form
   (e.g. "plural · genitive", "present · 1st person singular"). For verb forms, the personal pronoun
   (e.g. *yo*, *ich*, *ma*) appears with the form.
2. **The task**: the target language (flag) and what form is expected.
   - Different-languages exercise: "Same form in German" + label of the expected form.
   - Same-language drill: a clear question for the category: "Gender of…", "Is this verb regular or
     irregular?", "Auxiliary verb of…", "Short form of…", "Participle of…", "Gerund of…".
3. **The answer control:**
   - **Typing:** one text field; for verbs the pronoun is shown next to it. Submit with a button or the
     Enter key. An empty answer cannot be submitted.
   - **Choosing:** 2–3 options (same-language drills: fixed sets like der/die/das, el/la/el/la,
     regular/irregular, haben/sein; different-languages: the right answer + 2 wrong ones). One click or
     number key (1, 2, 3) answers. Only one try.
4. **Knowledge indicator** for this exact form: the last up to 4 attempts (right/wrong, oldest to newest,
   empty slots when fewer), the knowledge score as a percentage, and when it was last practiced. Never
   practiced → a clear "new" state (not "0 %" alone, not an invalid date). A "Mastered" or "Revise" status
   is shown when set.
5. **Actions on the translation** (enabled only after answering):
   - **Mastered** — "I know this, show it less." Confirmation needed; says what it does. Pressing it again
     removes the status (with confirmation).
   - **Revise** — "I struggle with this, show it more." Confirmation needed. While active it shows progress
     "n of 5 correct answers" — after 5 correct answers it is removed automatically.
   - Switching from one status to the other is allowed.
   - These act on the whole translation (all forms of that word in that language), not only this form. The
     copy must say so.

**After answering (immediately, no page change):**
- Result: **Correct**, **Almost correct** or **Wrong**.
  - Almost correct = only accents or capital letters differ (depends on strictness). It counts as correct;
    show the exact expected form so the user sees the difference.
  - Wrong = show the correct answer next to the user's answer.
  - Choosing: mark the chosen option as right/wrong **and** mark the correct option.
- The answer control locks (one try only).
- The knowledge indicator updates with the new attempt when the save succeeds.
- Saving happens in the background. If saving fails: show "not saved" on this exercise with a "retry"
  action. The user can continue anyway.
- Next step: a "Next" action (also the Enter key). On the last exercise it becomes "See results".

**Navigation:**
- Back / forward between exercises. Answered exercises show read-only with their result. Unanswered ones can
  be answered in any order.
- "See results" is available when all exercises are answered. (Optional: "finish early" — see Part D.)
- Reload keeps the session and the position.

### C.5 Stage 3 — Results

- **Score:** correct (incl. almost correct) out of total, and a percentage. Almost-correct count shown
  separately.
- **Any unsaved answers:** a warning with "retry all".
- **One row per exercise:** status (correct / almost / wrong), answer style (typed / chosen), prompt
  (flag + form + label), expected answer (flag + form + label), the user's answer when different, word type.
- **Open an exercise** from a row → shows that card read-only (with its knowledge indicator and the
  Mastered/Revise actions still usable) → return to results.
- **Settings summary** used for the session (collapsed by default). With pre-selected words, the list of
  words.
- **Actions:** "Practice again" (same settings, new exercises), "Change settings" (back to Stage 1 with
  these settings), and a way to go to the Review table.

### C.6 States and edge cases the design must cover

| State | Requirement |
|---|---|
| First visit, no words | Explain and link to Add word. |
| Only 1 language on the account | "Different languages" is not possible; say why. |
| Generating | Loading state; no double submit. |
| No exercises | Explanation + adjust (C.3). |
| Fewer exercises than asked | Inform, continue. |
| Save in progress | Subtle indicator; nothing blocks. |
| Save failed | "Not saved" + retry (per card and on results). |
| Mastered/Revise request failed | Error message; status unchanged. |
| Reload mid-session | Resume at the same card. |
| Leave mid-session | Confirm; answers stay saved. |
| Long words / long verb forms | Must wrap, never overflow on phone. |
| Words from followed tags | Allowed in practice; nothing different in the card. |

### C.7 Accessibility and input

- Full keyboard use: Enter submits / goes next; 1–3 pick an option; focus moves to the answer field on each
  new card.
- Result is not shown by colour only (icon + text too). Screen readers announce the result.
- Text inputs: no browser autocorrect/autocapitalise/spellcheck (they would change the answer).
- Works in light and dark theme; all texts come from translations (4 UI languages).

### C.8 Components the implementation will need (for the mockups)

Set-up form; pre-selected words panel; session progress; exercise card (prompt, task, typed answer, choice
answer); answer feedback; knowledge indicator (4 attempts + % + last date + status); Mastered/Revise actions
with confirmation dialogs; save-failed notice; results summary; result row; settings summary; empty/error
states. Existing app pieces to reuse in mockups: language flags and colours, word-type labels, dialogs,
toggles, buttons, the app header.

---

## Open items

None. Practice extensions that were deferred are listed as idea I-8 (`research/deferred-ideas.md`).
