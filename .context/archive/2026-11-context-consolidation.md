# Consolidation of the `.context/` documents (plan, 2026-10-29 to 2026-11-02)

**Status:** done 2026-11-02 on branch `docs-consolidation` (tasks 0 to 7, with 3b, 3c, 5b and 5c). Docs only: no code, config or test change. The one exception (C1) was path text inside code comments, plus a few strings (the admin `package.json` description, two Jest test titles, two build-script error messages). The rules that remain are in `.context/README.md` ("Folders of `.context/`") and `.context/features/README.md`.

**Result:** 84 files and 22,973 lines before. 92 files and 11,818 lines after. 11,255 lines are live; 563 lines are in the archive (28 records and the README). Live specs: 19 in `features/` plus 6 in `features/word-forms/`, 9 in `research/` plus 3 in `backlog/social-old-app/`, the guides, 8 in `design/`, 3 at the root, 2 plans in flight.

**Decisions kept:**
- C1: edit comments only. C4: finished work is folded into `features/` first, then archived.
- C13, C15: long evidence reports go whole into `research/`. Later the user split out `backlog/` (ideas, review sheets that wait for an outside reviewer, the old social reference; I-1 to I-9).
- C16: every document in `features/` starts with `## Summary`.
- C3, C11: the infrastructure guide and `deployment-strategy.md` live in `guides/infrastructure-guide/`.
- C8: `MOCKUPS/` and `word-lists/` stay git-ignored and local. `MOCKUPS/DESIGN-HANDOFF.md` has a banner (local only).
- C20: the build plan became `.context/roadmap.md`.
- Task 7 (user choice, 2026-11-02): the hidden `.context/.frontend/` folder was dissolved. `frontend-structure.md` went to `guides/` (its 4 stale points fixed), the 6 word-form files to `features/word-forms/` (each with a `## Summary`), the 3 social files to `backlog/social-old-app/`. The old word-flow inventory and the old global UI blueprint were removed: they described old React and Redux code, and their rules are in the code, the specs and the roadmap annex.
- `plans/` holds only unfinished work. Decision IDs that code comments cite (D36, G-f, Q9, §A.8, §B.3, §C.3) were kept in the specs.

**Plan versus built:**
- The spec planned 7 slices. It needed 3b, 3c, 5b and 5c because the user closed the open items of the built plans.
- The folder map, the features rule and the roadmap rename were not in the first brief.
- A `.pyc` file was removed from git and `__pycache__/` and `*.pyc` went into `.gitignore`.
- Memory notes were updated to the new paths.

**Traps:**
- A bulk path replacement also rewrote the `git log -- <old path>` line in the records. Check that each record points to the old path.
- Three statements were wrong until checked in code: the friendship and tag-share backend (schema and routes exist), the repo licence (already MIT), and the ES, DE and EE review of the adverb strings (still open).

**Open after this work:** the V10 fix (`plans/french-pronominal-type-ahead.md`); `backend/vercel.json` (unused leftover, own PR); a separate PR so `errorMiddleware.js` stops sending `err.message` on 500 answers; the French teacher review; the ES, DE and EE adverb strings; the lawyer check of the Terms (I-3).

**Old text:** `git log -- .context/plans/context-consolidation.md .context/plans/context-consolidation-slices.md .context/.frontend/`
