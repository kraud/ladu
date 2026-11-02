# Phase 5: practice, exercises and performance (plan, 2026-09-29)

**Status:** done and gated 2026-09-30 (slices 0 to 9). Final state: backend 517 tests (25 suites), frontend 1,286 tests, `e2e/tests/phase-5-practice.spec.ts` 5 of 5. The live spec is `.context/features/practice.md`; the slice notes are in `.context/research/practice-build-record.md`.

**Decisions kept (IDs are in the spec, Part B):**
- D1 catalogue: parity only, no new exercise types. D2 knowledge math: keep exactly (the /4 window, the double aging). D2b selection: rank the full pool in SQL, not a random sample of 50.
- D3 reload restores the session in this tab (sessionStorage). D4 statistics wait for a later phase. D5 stale data is deleted for all users (migration `0007`). D6 an optional native-language select on the profile. D7 a clone copies the cloner's own history.
- C1 to C10: evaluation stays on the client; the three old routes were removed for a new `/api/exercises/*` contract; amount is 1 to 100; Review's Practice action works for 1 or more words; parameters live in the URL; Master or Revise only after an answer; multi-language multiple choice keeps 3 options.

**Plan versus built:**
- The saved configurations and saved sessions of Phase 5.5 were not in the plan (`features/saved-practice.md`).
- The old UI blueprint said 4 options for multiple choice; parity is 3 (C8).
- Part C (the design brief for the design tool) was kept in the spec as the functional requirements of the process.

**Traps:** the ranking SQL must agree with the JS math (a unit test compares both); migration `0007` deletes orphans and duplicates (counts are logged); the session says "N of M exercises could be created" and never drops cards silently.

**Not built (idea I-8, `backlog/deferred-ideas.md`):** a bigger catalogue, mastery statistics, a knowledge badge, practise-wrong-answers-again, finish early, the clue as a hint, answer time.

**Old text:** `git log -- .context/plans/phase-5-practice.md`
