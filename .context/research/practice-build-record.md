# Practice: build record (Phase 5, 2026-09-29 to 2026-09-30)

Research record, kept whole. It holds the slices (B.4, with the "as built" notes of slices 2 to 9), the file list (B.5) and the verification (B.6) of the Phase 5 plan. The live spec, with the knowledge base, the decisions and the architecture, is `.context/features/practice.md`. Code comments that cite "Slice 3" or "Slice 9" mean the slices below.

## B.4 Slices

Each slice ends runnable; the user commits and re-confirms between them. **Slices 5–8 need the mockups from
Part C first.** Slices 1–4 have no UI and can run while the mockups are made.

| Slice | Status | Scope |
|---|---|---|
| 0 | Done, committed | Persist this plan as `.context/features/practice.md`; link it in `.context/roadmap.md` §5/§9 and `.context/README.md`. |
| 1 | Done, committed | Backend: pure domain module `services/exercises/*` + unit tests pinning A.5–A.9. Old endpoints re-wired onto it, behaviour unchanged. |
| 2 | Done, committed | Backend: migration 0007 + D5 (`updateWord`) + D7 (clone history) + D6 backend (`nativeLanguage` validation) + tests. |
| 3 | Done, committed | Backend: new API (B.3) with validation, visibility, full-pool ranking + batching; remove old routes; Jest suite rewritten (IDOR, visibility, ranking order, batching, distractor levels, revise counter, native exclusion, response shape). |
| 4 | Done, committed | Frontend data layer: types, api, hooks, MSW handlers, `evaluate.ts`, `session.ts` + store, `search.ts`, `lib/cases.ts`; `practice.json` rewrite (4 languages). Unit tests. |
| 5 | Done, committed | Frontend: parameters screen (URL state, validation, pre-selected words, empty-pool states) + Review "Practice" bulk action + Account native-language select. |
| 6 | Done, committed | Frontend: session — card (TI + MC), feedback, progress, navigation, answer saving with retry, reload restore. |
| 7 | Done, committed | Frontend: performance indicator + Master/Revise actions (confirm dialogs, revise counter). |
| 8 | Done, committed | Frontend: results screen — score, rows, review a card, restart flows. |
| 9 | Done | Phase gate: `e2e/tests/phase-5-practice.spec.ts` + docs + full green run. |

**Slice 1 detail.** Port without behaviour change; `Math.random` replaced by an injected RNG. Tests use fixed
seeds and hand-built words: catalogue coverage per PoS/language, pair generation, native exclusion, the
knowledge examples of A.8, word/exercise scores with Mastered/Revise, multi-round picking, each distractor
level (incl. verb L3 same-word), drop-when-no-distractor.

**Slice 2 detail.** Migration tested on a seeded DB with orphans and duplicates. Tests: removing a language
deletes a follower's rows; removing a case deletes all users' stats for it; clone copies only the cloner's
rows with remapped ids; `updateUser` validates `nativeLanguage` and keeps it when omitted.

**Slice 2 — as built.**
- `0007_exercise_performance_integrity.sql`: a cleanup block first (deletes orphans, duplicate performances,
  duplicate case stats; clears invalid modifiers; logs the counts as NOTICEs), then the constraints:
  `translation_id` NOT NULL + FK `ON DELETE CASCADE`, unique `ep_user_translation_unique`
  `(user_id, translation_id)`, unique `epc_performance_case_unique` `(exercise_performance_id, case_name)`,
  CHECK `ep_modifier_check`. `schema.ts` matches.
- `updateWord`: the translation changes now run in one transaction. Removing a translation relies on the FK
  cascade (all users). Removing a case deletes that case's stats for all users and recomputes the stored
  average of every affected performance (same rule as the save path: aged mean at `now`, date set to `now`).
- `cloneTagForUser`: copies the recipient's own performance rows and case stats to the new translations
  (ids remapped). The tag-word read moved onto `tx`. `fetchWordsWithRelations` still reads through `db`
  (it is a shared service that does not take a `tx`); the source data is read-only there, so this is safe.
- `updateUser`: `nativeLanguage` must be one of the user's languages (after this update) or `null`, else 400.
  Omitting the key keeps the stored value, except that a stored value the new language list no longer
  contains is cleared.
- Tests: `tests/exercisePerformanceIntegrity.test.js` (migration run inside a rolled-back transaction on
  seeded bad data; D5; D7) and a `nativeLanguage` block in `tests/auth.test.js`.

**Slice 3 detail.** Add a benchmark script (`backend/scripts/bench-exercises.ts`, not a test) that seeds
~5,000 words and times `generate`; record the number in this file.

**Slice 3 — as built.**
- New files: `services/exerciseService.ts` (DB side: ranking, batching, save, modifier),
  `services/exercises/validate.ts` (pure request validation, stable error `code`s) and
  `services/exercises/present.ts` (response shapes, option building). Controller `exerciseController.ts` is thin.
  `exercisePerformanceController.ts` and the three old routes are deleted. `modifierForAction` is removed
  (the new API sets the modifier directly).
- Errors: 400 `{ message, code }` (`invalid_languages`, `invalid_amount`, …); 404 `{ message, code: 'not_found' }`.
  `answers` returns 404 for an unknown translation, a translation the user cannot see, or an unknown case — one
  answer for all three, so a private word never leaks.
- `modifier` is set directly (`Mastered` / `Revise` / `null`); the client decides the toggle. Setting resets the
  revise counter.
- Ranking: one SQL query (`rankCandidateWords`) — own words ∪ visible followed words, PoS filter, at least 2
  (Multi-Language) or 1 selected language present, word score in SQL, `ORDER BY score, random()`. "Now" is passed
  from JS (epoch seconds), not read from the DB clock. A test pins SQL against `wordScore`.
- Batching: 50 words per round trip, stops once `amount` words gave exercises. If the pool ends first,
  `pickExercises` repeats rounds over the words found.
- Distractor pool: random sample of ≤50 candidate words **plus the picked words** (level 3 for verbs needs the
  answer's own word).
- Saving: insert-if-missing + `SELECT … FOR UPDATE` + upsert of the case stat, in one transaction. Two parallel
  answers make one row and keep both answers (tested).
- Single-language choices keep the catalogue order (der/die/das); multi-language choices are shuffled.
- Benchmark (`npx tsx scripts/bench-exercises.ts`, test DB, 5,000 words × 4 languages, 60 % practised): median
  43–56 ms for 10 or 100 exercises, all card types and modes.
- Gate note: the `_id` grep must be `grep -rnw "_id"` — plain `_id` also matches `translation_id`.
- Tests: `tests/exercises.test.js` rewritten (57 tests), `tests/unit/exercisesApi.test.js` (new). The
  `ExercisePerformance` snapshot in `snapshots.test.js` now records the new `PerformanceSummary` shape.
- Known flake: `tags.test.js › removes the follow when cloning a tag the caller already follows` failed once
  with "socket hang up" in a full run; it passes alone and on the previous commit.

**Slice 4 — as built.**
- `features/practice/`: `types.ts`, `api.ts` (3 calls), `hooks.ts` (3 mutations, no queries, no cache edges —
  tested), `errors.ts` (maps the API's stable `code`, not the English text), `evaluate.ts` (A.7), `params.ts`
  (defaults, `validateParams`, `relevantSettings`, `toGenerateBody`), `search.ts` (URL contract with short codes:
  `?lang=&pos=&n=&card=&mode=&mc=&ti=&order=&native=`), `remembered.ts` (last settings, localStorage, always
  wrapped), `session.ts` (pure reducer + selectors), `sessionStore.ts` (Zustand persist to sessionStorage).
- Session rules in the reducer: one try per card; a failed save is kept as `unsaved` and never blocks
  navigation; a performance is copied to every card of the same translation; a slower, older save response
  never rolls a card back; results open only when all cards are answered; a card opened from the results
  returns there.
- The store ties a session to its account (`useSessionFor(userId)`) and clears it on logout. A broken or
  planted sessionStorage blob is discarded, not trusted. This is the third and last store; the Review hand-off
  slot is `uiStore.practicePreselectedWordIds`.
- `lib/cases.ts`: `caseLabel(t, pos, caseName)`, `describeCase`, `pronounFor`. It does **not** reuse the form
  configs' labels (those are native grammar terms, not UI-language). It reads `WordCasesData` and the
  `practice:cases.*` keys instead. Tenses show their shared meaning (Present / Past / Future) so a
  cross-language pair reads the same on both sides. `pronounLabel` is exported from `configs/verbs.ts`.
- `practice.json` is rewritten in EN, ES, DE, EE (old keys were unused). It already holds every string the
  design brief needs for Slices 5–8; later slices may add keys. **EE is not reviewed by the user yet.** A parity
  test (`locales.test.ts`) checks that all four files have the same keys and placeholders.
- `test/msw/practiceHandlers.ts`: in-memory fake with the real last-4 record, knowledge formula and revise
  counter; options to fail the next saves or `generate`. `makeExercise()` builds a valid exercise.
- Bug found by a test: the URL parser first accepted every `PartOfSpeech` enum value (e.g. `Pronoun`); it now
  accepts only the four types the screen offers.
- Known limit: a Master/Revise response and an older save response for the same card carry the same date, so
  the reducer cannot tell them apart. Slice 7 must disable the two buttons while that card's save is running.
- Gate: frontend suite 1102 tests green, `tsc -b` + `vite build` green, ESLint 0 errors.

**Slice 5 — as built.**
- `features/practice/pages/PracticePage.tsx` (route `/practice`, `validateSearch` = `validatePracticeSearch`),
  `components/{ParametersForm,PreselectedWords,ChipGroup}.tsx`, `preselection.ts`, `narrowPartsOfSpeech` in `params.ts`.
- Settings order of precedence: URL, then the remembered settings, then the defaults. They are read once at
  mount; every change is written back to the URL (`replace`). The amount is kept as text in the form, so an
  invalid value shows its error and never reaches the URL. Start remembers the settings.
- Start results: exercises -> `sessionStore.start`; none -> the "no exercises" explanation stays on the screen
  (it names the only-adjectives/adverbs reason when that is the case); error -> message + retry; Start is
  disabled while the request runs. Users with no words see the "no words" state (one-row `useWordsInfinite`).
- **Hand-off changed from the plan:** `uiStore.practicePreselection` carries `PreselectedWord[]` (id, word type,
  main form, languages), not only ids — the screen needs them to list the words and limit the word types.
  The page reads the slot once at mount and clears it. A pre-selection wins over a running session: that
  session is dropped (its answers are already saved).
- Review: "Practice" bulk action from one selected word up (C4); it is enabled with any selection.
- Account: optional native-language select (options = the selected languages + "None"). The form sends
  `null` when the stored value is no longer one of the selected languages (the backend rejects it otherwise).
  The read-only profile shows the native language too.
- **Temporary:** while a session runs, `/practice` shows "Exercise N of M", the shortfall note and "Change
  settings". Slice 6 replaces it with the card view.
- New keys (4 languages): `review:bulk.practice`, `account:fields.{nativeLanguage,nativeLanguageNone,nativeLanguageHint}`.
  EE is not reviewed by the user yet.
- Gate: frontend suite 1137 tests green, `tsc -b` + `vite build` green, ESLint 0 errors.

**Slice 6 — as built.**
- New files in `features/practice/`: `useSessionActions.ts` (answer, save, retry — the only network code of a
  session), `components/{SessionView,ExerciseCard,TextInputAnswer,ChoiceAnswer,AnswerFeedback,ProgressHeader}.tsx`.
  `PracticePage` shows `SessionView` for a running session. The results view is still a **temporary
  placeholder** (score + "Change settings"); Slice 8 replaces it.
- Saving: the answer is stored at once (`saving`), the request runs in the background. A failed save becomes
  `unsaved` with a Retry button on the card; navigation is never blocked. A save response is applied only if
  the exercise at that index is still the same (by key).
- One try: a second answer for the same card is ignored before any request is made.
- Reload: the session comes back at the same card from sessionStorage. A save that the reload cut off is shown
  as `unsaved` (`recoverInterruptedSaves`). **Known limit:** if that request had reached the server, Retry
  records the answer a second time.
- Keyboard: the answer field has focus on a new open card; after an answer the focus moves to "Next" (Enter
  goes on); keys 1–3 pick a choice (ignored while typing in a field or with a modifier key).
- Feedback: result by icon + text (not by colour alone), in a polite live region. A wrong or partial answer
  shows the expected form; a wrong typed answer also shows what was typed. A choice card marks the chosen
  and the correct option.
- Card labels: prompt line = flag, language, word type, readable case label; verb pronoun before the prompt
  and next to the input. Same-language drills show a question ("What is the gender of this word?"), other
  cards "Same form in {language}" + the case label.
- Navigation: Previous / Next are free. On the last card "See results" is enabled only when every card is
  answered, with the hint `session.answerAll` (new key, 4 languages; EE not reviewed).
- Not in this slice (Slice 7): knowledge indicator, Master/Revise.
- Gate: frontend suite 1155 tests green, `tsc -b` + `vite build` green, ESLint 0 errors.

**Slice 7 — as built.**
- New: `components/PerformanceIndicator.tsx`, `components/ModifierActions.tsx`; both sit in `ExerciseCard`
  (below the answer), so Slice 8 gets them on a card opened from the results for free.
- Indicator: 4 attempt slots of the answer case (oldest first, empty slots; icon + hidden text, not colour
  alone), the stored knowledge rounded (`47 %`), the last-practice date in the UI language, or **"New"** when
  the form has no stat (no "0 %", no invalid date). Mastered / Revise status chip; Revise adds "n of 5 correct
  answers". It updates when the save response arrives.
- Actions: Mastered / Revise buttons, enabled **only when this card's answer is `saved`** (this closes the
  Slice 4 known limit: a Master/Revise response can no longer meet a slower save response of the same card;
  it also means the performance row exists). Pressing the active status opens the "remove" dialog; pressing
  the other one switches. Each change asks first; Cancel changes nothing. The copy says the action covers all
  forms of the word in that language.
- A failed change shows `dialogs.failed` and keeps the old status. The response goes through the session
  store (`performanceChanged`), so leaving the card while the request runs cannot lose it, and every card of
  the same translation shows the new status.
- No new locale keys (all were in the Slice 4 rewrite). Mastered copy says "show less often", not "hidden" (A.8).
- Gate: frontend suite 1164 tests green, `tsc -b` + `vite build` green, ESLint 0 errors.

**Slice 8 — as built.**
- New in `features/practice/components/`: `ResultsView.tsx`, `ResultRow.tsx`, `ParametersSummary.tsx`. The
  temporary placeholder in `PracticePage` is deleted. `PreselectedWords.tsx` now also exports
  `PreselectedWordList` (shared by the set-up panel and the summary).
- Results: score ("n of m correct", percent, "almost correct" count only when > 0), an unsaved warning with
  "Retry all" (`useSessionActions().retryAll`), one row per exercise (status as icon + text, typed/chosen,
  word type, prompt, expected answer, the user's answer only when it differs, per-row retry, "Open exercise").
- Open a row: the reducer's `openFromResults` shows the normal card (read-only, with indicator and
  Master/Revise). While `returnToResults` is set, Previous/Next are replaced by "Back to results".
- Session change: `Session.preselected` (labelled words) is stored next to `wordIds`, so the summary can list
  them and "Change settings" can restore them. A session stored before this slice has no such field; that
  only affects the word list.
- "Practice again": one `generate` call with the same settings and word ids; on success the new session
  replaces the old one. Failure shows the error on the results; an empty result shows "No exercises found".
- "Change settings": the settings go to the remembered copy (sync) and the URL, the pre-selected words go back
  to the page, and the session is cleared. The set-up reads the URL at mount, but the navigation settles later,
  so the remembered copy is what carries the values (found by a test: the amount came back as 10).
- Settings summary: collapsed; leaves out settings that did nothing (choice difficulty, typing strictness,
  native language follow `relevantSettings`).
- No new locale keys (all were in the Slice 4 rewrite).
- Gate: frontend suite 1173 tests green, `tsc -b` + `vite build` green, ESLint 0 errors (3 old warnings).

**Mockup alignment — Exercise settings (between Slice 8 and 9).** Screen-by-screen pass against
`mockups/practice.html`; this is the first of three (settings, card, results). Decisions taken with the user:
- Header as on Add word: `h1` "Practice" + subtitle beside it. The form has no max width (options will change later).
- One card of rows separated by lines, an inline hint beside each label ("All your languages" / "2 of 4 languages",
  "1–100", word-type hint always visible). Advanced is the last row (a bordered disclosure). Start row below the card:
  play icon, "Start session", "Fix the highlighted fields to start." while invalid.
- **Adjective and Adverb chips are disabled** (tooltip on the chip's wrapper). The single source of truth is
  `PARTS_OF_SPEECH_WITH_EXERCISES` — extending the catalogue enables the chips. The page drops them from URL and
  remembered settings. A pre-selection with no Noun/Verb shows an explanation and blocks Start.
- Amount is `type="number"`; the text state stays so an empty or fractional value still shows its error.
- New `OptionRow`: desktop = radio list with every description; phone (`useIsMobile`, 920 px) = chips, labelled
  "Level 0…3" (not L0…). Used for choice difficulty, typing strictness, word order, native language (named). The first three have an icon (list, pencil, funnel); the name column has one fixed width (`w-56`) so the radio buttons line up across the rows.
  Irrelevant rows stay **disabled with a reason** (implementation kept over the mockup).
- Pre-selected panel: source-neutral title, list open at first and collapsible, ghost "Remove pre-selection" with
  a confirm dialog, and a note that the list will change later.
- "No exercises found": warning icon, a third reason about the mode, and an "Adjust settings" button (opens Advanced,
  scrolls to languages). Generate errors stay an inline alert with retry (not a toast).
- New/changed locale keys in 4 languages (EE not reviewed by the user): `setup.{title,subtitle,start,fixToStart}`,
  `setup.advanced.title`, `setup.levels.label`, `setup.hints.*`, `setup.options.nativeDesc.*`,
  `setup.preselected.{clear,note,confirm.*}`, `setup.noMatch.{reasonMode,adjust}`, `setup.noWords.*`.
  Removed: `advanced.show/hide`, `hints.nativeLanguage`, `preselected.limitedTypes`, `noMatch.reasonOnlyUnsupported`.
- Not checked in a browser yet (light/dark, phone width): do it in the manual pass.

**Mockup alignment — Exercise card (second of three).** Decisions taken with the user:
- **Session bar** (`ProgressHeader`): sticky under the app header (`top-13`), blurred, bordered. The position text is the `<h1>` (kept as "Exercise N of M"), then bold "N answered · N correct", a 4 px meter (answered / total), and a ghost "Leave session" at the far end. The shortfall note is a warning banner above the card. The whole view is 720 px wide, centered.
- **Prompt row kept** (flag, language, word type, form). The task row of a cross-language card now uses the same format and no "Same form in". Same-language drills keep their question.
- **Typed cards:** the pronoun is a fixed prefix inside the field frame; one row with the Check button; a drill's placeholder says what to type ("Type the participle…"). Result tile (icon + bold result, expected form underneath) only on typed cards; the typed value stays in the locked field. Choice cards keep their coloured options and only announce the result (screen readers).
- **Icons:** all result icons come from Phosphor (`ResultIcon`: correct / almost / wrong), also in the options, the dots and the results rows.
- **Knowledge block** (`PerformanceIndicator`): dashed line, eyebrow "Knowledge — this exact form", status pill (green Mastered / amber "Revise · n of 5") with a remove button inside, and at the row's end two icon buttons (graduation cap, repeat). The buttons and the pill's remove button are **not in the page before the card is answered**, and work only once the answer is saved (`aria-disabled`, so the tooltip still shows). The active status has no button (its pill has the X). Dots keep icon + hidden text; icons take the colour of the circle border. The save state ("Saving…", "Saved", "Not saved" + retry) sits at the right of the second row.
- **Scope of Master/Revise — verified in the backend:** the modifier is stored per (user, translation) and `exerciseScore` / `wordScore` rank every form of that translation as known (Mastered) or unknown (Revise). So "all forms of this word in {language}" is accurate. It changes how often the forms are shown, not the knowledge % of any form. The tooltip and dialog copy say so.
- **Dialogs and toasts:** leave dialog with a red "Leave" and "Keep practicing" (no toast). Status dialogs use the mockup wording with the language name (the exercise data has no main form of the translation); removing asks separately for Mastered / Revise. A success toast follows a status change.
- Locale keys (4 languages, EE not reviewed): `session.{answered,correct,leave,leaveDialog}`, `card.{answerPlaceholder,answerPlaceholderPronoun,placeholder.*}`, `indicator.title`, `status.{reviseShort,remove}`, `actions.{masterTip,reviseTip,toast.*}`, `dialogs.{master,revise,removeMastered,removeRevise}`. Removed: `card.sameFormIn`, `feedback.yourAnswer`, `actions.{masterHint,reviseHint,answerFirst,wholeTranslation}`, `dialogs.remove`.
- The result-tile text uses a mix of the status colour and the text colour (the plain status colours measured 4.3:1 on their tint in the light theme, below 4.5:1). Not yet checked in a browser.

**Mockup alignment — Result screen (third of three).** Decisions taken with the user:
- **Header (revised twice):** the back arrow + title "Session results" are above the card again. The card has three equal columns, content centred, dividers between them on wide screens: big "a of b" + "correct answers" (+ the almost-correct hint) | a flag grid + a big **Y** + "languages" | a **word-type tag grid** + a big **X** + "types of words" (tags = abbreviations "n.", "v." with a 1 s tooltip; same grid shapes as the flags, shared in `gridShape.ts`). The small labels sit on the bottom edge of the big figures. No percentage anywhere (the `results.percent` key is removed). Y and X count what the exercises really used (`sessionCoverage`), not what the settings allowed. Grid shape (flags and word-type tags, `gridShape.ts`): 1 item = 1×1; from 2 on, always **2 rows** and `ceil(n/2)` columns, filled column by column, so an odd item sits alone on the **bottom** row of the last column (2→2×1, 3→2×2 with the top-right cell empty, 5→2×3, …). On a phone the three blocks stack. The session bar on the card screen no longer shows "N answered" (position, "N correct", meter and Leave stay).
- **Header (first version):** back-arrow icon button ("Back to set-up", same as "Change settings") + H1 "Session results". The page is full width.
- **Score card:** horizontal. A 42 px display-font "8 of 10" with the mono percent, and the label "correct answers". The hint "includes N almost correct — accents or capitals only" shows **only** when there are almost-correct answers (the mockup showed "all typed or chosen exactly right" even with wrong answers, which is false). The unsaved banner has a warning icon.
- **Rows:** one card for the whole list, rows separated by lines. Each row is **one button** that opens the exercise (hover background; hidden text "Open exercise"). Wide screens: status | typed/chosen (mono caps) | prompt → expected. The user's own answer is **not** in the row (decided later, so all rows have the same height); it is on the opened card. Narrow screens (below `md`): 2 columns without style and arrow. Columns: status | style (a pencil / list icon with a 1 s tooltip label) | word type · form (of the answer side; once, not on both sides) | `[flag] [word]` → `[flag] [word]`. Status text is "Correct / Almost / Wrong". The mockup grid had a bug (6 columns for 7 items, so the user's answer fell into a 44 px column); dropping the answer from the row removes that problem. The word-type abbreviation column was dropped: the full word type is on each side.
- **`FormLabel`** (word type + form): a component with two modes, `abbreviated` (default: "n. sg. nom.", "v. fut. 3rd p. pl.") and `full` ("Noun · Singular · Nominative"). Each short piece has its own tooltip with the full word after 1 s (`TooltipTrigger delay=1000`); screen readers get the full words. The switch between modes is not placed yet: the mode is a prop. Pieces come from `caseParts()` in `lib/cases.ts` (full + abbreviation); word-type abbreviations reuse `review:table.posAbbr.*`; the case abbreviations are new keys `practice:cases.abbr.*` (4 languages, EE not reviewed).
- **Retry:** the per-row Retry button is gone (a row is one button). A failed save shows "Not saved" in the row; retry stays on the banner ("Retry all") and on the opened card.
- **Settings used:** bordered disclosure like Advanced, closed at first; 200 px label column. Exercise count shows what was made ("4 (of 6 asked)" — the old summary showed the number asked). Levels read "Level 2 — description". Native language reads "Include — …" with the language. Irrelevant settings stay hidden; the pre-selected word list stays.
- **Actions:** "Practice again" (primary, restart icon), "Change settings" (outline), "Go to Review table" (ghost link). If "Practice again" finds nothing, the shared `NoMatchNotice` shows on the results screen, with "Adjust settings" (goes to the set-up). `NoMatchNotice` is now shared with the set-up screen.
- **Opened card:** "Back to results" is at the right of the nav, primary; Previous and Next are hidden.
- Locale keys (4 languages, EE not reviewed): `results.{title,scoreCount,correctAnswers,almostHint,statusPartial,backToSetup,settings,amountShort,toReview}`. Removed: `results.{score,almost,showSettings,hideSettings,yourAnswer}`.
- Not checked in a browser yet.

**Slice 5 detail.** The native-language option shows only when `nativeLanguage` is set. PoS options narrowed
to the pre-selected words' PoS. Adjective/Adverb are selectable but show a note that they have no exercises
yet (commandment 7: status must be legible).

**Slice 9 e2e** (`phase-5-practice.spec.ts`): seed a user with nouns and verbs via API; open `/practice`;
set parameters; run a full TI session (one correct, one partial, one wrong) and an MC session; reload
mid-session → same card; results show the right score; Master one translation; start a new session → the
last-4 indicator shows the saved attempts; Review → select words → Practice → only those words appear; a
second user cannot save performance for the first user's private word (API-level assertion).

**Slice 9 — as built (2026-09-30).**
- `e2e/tests/phase-5-practice.spec.ts` (5 tests, serial, one account with six English/German nouns) and the shared helpers in
  `e2e/fixtures/practice.ts` (also used by the Phase 5.5 spec).
- What the spec covers: (1) a typed session of 3 — right, "almost" (capitals only), wrong — with a reload on card 2 that keeps the same card, then
  the results (`2 of 3`, the almost note); (2) sessions of 6, repeated (at most 5 times) until an earlier form comes back: every card is checked
  against the history — a known form is not "New", shows "Last practiced" and exactly the stored last attempts (Right/Wrong counts, last 4);
  a form never asked is "New"; **Mastered** on one translation sets the pill, and it shows again when that form returns; (3) a multiple-choice session
  (right option, then wrong option: marked right and wrong); (4) Review → select Apple and Banana → Practice → "Practice with 2 selected words" →
  every prompt is one of the 4 words; (5) API: a second account gets `404` for `POST /exercises/answers` on the first account's translation, and an
  empty exercise list when it generates from the first account's word id.
- **Design fact the spec depends on** (worth knowing): a word gives one exercise per session for each language pair, and the direction is random
  (`generateExercisesForWord` shuffles the languages). With 3 words, `amount: 6` gives "3 of 6 exercises could be created". So the spec reads the
  prompt from the screen and looks the answer up; it never assumes which card or direction comes, and it seeds six words.
- Gate results: backend 25 suites / 517 tests, frontend 113 files / 1286 tests, `npm run build -w frontend` green, both greps of B.6 = 0,
  e2e: the 5 practice tests pass. The full e2e run was 37 passed / 8 failed; the 8 are `oauth-2` … `oauth-5` (Google sign-in through the stub) —
  see the note in `.context/roadmap.md` (5 row).

## B.5 Files

**New:** `backend/services/exercises/{catalogue,knowledge,generate,select,distractors}.ts`,
`backend/src/db/migrations/0007_*.sql`, `backend/tests/unit/exercises*.test.js`,
`backend/scripts/bench-exercises.ts`, `frontend/src/features/practice/**`, `frontend/src/lib/cases.ts`,
`frontend/src/test/msw/practiceHandlers.ts`, `e2e/tests/phase-5-practice.spec.ts`, `e2e/fixtures/practice.ts`.

**Modified:** `backend/controllers/exerciseController.ts`, `exercisePerformanceController.ts` (rewritten
thin), `backend/routes/exerciseRoutes.js`, `backend/src/db/schema.ts`, `wordController.ts` (updateWord),
`tagController.ts` (cloneTagForUser), `userController.ts` (updateUser), `backend/tests/exercises.test.js`,
`frontend/src/app/router.tsx` (practice route + `validateSearch`), `frontend/src/app/query-client.ts`
(invalidation doc), `frontend/src/stores/uiStore.ts`, `features/words/review/BulkActionBar.tsx` +
`pages/ReviewPage.tsx`, `features/account/{ProfileForm,schemas}.ts(x)`,
`features/words/form-engine/configs/verbs.ts` (export `pronounLabel`),
`frontend/public/locales/*/practice.json` (+ `account.json` for the new field).

**Deleted:** `backend/utils/equivalentTranslations/**` (moved to `catalogue.ts`).

**Docs:** the old snapshot files `exercise-flow` and `05-practice` got a "superseded by .context/features/practice.md" note (both are now removed);
`.context/roadmap.md` §9 progress; `.context/README.md` spec index points to Part A of this file.

## B.6 Verification

```bash
npm test -w backend                       # every slice; unit + Jest integration
npm test -w frontend && npm run build -w frontend
npx tsx backend/scripts/bench-exercises.ts   # Slice 3: record the timing
npm run test:e2e                          # Slice 9 (also --workers=1)
```

Manual (Playwright MCP, both themes, desktop + phone width): a full session per card type and language
mode; reload mid-session; save failure (stop the backend) → unsaved + retry; Master/Revise toggle.

**Gate:** backend + frontend suites green; build green; e2e green incl. `phase-5-practice.spec.ts`;
`grep -rnw "_id" backend/controllers/exercise*` = 0; `grep -rn "getUserExercises\|saveTranslationPerformance"
frontend/src backend/routes` = 0.
