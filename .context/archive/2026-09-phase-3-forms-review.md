# Phase 3: form engine completion, autocomplete, Review table (plan, 2026-09-12)

**Status:** done 2026-09-15 (slices 0 to 11 and eight rounds of review fixes). PR #3 (`form-engine-completion-and-review-table`, `c181e7e`). Final state: backend 165, frontend 540, e2e 10. The live spec is `.context/features/word-form-engine.md`.

**Decisions kept:** D1 to D44 of the plan. The spec keeps the ones that still constrain the code, each with its status (D4, D6 to D17, D24 and D42, D25 to D29, D32, D36, D39 to D41, D44). Code cites D28 (closed by `features/words-list.md`) and D36 (German verb field order).

**Plan versus built:**
- The filter bar above the table (D5) became the shared sidebar (`design/04-layout.md`).
- No sorting at first (D11); `?sort=&dir=` came later.
- The language control was first two-container drag and drop, then a flat row with an eye button (D13, D19, D20).
- The eight autocomplete endpoints were replaced by one dictionary route (`.context/research/autocomplete-data-source-strategy.md`).
- The 444 verb label keys became about 56 composed keys (D7).

**Traps:** the `pg` `Pool` in `e2e/fixtures/db.ts` is per worker (keep it lazy); the Estonian endpoints of the old app could hang; the registry lacks DE and EE `regularity` rows and has no Adjective or Adverb key.

**Open then:** about 86 Estonian keys flagged for review.

**Old text:** `git log -- .context/plans/phase-3-forms-autocomplete-review.md`
