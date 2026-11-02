# Context Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every file in `.context/` read as current truth, with finished work archived and the history one `git log` away.

**Architecture:** Seven tasks, one per slice of the spec. Each task folds durable content into a live spec, writes a short archive record, removes the old file with `git rm`, repairs links, and ends with a link check. The user commits after each task. The "tests" of this plan are the link check and the counts.

**Tech Stack:** Markdown, `git mv` / `git rm`, a scratch Node script for the link check (outside the repo).

**Spec:** `.context/plans/context-consolidation.md` (decisions C1 to C9). Read it first.

## Progress (updated 2026-11-02)

| Task | What | State |
|---|---|---|
| 0 | Branch, link-check script, baseline | done |
| 1 | Pure moves (infrastructure guide, archive template, README rows) | done |
| 2 | Small finished plans folded into `features/` | done |
| 3 | Phase records, the study, OAuth, the deployment strategy | done |
| 3b | Research documents (`research/`) | done |
| 3c | Feature summaries and the features rule | done |
| 4 | Snapshot split and `frontend-structure.md` | done |
| 5 | Noise removal in the plans in flight | done |
| 5b | Fold the built plans; deferred ideas; memory | done |
| 5c | Fold `phase-5-practice.md`; close the adverb plan | done |
| 6 | README, `CLAUDE.md`, rename, `.pyc`, counts, close-out | pending |

## Global Constraints

- Docs only. Edit code files only for path text inside comments (C1). Files: `frontend/src/features/metrics/api.ts`, `frontend/src/features/metrics/components/WelcomeBanner.tsx`, `frontend/src/features/words/form-engine/TypeAheadInput.tsx`, `frontend/src/features/words/form-engine/configs/verbs.ts`, `e2e/tests/language-french-interface.spec.ts`, `backend/scripts/onboarding/README.md`, root `README.md`. Do not edit the ~45 comments that cite `MOCKUPS/` (C8).
- Archive record: path `.context/archive/YYYY-MM-<topic>.md`, 30 lines or fewer. Fields: status; PRs and commits; decisions kept (ID + the constraint it imposes); plan-vs-built deltas; known traps; the line `git log -- <old path>`. `YYYY-MM` is the month of the plan's last feature commit (read from `git log`).
- Fold checklist, in this order: invariants; schema and API contracts; numbered decisions (ID, rationale, rejected alternative); known defects; open items with the stopping point. Drop `Progress`, `Resume here`, satisfied checklists, "what was built" text. A resolved review log becomes `issue → severity → resolution → PR`.
- Write all new text under STE100: short sentences, active voice, one idea per sentence.
- Fold before you remove. Never remove a file that has an open item without the user's yes.
- The user runs `git commit` and creates branches. You use `git mv` and `git rm`, and you draft the commit message. Trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Never pipe the link check or `npm run build` through `head` or `tail` when you test pass or fail. It hides the exit code.
- Each task starts with a plain-language overview to the user, before any file changes (CLAUDE.md rule).

## Review Focus

Failure modes the spec implies and no slice would catch alone. The owning task has the check.

1. A plan is archived while it still has an open item (rollout step, "Next", `verify` flag). The item is lost. → Task 2 step 1, Task 3 step 1.
2. A folded decision loses its rationale or its rejected alternative, so a later agent re-opens it. → Task 2 step 3 (read-back check).
3. Links break in places that are not `.md`: `.github/`, `deploy/`, `.claude/`, `.mcp.json`, `e2e/`, `landing/`, `.gitignore`d dirs. → Task 0 (the script scans every text file) and Task 1 step 3.
4. The infra guide moves and its own relative links (`../`, `./0x-*.md`) or Ansible and CI paths break. → Task 1 step 3.
5. A removed snapshot file is cited by line number in code or in a kept spec (e.g. `snapshot/ui/02-dashboard.md:39`). → Task 4 step 5.

---

---

### Task 0: Branch, link-check script, baseline

> **Done 2026-11-01. Scratch link check outside the repo; baseline 84 files, 22,973 lines.**

**Files:**
- Create (outside the repo): `/private/tmp/claude-503/-Users-kraud-Documents-Repositories-Laduus-keelapp-v2/3bacfa8a-b5ac-49f4-8392-4423b848d0a0/scratchpad/linkcheck.mjs`, `baseline-counts.txt`, `baseline-broken.txt`

**Interfaces:**
- Produces: `node linkcheck.mjs` → exit 0 and no output when no new broken link exists compared to `baseline-broken.txt`; exit 1 and one `file:line: path` per new broken link. `node linkcheck.mjs --counts` prints file and line totals.

- [x] **Step 1: Ask the user to create and switch to branch `context-consolidation`** (they create branches). Wait for the answer.
- [x] **Step 2: Write `linkcheck.mjs`.** Scan every text file in the repo except `node_modules`, `dist`, `.git`, `.marketing`. Extract tokens with the regex `(?:\.context|\.dev-context|MOCKUPS|word-lists)/[\w./@-]+\.(?:md|html|tsv|json)` and bare names in backticks `` `[\w-]+\.md` `` that match a file name used in `.context/`. Resolve each token from the repo root, then from the citing file's folder. Skip lines that contain `git log --`. Skip `MOCKUPS/` tokens in `*.ts`, `*.tsx`, `*.js`, `*.css` (C8). Also report decision-ID references of the form `see <file> <ID>` only when the named file does not exist.
- [x] **Step 3: Run it on the clean branch and save the result.** Run: `node linkcheck.mjs --save-baseline`. It writes `baseline-broken.txt` (links already broken today) and `baseline-counts.txt` (files and lines of `.context/`, `.dev-context/`). Expected: counts match the spec's facts (73 + 11 files; 19,579 + 3,394 lines) within the changes since 2026-10-29.
- [x] **Step 4: Run it again.** Run: `node linkcheck.mjs`. Expected: exit 0, no output.
- [x] **Step 5: Report the baseline to the user** (number of already-broken links and the counts). No commit: nothing in the repo changed.

---

### Task 1: Slice 1, pure moves

> **Done 2026-11-01 (spec C3). The README gained 7 rows; the guide moved to `guides/`.**

**Files:**
- Move: `.dev-context/infrastructure-guide/` → `.context/guides/infrastructure-guide/` (`git mv`, 8 files)
- Create: `.context/archive/README.md` (template, ≤15 lines), `.context/features/` (created by the first spec in Task 2)
- Modify: `.context/README.md` (table rows only), `CLAUDE.md` and `.dev-context/deployment-strategy.md` (links to the guide), the guide files (their own relative links), root `README.md` and any file the link check names

**Interfaces:**
- Produces: the archive record template that Tasks 2 to 6 copy; README table rows for `design/`, the 7 unlisted plans, and the new guide path.

- [x] **Step 1: Overview to the user** (what `git mv` does, why the guide is a "guide" and not a plan, what the README table is).
- [x] **Step 2: Move the guide.** Run: `git mv .dev-context/infrastructure-guide .context/guides/infrastructure-guide`.
- [x] **Step 3: Repair every link to the old path.** Run: `grep -rn "infrastructure-guide" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist` and fix each hit, including `.github/`, `deploy/` and the guide's own `../` links. Then run `node linkcheck.mjs`. Expected: exit 0.
- [x] **Step 4: Write `.context/archive/README.md`:** the 30-line rule, the six record fields, the file-name rule, one sentence "to read a removed plan, run `git log -- <path>`".
- [x] **Step 5: Update the README table.** Add rows for: `design/` as Tier A (already a row: make sure the tier text says so), `guides/infrastructure-guide/`, and the 7 plans the table did not name (`access-requests`, `adverb-gradable-radio`, `autocomplete-coverage-report`, `captcha`, `conjunctions-prepositions-strings`, `landing-terms-licences-blog`, `manual-production-release`; the five phase plans already fall under the `phase-*.md` row) with the status words from their own header. Add the two files `snapshot/forms-french.md`, `snapshot/forms-conjunctions-prepositions.md` as "live v2 spec".
- [x] **Step 6: Classify the unchecked files** (`.dev-context/oauth-backlog-plan.md`, `oauth-login-strategy.md`, `backend/scripts/onboarding/first-review.md`, `backend/scripts/lexicon/.data/*.md`): for each, read the header and write one line in the spec's "Out of scope" bullet: keep, archive, or ask. Ask the user about any "ask".
- [x] **Step 7: Link check.** Run: `node linkcheck.mjs`. Expected: exit 0.
- [x] **Step 8: Draft the commit message** (`Move the infrastructure guide into guides/ and complete the README spec table`) and give it to the user.

---

### Task 2: Slice 2, small finished plans

> **Done 2026-11-01 (spec C12). Four plans were left out after reading them.**

> **Result (2026-11-01):** see decision C12 in the spec. The table below is the first version; the plans listed in C12 as "not archived" were left out after reading them.

**Files:**
- Create: `.context/features/admin.md`, `features/words-list.md`, `features/saved-practice.md`; `features/access-control.md` only if its sources are done; archive records listed below
- Modify: `.context/design/04-layout.md` (sidebar decisions), `.context/plans/autocomplete-data-source-strategy.md` (slice G decisions G-a to G-j), `.context/.frontend/snapshot/forms-conjunctions-prepositions.md`, `.context/README.md`
- Remove (`git rm`): the plans below after their record exists

**Interfaces:**
- Consumes: the record template from Task 1.
- Produces: the archive file names that Task 3 and Task 6 link to.

| Source plan | Fold into | Record name |
|---|---|---|
| `admin-user-emails`, `verified-badges` (+ `admin-dashboard` if verified done) | `features/admin.md` | `2026-10-admin-user-emails`, `2026-10-verified-badges` |
| `words-clone-followed`, `words-followed-selection`, `words-pagination` | `features/words-list.md` | `2026-10-words-clone-followed`, `2026-10-words-followed-selection`, `2026-10-words-pagination` |
| `phase-5-5-saved-practice` | `features/saved-practice.md` | `2026-09-saved-practice` |
| `sidebar-layout` | `design/04-layout.md` | `2026-10-sidebar-layout` |
| `autocomplete-slice-g-one-term-to-word` | `autocomplete-data-source-strategy.md` | `2026-10-autocomplete-slice-g` |
| `conjunctions-prepositions` + `conjunctions-prepositions-strings` | `snapshot/forms-conjunctions-prepositions.md` | `2026-10-conjunctions-prepositions` |
| `autocomplete-coverage-report` | nothing (keep the go/no-go answer in the record) | `2026-10-autocomplete-coverage` |
| `onboarding-words-questionnaire`, `-resolutions`, `-audit` | nothing; first check `onboarding.md` holds the decisions | `2026-10-onboarding-word-pool` (one record for three files) |
| `access-gates`, `access-requests` | `features/access-control.md` | only if verified done |

- [x] **Step 1: Verify status of every row, with facts.** For each plan run `git log --oneline -- <path>`, `git branch --list '<name>*'` and `git log main --oneline --grep=<name>`. Read the plan's open items. Build a table: plan, merged yes or no, open items. **Show it to the user.** Move a plan with an open item out of this task, unless the user says to archive it. (Review Focus 1.)
- [x] **Step 2: Overview to the user** (what `features/` is, what a record holds).
- [x] **Step 3: Fold one plan at a time.** Write or extend the target spec with the fold checklist. Read the plan again and tick off each numbered decision: it must appear in the target with its rationale and rejected alternative (Review Focus 2). Run: `grep -c "<decision ID>" <target>` for each ID. Expected: at least 1.
- [x] **Step 4: Write the record** from the template. Check: `wc -l .context/archive/<name>.md` shows 30 or fewer.
- [x] **Step 5: `git rm` the plan.** Repair the links the link check names. Edit comment paths in `WelcomeBanner.tsx`, `TypeAheadInput.tsx` and `verbs.ts` if their target moved.
- [x] **Step 6: Update the README table** (remove the rows, add `features/*` rows with the spec words "Authoritative for <area>").
- [x] **Step 7: Check that code changed only in comments.** Run: `git diff -U0 -- frontend backend e2e | grep -E '^[+-][^+-]' | grep -vE '^[+-]\s*(//|\*|/\*)'`. Expected: no output (grep exit 1).
- [x] **Step 8: Link check.** Run: `node linkcheck.mjs`. Expected: exit 0. Draft the commit message and give it to the user.

---

### Task 3: Slice 3, phase records and the study

> **Done 2026-11-02 (spec C10, C11, C14). Five new specs; the study, OAuth and the deployment strategy handled.**

**Files:**
- Create: `.context/archive/2026-09-phase-1-auth-app-shell.md`, `-phase-2-noun-crud`, `-phase-3-forms-review`, `-phase-3-5-dashboard`, `-phase-3-9-dark-mode`, `-phase-4-tags`, `2026-09-frontend-reimplementation-study.md` (month from `git log`, may be `2026-10` for phase 4)
- Modify: `.context/plans/new-repo-build-plan.md` (§2, §3, §5 phases, §8.2, §8.3, §9), `.context/README.md`, `frontend/src/features/metrics/components/WelcomeBanner.tsx` and others the link check names
- Remove: the 6 phase plans and `.frontend/frontend-reimplementation-study.md`

**Interfaces:**
- Consumes: the record template.
- Produces: build plan §9 as a table `phase | status | record`; build plan sections for friendships (§8.2) and tag sharing (§8.3) designs.

- [x] **Step 1: Verify each phase file has no open item** (`Resume here`, `Next`, unchecked box). Show the list to the user. (Review Focus 1.)
- [x] **Step 2: Overview to the user.**
- [x] **Step 3: Fold the study's §8.2 and §8.3 into `new-repo-build-plan.md` first.** The friendships and tag-sharing designs must stay readable in the live plan. Check: `grep -n "tag_shares\|requesterId" .context/plans/new-repo-build-plan.md` returns the design lines.
- [x] **Step 4: Fold each phase** (contracts, decisions, known defects) into the build plan phase entry or the spec it constrains (`features/`, `design/`, `guides/`). Keep the decision IDs.
- [x] **Step 5: Replace §2 and §3** (snapshot strategy and corpus) with one paragraph and a `git log` pointer. Replace §9 "Progress" with the table `phase | status | record`. Keep the phase-gate references and point each to its record.
- [x] **Step 6a: OAuth docs (decision C10).** `git mv .dev-context/oauth-login-strategy.md .context/features/oauth-login-strategy.md`. Remove its status lines and satisfied phase checklists. Keep every section heading that code cites (list them with `grep -rhoE "oauth-login-strategy\.md[^)\`]{0,40}" frontend backend e2e deploy`). Edit the path in the 10 files that write the `.dev-context/` prefix in a comment: `backend/src/db/schema.ts`, `deploy/env/app.env.example`, `e2e/fixtures/oidc-stub/server.ts`, `e2e/tests/deployed-smoke.spec.ts`, `e2e/tests/oauth-0` to `oauth-5` specs. Recount with `grep -rn "\.dev-context/oauth-" . --exclude-dir=node_modules`. Fold the lesson of `oauth-backlog-plan.md` (the stub flakiness came from missing Google credentials in CI; the real-Google redirect check runs in the staging smoke) into `guides/infrastructure-guide/05-troubleshooting-playbook.md` if it is not there yet. Write the record `2026-09-oauth-backlog`, then `git rm` the backlog plan.
- [x] **Step 6b: Deployment strategy (decision C11).** `git mv .dev-context/deployment-strategy.md .context/guides/infrastructure-guide/deployment-strategy.md`. The status line was already updated on 2026-11-01 (phases 0, A, B, C, D, E done, E-c verified by the user). Check that it still reads right after the move. Update `infrastructure-guide/README.md` where it says the file "stays as-is" in `.dev-context/`. Edit the path in every file that writes `.dev-context/deployment-strategy.md`. Find them with `grep -rln "\.dev-context/deployment-strategy" . --exclude-dir=node_modules --exclude-dir=.git`: expected 17 files (19 mentions) besides the two consolidation documents (guide `03` and `README`, `admin-dashboard`, `manual-production-release`, `new-repo-build-plan`, `CLAUDE.md`, `.dockerignore`, `.github/workflows/deploy.yml`, `backend/controllers/userController.ts`, `backend/scripts/migrate.js`, `backend/tsconfig.json`, `deploy/caddy/Caddyfile`, `deploy/compose/platform.yml`, `deploy/env/app.env.example`, `deploy/scripts/deploy.sh`, `e2e/playwright.deploy.config.ts`, `e2e/tests/deployed-smoke.spec.ts`). For each non-`.md` file, check that the changed line is a comment (`#`, `//`, `*`) before you save. Bare-name citations stay valid because the name does not change. Then check that `.dev-context/` is empty: `ls .dev-context` (expected: no such directory).
- [x] **Step 6: Write 7 records, `git rm` 7 files, repair links.** Check each record: `wc -l` 30 or fewer.
- [x] **Step 7: Link check and comment-only check** (same commands as Task 2 steps 7 and 8). Expected: no output, exit 0. Draft the commit message.

---

### Task 3b: Research documents (done 2026-11-02, spec C13 and C15)

> **Done.** Created `research/` for long evidence kept whole. Moved `licence-study.md` and the autocomplete coverage report there, and merged the three onboarding word-pool files into `research/onboarding-word-pool.md` (981 to 247 lines). Edited path text only in 10 files, including two build-script error messages.

### Task 3c: Feature summaries and the features rule (done 2026-11-02, spec C16)

> **Done.** Every document in `features/` starts with `## Summary`. The rule for new feature documents is `features/README.md`.

### Task 4: Slice 4, snapshot split and `frontend-structure.md`

> **Done 2026-11-02 (spec C17). 12 snapshot files removed; the deltas annex is in the build plan.**

**Files:**
- Modify: `.context/plans/new-repo-build-plan.md` (Phase 8 annex), `.context/README.md` (rows and stop dates), `.context/.frontend/frontend-structure.md`, `frontend/src/features/metrics/api.ts` (comment), `.context/.frontend/snapshot/endpoints.md` (only if the check in step 4 says so)
- Remove: `snapshot/ui/01-auth`, `02-dashboard`, `03-word-editor`, `04-review`, `05-practice`, `snapshot/pages-auth-shell`, `pages-review-practice`, `exercise-flow`, `review-table`, `general-use-functions`, `word-cases-data`, `autocomplete`

**Interfaces:**
- Produces: the Phase 8 annex "intentional deltas" list; README rows with stop dates for `ui/00-global`, `ui/06-social`, `pages-social-account`, `endpoints` (social part), `forms-nouns`, `forms-verbs`.

- [x] **Step 1: Overview to the user.**
- [x] **Step 2: Fold the intentional deltas.** Copy the lists from `ui/00-global.md` §8, `ui/04-review.md` "Intentional deltas (vs old)" and `ui/05-practice.md` "Intentional deltas" into the Phase 8 section of the build plan, one table: `delta | old behaviour | new behaviour | source`. Check: the row count equals the sum of the three source lists.
- [x] **Step 3: Check the "copies of code" files.** For `word-cases-data.md`: confirm each of its entries exists in `frontend/src/ts/wordCasesDataByPoS.ts` (compare counts). For `autocomplete.md`: find where the Estonian transforms are documented now (`grep -rn "sanitiz" frontend/src backend/services .context/plans/autocomplete-data-source-strategy.md`). If a detail has no other home, write it into that home first. Report to the user.
- [x] **Step 4: Compare `endpoints.md` with `backend/routes`.** List the routes in the file that no route file defines. If the non-social part matches, cut the file to the social part; else keep it whole. Tell the user the result.
- [x] **Step 5: Find citations of the files you will remove.** Run: `grep -rnE "snapshot/(ui/0[1-5]|pages-auth-shell|pages-review-practice|exercise-flow|review-table|general-use-functions|word-cases-data|autocomplete)" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist`. Fix each hit, including `metrics/api.ts:10` (comment: point to the backend route). (Review Focus 5.)
- [x] **Step 6: `git rm` the 12 files. Update README rows and add the stop dates.**
- [x] **Step 7: Trim `frontend-structure.md`.** Keep §0 (D1 to D5), §1, §5. Replace §2 (the tree) with a rule ("the tree in `frontend/src` is the truth; each feature has `api.ts`, `components/`, `hooks.ts`, `pages/` as in §4") and a pointer. Mark §3 historical or drop it. Fix its first lines (they name `snapshot/ui/00–06` and "nothing scaffolded yet"). Check: re-run the file-name check; expected: no missing names outside §3.
- [x] **Step 8: Link check and comment-only check. Draft the commit message.**

---

### Task 5: Slice 5, plans in flight

> **Done 2026-11-02 (spec C18). About 140 lines of noise removed from five plans.**

**Files:**
- Modify (noise only): each plan in `plans/` that has `Progress`, `Resume here` or a satisfied checklist. Find them with: `grep -lE "^#+ .*(Resume here|Progress)|Resume here" .context/plans/*.md`

- [x] **Step 1: Overview to the user.** List the files found by the grep (8 earlier).
- [x] **Step 2: For each file, show the user the sections you will remove** (a short list: heading and line range). Ask once for all files.
- [x] **Step 3: Remove only the listed sections.** Keep the status line at the top, the open items and the stopping point. A satisfied slice checklist is removed; an open one stays.
- [x] **Step 4: Check that no open item is lost.** For each file compare `grep -c "\[ \]"` before and after. Expected: equal (open boxes stay).
- [x] **Step 5: Link check. Draft the commit message.**

---

### Task 5b: Fold the plans that are built (done 2026-11-02, spec C19)

> **Done.** The user closed every open item of the built plans (reviews, rollouts, checks). Folded into `features/`: onboarding, captcha, demo, landing-and-legal, french, conjunctions-prepositions, autocomplete (the strategy moved whole to `research/`), and the request-access flow into `access-control.md`. Created `research/deferred-ideas.md` (7 ideas). Moved the French review sheets and coverage research to `research/`. V10 became its own plan. Deleted `first-review.md`. Updated the memory notes (4 deleted, 3 rewritten). `plans/` now holds only: `adverb-gradable-radio`, `french-pronominal-type-ahead`, `manual-production-release`, the build plan, `phase-5-practice` and the two consolidation documents.

### Task 5c: Fold `phase-5-practice.md` and close the adverb plan (done 2026-11-02, spec C21)

> **Done.** `features/practice.md` keeps Part A, B.1 to B.3, B.7 and Part C with their section numbers (code cites them). The slices (B.4 to B.6) moved whole to `research/practice-build-record.md`. Part D became idea I-8. The adverb plan became `features/adverb-gradability.md` after the user checked the form in the app. `plans/` now holds only: `french-pronominal-type-ahead`, `manual-production-release` and the two consolidation documents.

### Task 6: Slice 6, README, CLAUDE.md, memory, counts, close-out

> **Pending.** Work added since this plan was written (spec C8, C16, C19):
> - Rename the build plan to a name that says what it is (the user asked on 2026-11-02; decision C20 in the spec once the name is chosen), and repoint its citations (about 16 files, `CLAUDE.md` included).
> - Rewrite the README text outside the table, `CLAUDE.md` lines 56 and 57, and add the "Folders of `.context/`" section (step 4b).
> - Decide whether `MOCKUPS/` and `word-lists/` (git-ignored) should be tracked.
> - Update the remaining memory notes that name old paths (the infrastructure guide, the pagination seed account).
> - Final counts, then archive this plan and the spec into one record.

**Files:**
- Modify: `.context/README.md`, `CLAUDE.md`, `MOCKUPS/DESIGN-HANDOFF.md` (banner), the user's memory files in `/Users/kraud/.claude/projects/-Users-kraud-Documents-Repositories-Laduus-keelapp-v2/memory/`
- Move: `.context/plans/context-consolidation.md` and `context-consolidation-slices.md` → one record `.context/archive/2026-11-context-consolidation.md`

- [ ] **Step 1: Overview to the user.**
- [ ] **Step 2: Rewrite the README table** so each live file has one row, grouped: Tier A, features, guides, design, live snapshot (with stop dates), plans in flight. The `MOCKUPS/` row says "historical visual reference; `design/` and the code win".
- [ ] **Step 3: Fix `README.md` text outside the table:** "shadcn/Base UI (not yet initialised)" (check `frontend/src/components/ui` first), the Mongoose copy rules (keep the `id`-only rule), the domain cheat-sheet (add FR, 5 languages), the phased roadmap (add status and the record link), the commit trailer (use the one in the attribution reminder and drop the fixed session URL).
- [ ] **Step 4: Fix `CLAUDE.md`.** Line 56: keep "friendships, notifications, tags sharing are deferred", drop "after Phases 1–3" and "Prior agents". Delete line 57 (Phase 0 baseline commit). Fix any path in CLAUDE.md that Tasks 1 to 5 moved.
- [ ] **Step 4b: Folder map and the `.pyc` file (decision C16).** Add a section "Folders of `.context/`" to `.context/README.md`: a table with the purpose of each folder (`features`, `plans`, `archive`, `research`, `guides`, `design`, `.frontend`), when a file enters and leaves it, and the five questions "where does a new file go?". Point to `features/README.md` for the summary rule. Then run `git rm --cached .context/guides/tools/__pycache__/locale_insert.cpython-314.pyc`, add `__pycache__/` to `.gitignore`, and check `git ls-files .context/guides/tools` shows only `locale_insert.py`.
- [ ] **Step 5: Add the banner to `MOCKUPS/DESIGN-HANDOFF.md`:** two lines, "Historical. `.context/design/` and the code win on a conflict." Task 0 found that `MOCKUPS/` is gitignored, so this edit stays local and no commit carries it. Tell the user, and ask if they want `MOCKUPS/` and `word-lists/` tracked (remove the `.gitignore` lines) or left local.
- [ ] **Step 6: Update memory.** Run: `grep -rln "\.context/plans/\|infrastructure-guide\|snapshot/" <memory dir>`. For each hit, fix the path or the status (archived plans now live in `.context/archive/`). Keep `MEMORY.md` one line per file.
- [ ] **Step 7: Final checks.** Run: `node linkcheck.mjs` (expected exit 0); the comment-only check from Task 2 step 7 (expected no output); `npm run build -w frontend` (expected exit 0); `node linkcheck.mjs --counts`.
- [ ] **Step 8: Report.** Table before and after: files and lines for `.context/` and `.dev-context/`; number of live normative specs (Tier A + `features/` + `guides/` + `design/` + kept snapshot); total live lines (everything outside `archive/`). List what the user still decides: the trim of Part B in `phase-5-practice.md`, `backend/vercel.json`, the VPS safety-copy cleanup reminder, and the separate PR for the error-middleware data leak (memory note `project-error-middleware-leak`; written in `features/admin.md` §6).
- [ ] **Step 9: Archive this plan and the spec** into one record; `git rm` both. Draft the final commit message and the PR description (ending with the `🤖 Generated with [Claude Code]` line).
