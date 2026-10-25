# Plan: Gradable radio for EN, ES and EE adverbs

Status: plan agreed on 2026-10-24. No slice started.

Goal: the adverb form has the same "Gradable / Non-gradable" radio in all four languages. Today only German has it. The user sees at once that an adverb with no degrees is complete, not unfinished.

## How to start (read this first in a new session)

1. Read `CLAUDE.md` and `.context/README.md`. Follow the working rules: one small slice at a time, a plain-language overview **before** any file change, ask before assuming, docs and tests with the code. The user runs `git commit` themselves. Suggest a commit message after each slice.
2. Do the slices in order. After each slice: run its checks, tick the **Progress** list with the date, and suggest a commit message.
3. Before slice 1, read `frontend/src/features/words/form-engine/configs/adverbs.ts` and its test, `FieldRenderer.tsx`, and `review/completion.ts`.

## Progress

- [x] Slice 1 — Form engine: new case names, labels, radio in EN, ES and EE configs (2026-10-24)
- [ ] Slice 2 — Autocomplete: fill the radio where the lexicon data is reliable
- [x] Slice 3 — Onboarding pool and demo template: add the radio value (2026-10-24; open: the user reviews the 10 pool entries)
- [ ] Slice 4 — Docs, e2e spec, review of ES/DE/EE strings

## Context

What the code does now (checked 2026-10-24):

- `configs/adverbs.ts` German: a required radio `gradable` (case `gradableDE`). When the user picks "Non-gradable", the comparative and superlative fields are hidden.
- EN and ES: three optional fields (adverb, comparative, superlative). No radio.
- EE: the same three fields in a degree row, plus the checkbox `periphrasticSuperlative`. No radio.
- The backend does not list adverb case names. It treats every case that starts with `gradable` as a property, not a written form (`wordController.ts:421`, `:1079`; `services/exercises/catalogue.ts:124`). So new `gradableEN/ES/EE` cases need no backend change. Slice 1 must confirm this with a test.

Decisions from the user (2026-10-24):

- **Q1.** The radio is **required** in all four languages. Reason: an adverb can have only one case (no comparative, no superlative).
- **Q2.** Existing words stay as they are. Nobody migrates them. The user can change them later. Where the autocomplete, the onboarding pool or the demo template hold adverb data, that data gets the new value.
- **Q3.** This plan file tracks the work, in case the scope grows.
- **Q4.** EN and ES get a checkbox like the Estonian one, for adverbs that form the degree with a word ("more", "most", "más"). When the checkbox is on, the derived field shows the prefix and the base word, read-only, and is not typed by the user.
- **Q5.** The radio is also needed for adverbs with no degrees in any language. Example: DE "damals" = EE "seejärel". Both are "Non-gradable". The radio is already in the plan for all four languages.
- **Q6.** The autocomplete removes the prefix ("more", "most", "más", "am", "kõige") from the data it receives, fills the fields without the prefix, sets the checkbox, and so the locked fields show the right text.

Known effect of Q2: when the user opens an old EN, ES or EE adverb to edit it, the radio is empty and required. The user must pick a value to save. The completion ring (`review/completion.ts`) also counts the radio, so the ring of an old adverb drops until the user picks a value. German already behaves this way. Tell the user in the slice 1 overview.

## Prefix analysis (done 2026-10-24, no code change)

German shows a fixed "am" before the superlative field. The question: do other fields need a fixed prefix?

A fixed prefix is correct only when **every** valid value starts with that word. Result:

| Language | Field | Typical values | Fixed prefix? |
|---|---|---|---|
| DE | superlative | am schnellsten, am liebsten, am häufigsten | **Yes: "am"**. Already built (D25). |
| EN | comparative | faster, sooner, **more** usually | No. Short words use "-er". "more" is for long words and "-ly" words. |
| EN | superlative | fastest, soonest, **most** usually | No. Same reason. |
| ES | comparative | **más** pronto, mejor, peor | No. "mejor", "peor" have no "más". |
| ES | superlative | prontísimo, **lo más** pronto | No. The "-ísimo" form has no prefix. |
| EE | comparative | kiiremini, paremini | No prefix. It uses a suffix. |
| EE | superlative | **kõige** kiiremini | Already handled by the "periphrastic superlative" checkbox (D20, D27). The field shows "kõige " + the comparative and stores only the checkbox. |

Conclusion (changed on 2026-10-24, decision Q4): a fixed prefix field does not fit EN and ES, because some values have the prefix and some do not. The correct design is the Estonian one: a **checkbox** says "this adverb uses the prefix". When it is on, the field is derived and locked. When it is off, the user types the full form ("faster", "mejor").

| Language | Checkbox | What it derives (locked in the form, saved with the word) | Typed when the checkbox is off |
|---|---|---|---|
| DE | none. "am" stays a fixed adornment (D25). | - | comparative, superlative (without "am") |
| EN | `periphrasticEN` ("more / most") | comparative = "more " + adverb; superlative = "most " + adverb | comparative, superlative |
| ES | `periphrasticComparativeES` ("más") | comparative = "más " + adverb | comparative; superlative is always typed ("prontísimo") |
| EE | `periphrasticSuperlativeEE` (exists) | superlative = "kõige " + comparative | comparative, superlative |

The decisions are in **Decisions on the checkboxes** below. The mixed case is rare but real: an EN adverb with "more X" but a one-word superlative. One checkbox cannot show it. Then the autocomplete leaves the checkbox off and fills both fields as typed text.

## Decisions on the checkboxes (user, 2026-10-24)

- **Q7. EN has one checkbox** ("Uses more / most"). It derives the comparative and the superlative. A mixed shape is typed as text with the box off.
- **Q8. ES: the checkbox derives the comparative only** ("más" + adverb). The superlative is always typed.
- **Q9. The form stores both:** the full derived text ("more usually") **and** the checkbox value. The derived field is locked in the form, but its text is saved. Reason: the checkbox is a property of the word. A later feature uses it to filter words and select them as practice targets (for example, "all adverbs that use more/most"). That feature is **not** part of this plan.

Effect of Q9 on the Estonian form: today the Estonian derived superlative ("kõige X") is **not** stored (D20, D27). To follow Q9, the Estonian form must store it too. See the review log, #5. Old Estonian words stay as they are (Q2).

## Slice 1 — Form engine

**Files:** `frontend/src/ts/enums.ts`, `configs/adverbs.ts`, `configs/adverbs.test.ts`, the four `public/locales/*/wordRelated.json` files, and the tests that pin the adverb field lists (`TranslationCard.test.tsx`, `completion.test.ts`, `buildYupSchema.test.ts`).

- Add `gradableEN`, `gradableES`, `gradableEE` to `AdverbCases`.
- Add the label key `wordForm.adverb.fields.gradable{EN,ES,EE}` in all four locales. Copy the text of `gradableDE` (EN "Gradable", ES "Graduable", DE "Steigerbar", EE "Astestatav").
- In `adverbs.ts`: build the radio field with one helper that takes the language. Use it for all four languages. Add the error message keys `gradableRequired` for EN, ES and EE (`wordForm.adverb.errors.form{EN,ES,EE}`).
- The comparative and superlative fields are hidden when the user picks "Non-gradable" (the existing `hiddenWhenNonGradable`). For EE, hide the periphrastic checkbox in the same way.
- Add the checkbox for EN (`periphrasticEN`, label "Uses more / most") and for ES (`periphrasticComparativeES`, label "Uses más"). Reuse the Estonian `derivedWhen` rule in `configs/types.ts` (`when`, `prefix`, `fromField`). Today it does not save the derived value. Add a `store: true` option (or change the rule), so the locked field is saved together with the checkbox (Q9). Check `buildYupSchema.ts` and the save payload. The EN rule takes its text from the `adverb` field, not from the comparative. This needs a check that the rule can name a source field other than the sibling comparative.
- The checkbox shows only when the radio is "Gradable". When the checkbox is on, the derived field is locked.
- Keep the German "am" adornment and the EE "kõige" rule as they are.

**Backend in this slice:** the metadata filters ignore only `periphrasticSuperlative%` (`wordController.ts:423`, `:1081`). Widen them to `periphrastic%`, so the new checkboxes are not read as written forms in search. Add `periphrastic` to `PROPERTY_PREFIXES` in `services/exercises/catalogue.ts:124` (see the review log, #3).

**Tests:** the field list per language; the degree fields show and hide live; the missing radio blocks the save; a "Non-gradable" adverb with only the base word saves. One backend test: a word with `adverbEN` + `gradableEN` is saved and read back, and the exercise catalogue treats `gradableEN` as a property.

## Slice 2 — Autocomplete

**Files:** `backend/lib/lexicon/selectors/{en,es}.ts`, the Estonian adverb lookup (Ekilex, `ingest-et.ts` side), `backend/tests/unit/lexiconSelectors*.test.js`, `backend/tests/dictionary.test.js`, `e2e/tests/autocomplete-g-adjectives-adverbs.spec.ts`.

German before this change: a comparative in the lexicon gave "Gradable"; no comparative gave "Non-gradable" (D24).

For the other languages, a missing comparative does **not** prove "Non-gradable". The lexicon has degree forms for about 53% of EN adverbs, 1.5% of ES adverbs, and EE has none (`autocomplete-coverage-report.md`).

Proposed rule (recommended): if the lexicon returns a comparative or a superlative, set "Gradable". If it returns none, leave the radio empty and let the user choose. **Changed by the user on 2026-10-24: German follows the same rule.** No language fills "Non-gradable" automatically.

Prefix rule (decision Q6). For each language, the autocomplete:
- EN: when a regex finds the comparative `^more\s+<adverb>$` and the superlative `^most\s+<adverb>$` (case-insensitive), it sends no comparative and no superlative, and sets `periphrasticEN = true`. The lexicon already finds these forms in `degreeEN` (`selectors/en.ts`, function `usesMore`). The selector must stop returning the phrase and return the flag.
- ES: when the comparative is "más " + the adverb, it sends no comparative and sets `periphrasticComparativeES = true`. "mejor" and "peor" stay as typed text. The superlative is sent as it is.
- DE: it strips "am " from the superlative (already done, D25). It no longer sets "Non-gradable".
- EE: it already sends `periphrasticSuperlativeEE` (`services/dictionary/eki.ts`).
- A mixed or unknown shape (for example "more X" with a one-word superlative): the checkbox stays off and the fields hold the typed text.

**Decision needed from the user before slice 2:** confirm this rule, or choose "no autocomplete value for EN, ES and EE".

## Slice 3 — Onboarding pool and demo template

**Files:** `backend/scripts/lexicon/onboarding-forms.ts` (it builds `pool-forms.json`), `backend/scripts/onboarding/pool-forms.json` (10 adverb entries), `backend/scripts/demo-template/data.json` (2 adverb words), their tests (`onboardingPool`).

- Onboarding pool rule: "Gradable" if the language entry has a comparative or a superlative; if not, "Non-gradable". The pool is a short, curated list, so a person can check the result. Example: `soon` EN (sooner) = Gradable; `sometimes` EN (no degrees) = Non-gradable.
- Do not edit `pool-forms.json` by hand. Change the script and rebuild (needs the dev database with the lexicon and the Ekilex key).
- Demo template: add the value by hand to the 2 adverbs. Then reseed the demo template per environment, as the demo rollout needs anyway (see the demo rollout memory).

**Done 2026-10-24.** `adverbPoolCases` (`lib/onboardingPool.ts`) adds the radio and also builds the phrase of the periphrastic boxes again ("more usually"), because the lookup sends the box without the phrase and Q9 says a saved word holds both. The demo template got the same values; German "schnell" and Spanish "rápidamente" were set by hand (the lexicon has no degree row for them, but both are gradable).

**Ask the user** to review the 10 pool entries after the rebuild. Known doubtful: ES "usualmente", DE "gewöhnlich" and EE "varsti" come out Non-gradable because the sources list no degree form.

## Slice 4 — Docs, e2e and string review

- Update `.context/.frontend/snapshot/forms-adjectives-adverbs.md` and `data-model.md` (the new case names), and the notes in `phase-3-forms-autocomplete-review.md` that say German is the only gradable adverb.
- Add an e2e spec step: pick "Non-gradable" in EN, ES and EE, and check that the degree fields disappear. `npm run test:e2e` must be green.
- The user reviews the new ES, DE and EE strings (the error messages for the required radio).

## Before or at the merge of the branch to main (the branch gets more features after this plan)

Reminders from slices 2 and 3. Do not forget them. Remind the user when the branch is ready to merge.

- [x] **Rebuild and load the lexicon** in staging and production for English, Spanish and German. The selectors run at ingest time, so the new adverb values (radio, "more/most", "más") reach the autocomplete only after the rebuild. Local dev was done on 2026-10-24. Done on 2026-10-25 with Ansible, together with the conjunction and preposition reload (runbook in `conjunctions-prepositions.md`). Use `ingest.ts <lang>` and `load.js` (VPS: `docker exec backend-<env> node scripts/lexicon/load.js /tmp/<file>`).
- [x] **Reseed the demo template** per environment, so the 2 demo adverbs get their new values. The demo rollout needs this anyway. Done 2026-10-25 with `--reset` in staging and production (14 words, 5 tags in both).

## Verification

- Frontend: the unit tests of the form engine and the typecheck.
- Backend: `npm test` for the lexicon selectors, `dictionary`, and `onboardingPool`. Use `require('./request')` in tests, not supertest directly.
- e2e: `npm run test:e2e`. Before it, check that no backend runs on :5001 and that no access gate is closed in the local DB (see the e2e stub memory).

## Review log

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | Moderate | Old EN, ES and EE adverbs have no radio value. A required radio blocks the next save and lowers the completion ring. | Accepted by the user (Q2). Tell the user in the slice 1 overview. |
| 3 | Moderate (fixed in slice 1, with unit test `exercisesCatalogue.test.js`) | The exercise code does not know the metadata cases `periphrastic*`. `isPropertyCase` (`catalogue.ts:124`) lists `gender`, `gradable`, `regularity`, `auxVerb`, `caseType`, `prefix`. So `periphrasticSuperlativeEE` ("true"/"false") may be used as a written form in distractors (`distractors.ts:17`). | Fix in slice 1 for the old and the new case names. Add a regression test. Not yet confirmed with a running exercise. |
| 4 | Moderate | A derived form that is not stored ("kõige X") is not visible to practice, search, or the word table. | Resolved by Q9: the derived text is stored, together with the checkbox. |
| 5 | Moderate | Estonian does not store the derived superlative today. Q9 asks for stored text and a stored checkbox in every language. | Confirmed by the user and done in slice 1 (`store: true` on the Estonian rule). Old Estonian words stay as they are (Q2). |
| 2 | Moderate | A missing comparative in the lexicon does not prove "Non-gradable" for EN, ES and EE. | Slice 2 proposes "Gradable only when a degree form exists". The user confirms before slice 2. |
