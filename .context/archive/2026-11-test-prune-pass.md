# Test prune pass (plan, 2026-11-02)

**Status:** done 2026-11-02 on branch `testing-consolidation`. Slices 0, 2, 3, 4 and the close were run. Slices 1, 5 and 6 were not run (user decision at the gate; now deferred idea I-12). Tests and docs only: the one other change is the admin dev dependency `@vitest/coverage-v8`.

**Result:** 5,598 tests before, 5,545 after (53 removed, 1%). Run time 566 s before, about 537 s after (-5%): e2e 173 s to 144 s, the others unchanged. e2e 196 to 147 tests: 4 whole tests that repeat backend rules, 8 tests of the test tooling, 37 autocomplete tests. Line coverage did not change (frontend 95.24%, backend 93.26%, admin 96.36%). The numbers and the list of cells without a whole-chain e2e test are in `research/2026-11-test-inventory.md`.

**PRs and commits:** `a0c05b1` (policy and inventory), `1e70ffb` (plan), `7a762b2` (Slices 0, 2, 3), `19257df` (Slice 4 with the restored cells). The close is in the commit after these.

**Decisions kept:**
- Q1: line coverage before and after is the guard for frontend and backend. It does **not** measure e2e.
- Q2: admin follows the same rules as the frontend.
- Q3, Q4: only Slice 0 was committed. At the gate the user chose Slices 2, 3 and 4.
- Review after Slice 4: the user chose to restore six whole-chain e2e tests (option C). The rule is now in `guides/testing-policy.md` §3 and §7.
- The policy and its lessons live in `guides/testing-policy.md`; deferred ideas I-11 (faster backend tests), I-12, I-13 (contract test) and I-14 (slow frontend tests) hold the open work.

**Plan versus built:**
- The plan had 7 slices. Four ran. The data showed little gain in Slices 1, 5 and 6.
- The first inventory counted `it(` calls (3,854). The runners count 5,598. One data file made 1,193 backend tests in 0.6 s.
- Slice 2 needed no new backend test: every rule already had an owner.
- Slice 4 first kept 15 of 58 autocomplete tests, then 21 after the review.

**Known traps:**
- Three of my statements were wrong until checked: "one seam test for each language and part of speech", the use of the coverage diff as a guard for e2e, and "99 fewer tests" (53 is right). Check numbers and what a guard measures before you report them.
- A test title can mislead: `phase-2-noun-crud` "GET /api/words/:id … refused" is a browser flow.
- Two frontend tests near the 5 s limit fail by timeout under coverage load (I-14). Run the guard with `--testTimeout=30000`.
- The repo does not ignore `coverage/`: write reports outside the repo.
- `tsc --noEmit --noUnusedLocals` in `e2e/` still reports `SIGNED_NAME` in `language-french-forms.spec.ts` (not from this pass).

**Old text:** `git log -- .context/plans/test-prune-pass.md`
