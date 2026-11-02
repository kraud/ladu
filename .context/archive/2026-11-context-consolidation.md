# Consolidation of the `.context/` documents (plan, 2026-10-29 to 2026-11-02)

**Status:** done 2026-11-02 on branch `docs-consolidation` (tasks 0 to 6, with 3b, 3c, 5b and 5c). Docs only: no code, config or test change. The one exception (C1) was path text inside code comments, plus a few strings (the admin `package.json` description, two Jest test titles, two build-script error messages). The rules that remain are in `.context/README.md` ("Folders of `.context/`") and `.context/features/README.md`.

**Result:** 84 files and 22,973 lines before. 93 files and 12,119 lines after. 11,584 lines are live; 535 lines are in 28 archive records. Live specs: 19 in `features/`, 9 in `research/` (kept whole), 11 in `guides/`, 8 in `design/`, 12 in `.frontend/`, 3 at the root, 2 plans in flight.

**Decisions kept:**
- C1: edit comments only. C4: finished work is folded into `features/` first, then archived.
- C13, C15: long evidence reports go whole into `research/`. Ideas that are not approved work go into `research/deferred-ideas.md` (I-1 to I-8).
- C16: every document in `features/` starts with `## Summary`.
- C3, C11: the infrastructure guide and `deployment-strategy.md` live in `guides/infrastructure-guide/`.
- C8: `MOCKUPS/` and `word-lists/` stay git-ignored and local. `MOCKUPS/DESIGN-HANDOFF.md` has a banner (local only).
- C20: the build plan became `.context/roadmap.md`.
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

**Old text:** `git log -- .context/plans/context-consolidation.md .context/plans/context-consolidation-slices.md`
