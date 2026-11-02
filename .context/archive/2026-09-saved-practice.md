# Phase 5.5: saved practice configurations and sessions (plan, 2026-09-30)

**Status:** done 2026-09-30 (slices 1 to 5), extended 2026-10-04 and 2026-10-11. Branch merged before PR #62. The live spec is `.context/features/saved-practice.md` (S-1 to S-11).

**Decisions kept:**
- S-1 to S-9 are D1 to D9 of the plan: server storage, 10 sessions, 7 days, full snapshot, summary list, resume keeps the row, unique case-insensitive names, expiry on read, no foreign key on `word_ids`, last save wins.
- S-10: `tag_ids` on a configuration (migration `0018`, 2026-10-04).
- S-11: "Change settings first" opens the set-up as that configuration, with Update and Save as copy (2026-10-11).

**Plan versus built:**
- Added `GET /api/practice/configs/:id/words`. The set-up screen needs labels and flags, and a long id list does not fit in a URL.
- Edit first changed name and description only. S-11 replaced that with the revise mode.
- The server validates only the parts it depends on in a snapshot, and runs `create` and `update` behind an advisory lock so parallel saves cannot pass the limit of 10.
- Leave dialog: the third button is "Keep practicing", and the old `leaveDialog.confirm` key was removed.
- 2026-10-14: a saved list swaps a followed original for the user's copy (see `features/words-list.md`, W-12).

**Traps:**
- The "Session saved" toast covers the next click for 5 seconds. The e2e session test is `test.slow()`.
- `visibleWordCondition` is exported from `exerciseService.ts`, so `missingCount` and practice use one rule.

**Gate:** backend 517 tests, frontend 1,286 tests, 5 e2e tests pass. The full e2e run had the known `oauth-*` failures.

**Old text:** `git log -- .context/plans/phase-5-5-saved-practice.md`
