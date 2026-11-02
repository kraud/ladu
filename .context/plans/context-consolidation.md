# Plan: Consolidate the `.context/` documentation

Status: **design approved 2026-11-01. No file is moved yet.** This plan is docs only. No code, config or test logic changes. The only edits outside docs are path text in code comments (see "Code comments").

## Goal

Every file in `.context/` reads as current truth. The history of finished work stays one `git log` away. After this pass, `plans/` holds only unfinished work.

## Decisions taken with the user (2026-11-01)

| # | Decision | Rejected alternative |
|---|---|---|
| C1 | Edit path text in code comments when a file moves. | Leave stale pointers; leave stub files at the old paths. |
| C2 | Review sheets (`language-french-strings.md`, `language-french-review.md`) stay live until review M1 is closed. Then they are archived as ordinary records. `conjunctions-prepositions-strings.md` is archived now (the locale files hold the truth). | Make them spec appendices; archive all now. |
| C3 | `.dev-context/infrastructure-guide/` (8 files) moves to `.context/guides/infrastructure-guide/`. It counts as a live guide. | Leave in place (this was the recommendation); move to `.dev-context/docs/`. |
| C4 | Durable content of finished features goes into new live specs in `.context/features/`. | Fold everything into `overview.md`; keep stripped plans as specs. |
| C5 | Work in seven slices (0 to 6). Each slice ends with a link check. The user commits each slice. | One pass; archive first and fold later. |
| C6 | This plan lives in `.context/plans/` while it is in flight. It is archived at the end. | `docs/superpowers/specs/`. |
| C8 | `MOCKUPS/` stays. About 45 code comments in about 38 files cite it as the design origin, and they stay correct. The README row says "historical visual reference; `design/` and the code win". `MOCKUPS/DESIGN-HANDOFF.md` gets a 2-line banner with the same words (it says "source of truth" and "match the exported pixels", which contradicts `design/README.md`). Not Tier A any more. | Delete the folder (checked: nothing builds from it, but it breaks the comments); delete only the handoff. |
| C9 | Four more fixes, each with one obvious answer: trim `frontend-structure.md` §2 (the tree) to a rule and a pointer; replace build plan §2, §3 and §9 with a paragraph and a status table; fix the two stale lines in `CLAUDE.md`; fix the stale text in `README.md` outside the table. | Leave them. |
| C10 | The two finished OAuth docs go into Task 3. `oauth-backlog-plan.md` becomes an archive record (`2026-09-oauth-backlog`). `oauth-login-strategy.md` is **not** shrunk to 30 lines: about 30 code comments in backend, frontend and e2e cite its section names ("State, not sessions", "provider quirks", "§4 Phase 5"). It moves with `git mv` to `.context/features/oauth-login-strategy.md` (same file name, so bare-name citations stay valid), loses its status noise, and keeps its section names. Only the 10 code and config files that write the `.dev-context/` prefix in a comment need a path edit, plus the link in `new-repo-build-plan.md`. | Archive it as a record (orphans the section citations); rename it to `oauth-login.md` (about 30 comment edits). |
| C11 | `.dev-context/deployment-strategy.md` (497 lines) moves with `git mv` to `.context/guides/infrastructure-guide/deployment-strategy.md`, same file name. Its one open item (E-c, the UptimeRobot alert test) was closed by the user on 2026-11-01. It is still not archived, because 23 files cite it, many by section ("§2 Secrets", "Phase E, E-d", "D-g"). 17 files (19 mentions) that write the `.dev-context/` prefix get a path edit (comments and links only). `.dev-context/` is then empty and disappears. Done in Task 3. | Archive as a 30-line record (orphans the section citations); move to `plans/` (same 17 file edits, twice); leave in place. |
| C12 | Task 2 result (2026-11-01). Folded and archived: `admin-dashboard`, `admin-user-emails`, `verified-badges` (into `features/admin.md`); `words-pagination`, `words-followed-selection`, `words-clone-followed` (`features/words-list.md`); `phase-5-5-saved-practice` (`features/saved-practice.md`); `access-gates` (`features/access-control.md`); `sidebar-layout` (`design/04-layout.md`); `autocomplete-slice-g` (into the strategy). **Not archived, against the first table:** `autocomplete-coverage-report` (live docs use it as a template and quote its figures; a 30-line record would lose the data), `onboarding-words-audit` (the live questionnaire cites it; it goes with the other two onboarding files when onboarding closes), `conjunctions-prepositions-strings` (reverses C2: the string review is still open). Also left live: `access-requests`, `conjunctions-prepositions`, `onboarding-words-questionnaire`, `onboarding-words-resolutions`. | Archive the report and the audit as short records (loses data; breaks a live citation). |
| C13 | Long research reports live in a new folder `.context/research/`, kept whole (not shrunk to a 30-line record). First file: `autocomplete-coverage-report.md`. Decided by the user on 2026-11-02. The same day the user confirmed that the two access-gates review items (privacy wording, ES/DE/EE texts) are done, so `features/access-control.md` has no open item. | Keep it in `plans/`; move it whole into `archive/`. |
| C14 | Task 3 result (2026-11-02). Folded and archived: Phase 1 (`features/auth-and-shell.md`), Phases 2 and 3 (`features/word-form-engine.md`, with the status of each Phase 3 decision; layout and copy decisions D18 to D20, D22, D30, D31, D33 to D35, D37, D38, D43 were dropped on purpose), Phase 3.5 (`features/dashboard.md`), Phase 3.9 (`features/theme-and-language.md`), Phase 4 (`features/tags.md`), the study (its §8.1 to §8.3 went into the build plan, section "Design for the deferred social phases"), `oauth-backlog-plan` (record). Moved whole: `oauth-login-strategy` (`features/`), `deployment-strategy` (`guides/infrastructure-guide/`). Build plan: §2 and §3 shortened, §9 is a status table. `.dev-context/` is gone. The Phase 8 intentional-deltas annex is Task 4. | Records of 30 lines for the phases (loses about 50 decisions that code and docs cite). |
| C15 | Task 3b (2026-11-02, before Task 4). `licence-study.md` moved whole to `research/` (a re-runnable report; two build scripts print its path in an error message string, and `landing/terms.html` has it in an HTML comment: path text only). The three `onboarding-words-*` files became one file, `research/onboarding-word-pool.md` (981 to 247 lines): the analysis tables, the decisions Q1 to Q32 with the question text, the value decisions, senses, and "Applied in code". Dropped: the questionnaire options and appendices A to F (the results are in `pool.tsv`) and the temporary audit. Same day: the ES/DE/EE reviews of the five Task 3 specs were closed by the user, and D3 (header global search) was deferred to a future A/B test. The `.context/` root now holds only `README.md` and `overview.md`. | Move the onboarding files whole (981 lines of options for decisions already applied). |
| C16 | (2026-11-02) Every document in `features/` starts with a `## Summary` of 2 to 4 sentences (what the feature does for the user, who uses it, where it is in the app). The rule, and the other rules for a new feature document, are in `features/README.md`. Task 6 also: adds a folder map (purpose, when a file enters and leaves each folder, where a new file goes) to `.context/README.md`, and untracks the compiled file `guides/tools/__pycache__/locale_insert.cpython-314.pyc` (add `__pycache__/` to `.gitignore`; the script `guides/tools/locale_insert.py` stays). | Put the rule only in `.context/README.md`. |
| C7 | The snapshot files are split by file (see "Snapshot split"). Built-feature files and code copies are removed. Deferred-feature files, live specs and test oracles stay. Removed files stay in `git log`. | Keep all; remove all. |

## Facts verified 2026-10-29 and 2026-11-01

- `.context/` has 73 Markdown files (19,579 lines). `.dev-context/` has 11 files (3,394 lines). Total 84 files, 22,973 lines.
- `plans/` has 32 files (12,841 lines). The first count was 31 files.
- The README table does not name 7 plans (`access-requests`, `adverb-gradable-radio`, `autocomplete-coverage-report`, `captcha`, `conjunctions-prepositions-strings`, `landing-terms-licences-blog`, `manual-production-release`). The five phase plans are covered by its `phase-*.md` row. Corrected in Task 1.
- `.context/design/` (8 files, 846 lines) is in no tier. The README calls it "Authoritative for UI look". It becomes Tier A.
- `snapshot/forms-french.md` and `snapshot/forms-conjunctions-prepositions.md` describe v2 only. They are live specs, not frozen legacy.
- `MOCKUPS/` (40 files on disk with `word-lists/`) and `word-lists/` are in `.gitignore` (lines 42 and 48). No file in them is tracked. `git log` cannot recover them, and a fresh clone or CI does not have them. This includes two Tier A files: `MOCKUPS/DESIGN-HANDOFF.md` and `word-lists/new-onboarding-values.md`. Found in Task 0. Effect: the banner on `DESIGN-HANDOFF.md` is a local edit that no commit carries, and about 45 code comments plus several docs point to files that exist only on this machine.
- Most snapshot files were last changed on 2026-09-06, before Phases 2 to 5 were built. Only 5 code comments point to them. `frontend/src/features/metrics/api.ts:10` already says `snapshot/ui/02-dashboard.md:39` names the wrong path.
- `forms-nouns.md` and `forms-verbs.md` are the oracle for old behaviour in `nouns.test.ts` and `verbs.test.ts`.
- `word-cases-data.md` copies data that the code owns (`ts/wordCasesDataByPoS.ts`, `lib/cases.ts`).
- The "intentional deltas" in `ui/00-global.md` §8, `ui/04-review.md` and `ui/05-practice.md` feed the Phase 8 route-parity annex.
- The friendships (§8.2) and tag-sharing (§8.3) designs exist only in `.frontend/frontend-reimplementation-study.md`. Those work items are deferred. The designs must move into `new-repo-build-plan.md` before the study is archived.

## Layout after the pass

```
.context/
  README.md       table lists every live file and its authority
  overview.md     unchanged
  features/       NEW. One live spec per finished feature area
  plans/          ONLY unfinished work (in flight or planned)
  archive/        NEW. YYYY-MM-<topic>.md, 30 lines or fewer
  guides/         add-language, add-part-of-speech, infrastructure-guide/
  research/       NEW. Long research reports, kept whole (C13)
  design/  .frontend/   unchanged (links repaired)
```

## Archive/live table

### Live, content untouched (links repaired only)

- Tier A: `overview.md`, `plans/new-repo-build-plan.md`, `plans/phase-5-practice.md`, `frontend-structure.md`, `guides/add-language.md`, `guides/add-part-of-speech.md`, `word-lists/new-onboarding-values.md`, `design/*.md` (added to Tier A).
- Snapshot files that stay: see "Snapshot split". Tier B is no longer "frozen, untouched". Each kept snapshot file has a reason and an end date.

### Plans that stay live

| File | Reason |
|---|---|
| `onboarding.md` | Slice 4e is open. |
| `autocomplete-data-source-strategy.md` | Slice I is next. §14 VPS steps are open. It takes the decisions of slice G. |
| `language-french.md`, `language-french-strings.md`, `language-french-review.md` | Review M1 is open. **Verify** the rollout status (rollout was 2026-10-27). |
| `demo-access.md`, `captcha.md` | Rollout is open. |
| `access-gates.md`, `admin-dashboard.md`, `access-requests.md` | **Verify** each against `git log` and merged branches. They may be done. |
| `adverb-gradable-radio.md`, `landing-terms-licences-blog.md` (+ `licence-study.md`), `manual-production-release.md` | Planned, not started. |
| `context-consolidation.md` | This plan. |

### Archive (fold first, then write the record)

| Files | Fold into |
|---|---|
| `phase-1`, `phase-2`, `phase-3-forms-autocomplete-review`, `phase-3-5-dashboard-metrics`, `phase-3-9-dark-mode`, `phase-4-tags` | `new-repo-build-plan.md` and the spec each constrains |
| `admin-user-emails`, `verified-badges` | `features/admin.md` |
| `words-clone-followed`, `words-followed-selection`, `words-pagination` | `features/words-list.md` (**verify** that all slices are done) |
| `phase-5-5-saved-practice` | `features/saved-practice.md` |
| `sidebar-layout` | `design/04-layout.md` |
| `autocomplete-slice-g-one-term-to-word` | `autocomplete-data-source-strategy.md` (decisions G-a to G-j) |
| `conjunctions-prepositions` | `snapshot/forms-conjunctions-prepositions.md` (**verify** status) |
| `conjunctions-prepositions-strings`, `autocomplete-coverage-report`, `onboarding-words-audit`, `onboarding-words-questionnaire`, `onboarding-words-resolutions` | Nothing. Check that `onboarding.md` already holds the decisions. |
| `.frontend/frontend-reimplementation-study.md` | §8.2 and §8.3 go into `new-repo-build-plan.md` first. |

Features that finish later (`onboarding`, `demo`, `captcha`, `autocomplete`, `access-*`) get their `features/` spec when their rollout is done. They are not part of this pass.

## Snapshot split (decision C7)

`.context/.frontend/snapshot/` (16 files) and `snapshot/ui/` (7 files) helped the rebuild stay close to the old app. Most of that job is done. Each file gets one action.

| Group | Files | Action |
|---|---|---|
| Built features | `ui/01-auth`, `ui/02-dashboard`, `ui/03-word-editor`, `ui/04-review`, `ui/05-practice`, `pages-auth-shell`, `pages-review-practice`, `exercise-flow`, `review-table`, `general-use-functions` | **Remove.** First fold the intentional deltas (from `ui/00` §8, `ui/04`, `ui/05`) into the Phase 8 annex section of `new-repo-build-plan.md`. |
| Copies of code | `word-cases-data`, `autocomplete` | **Remove.** First check that the Estonian transforms and the case registry are documented elsewhere (code comments or `autocomplete-data-source-strategy.md`). If a detail is only here, fold it first. |
| Deferred features | `ui/06-social`, `pages-social-account`, the social part of `endpoints.md` | **Keep** until friendships, notifications and tag sharing are built. Then remove. |
| Shell | `ui/00-global.md` | **Keep** until its §8 deltas are in the build plan (same fold as above). Then remove. |
| Still edited | `data-model`, `forms-french`, `forms-adjectives-adverbs`, `forms-conjunctions-prepositions`, `pages-word-flow` | **Keep** as live specs. |
| Test oracles | `forms-nouns`, `forms-verbs` | **Keep** until the Phase 8 cutover. Then remove. |

`endpoints.md` is kept whole for now. Its non-social part is a copy of the backend routes. If a check in slice 4 shows the same content in the backend routes, cut it down to the social part.

Stop dates (record them in the README table): `ui/06-social`, `pages-social-account` and the social part of `endpoints.md` end when the social phases ship. `ui/00-global`, `forms-nouns` and `forms-verbs` end at the Phase 8 cutover.

Result: about 1,500 lines removed now. About 1,700 lines stay.

## Formats

**Fold checklist.** Copy only: invariants; schema and API contracts; numbered decisions (ID, rationale, rejected alternative); known defects; open items with the stopping point. Drop: `Progress`, `Resume here`, satisfied slice checklists, "what was built" text. Reduce a resolved review log to `issue → severity → resolution → PR`.

**Archive record (30 lines or fewer):** status; PRs and commits; decisions kept (ID + the constraint it imposes); plan-vs-built deltas; known traps; the line `git log -- <old path>`. New text follows STE100.

## Slices

| # | Slice | Result |
|---|---|---|
| 0 | Table approved (this file) | Done when the user approves the spec. |
| 1 | Pure moves: infra guide to `guides/`; `design/` into Tier A; the 7 unlisted plans in the README table; create `features/` and `archive/` | Links repaired. Link check passes. |
| 2 | Small finished plans: fold and archive | Link check passes. |
| 3 | Phase 1–4, 3.5, 3.9 records and the study: fold into the build plan and archive. Replace build plan §2 and §3 (snapshot strategy and corpus) with one paragraph and a `git log` pointer. Turn §9 "Progress" into a table: phase, status, archive record. | Phase-gate references in the build plan resolve. |
| 4 | Snapshot split: fold the deltas into the build plan, check the code copies, remove the files in the split table, add stop dates to the README. Trim `frontend-structure.md`: keep §0 (D1–D5), §1 and §5; replace §2 (the directory tree, 25 of 103 named files do not exist) with a rule and a pointer to `frontend/src`; mark §3 historical or drop it. | The build plan Phase 8 annex holds the deltas. `frontend-structure.md` no longer names missing files. Link check passes. |
| 5 | Plans in flight: remove `Progress` and `Resume here` noise only | Files stay live. |
| 6 | Final link check; update README table (including the `MOCKUPS/` row and the banner in `DESIGN-HANDOFF.md`) and CLAUDE.md; fix `README.md` text outside the table (shadcn "not yet initialised", the Mongoose copy rules, the domain cheat-sheet without French, the phase roadmap without status, the old commit trailer); fix `CLAUDE.md` lines 56 and 57 (social features stay deferred, drop the phase numbers; delete the "Phase 0 baseline commit" rule); update the user's memory paths; final counts | Report: live normative specs and total live lines. |

Each slice starts with a plain-language overview. Each slice ends with a suggested commit message. The user commits.

## Code comments

Edit path text only, in: `frontend/src/features/metrics/api.ts` (it names `snapshot/ui/02-dashboard.md`, which slice 4 removes), `frontend/src/features/metrics/components/WelcomeBanner.tsx`, `frontend/src/features/words/form-engine/TypeAheadInput.tsx`, `frontend/src/features/words/form-engine/configs/verbs.ts`, `e2e/tests/language-french-interface.spec.ts`, `backend/scripts/onboarding/README.md`, root `README.md`. Check each edit is a comment and not a string the code uses. Run the frontend type check and the e2e type check after the edits.

## Verification

- A scratch link-check script lives outside the repo. It finds every path to `.context/`, `.dev-context/` and `MOCKUPS/` in `.md` files, code comments and `CLAUDE.md`. It also finds dangling decision IDs ("see D7 of …"). Zero broken links is the gate at the end of each slice.
- Counts: `find` and `wc -l` before and after.
- Final report: number of live normative specs, total live lines.

## Risks

1. Deferred social work (§8.2, §8.3) loses its design if the study is archived first. Fold before archive.
2. Memory notes of the user name old plan paths. Update them in slice 5.
3. A plan marked "verify" may be unfinished. Do not archive it until `git log` and branch state agree.
4. Removing a snapshot file can lose a detail that exists only there. Run the "copies of code" check and fold the deltas before any removal. Many plans and guides link to snapshot files (`data-model`, `pages-word-flow`, `forms-*`, `exercise-flow`): the link check must pass after the removal.

## Out of scope (flag only)

- `backend/vercel.json` is a migration leftover that nothing uses. It is code. Delete it in a separate PR.
- Checked in Task 1 (2026-11-01):
  - `.dev-context/oauth-backlog-plan.md` (179 lines) and `.dev-context/oauth-login-strategy.md` (547 lines): both **done** on 2026-09-24. The user decided to include them in Task 3 (decision C10).
  - `backend/scripts/onboarding/first-review.md` (347 lines): its own text says "delete it before the onboarding feature is merged". It stays while onboarding is in flight. Remove it at the onboarding merge.
  - `backend/scripts/lexicon/.data/*.md`: not tracked by git. Generated measurement output. Not part of the corpus. No action.
- `.dev-context/deployment-strategy.md` (one alert test left) and the two OAuth files stay where they are.
- At the Phase 8 cutover: remove `forms-nouns`, `forms-verbs` and `ui/00-global`. When the social phases ship: remove `ui/06-social`, `pages-social-account` and the social part of `endpoints.md`.
- Part B of `phase-5-practice.md` is a finished implementation plan inside a Tier A file. Ask the user at the end of the pass if it should be trimmed.
