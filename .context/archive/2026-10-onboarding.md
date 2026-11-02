# First-login onboarding (plan, 2026-10-16)

**Status:** done 2026-10-17 (slices 0 to 4e) and refreshed 2026-10-19 (the 583-concept pool). Merged as PR #94 (`onboarding-process`). The live spec is `.context/features/onboarding.md`; the pool decisions are in `.context/research/onboarding-word-pool.md`.

**Decisions kept:** D1 to D28 of the plan, all in the spec with their IDs. D15 changed on 2026-10-19 (at least 4 topics, no maximum). Code cites D18, D20, D21, D23 and D26.

**Plan versus built:**
- Slice 4d was redesigned twice (4d+ and 4d++) after the first review: a full-screen flow with a progress line, and a dismissible result card on the dashboard.
- The admin on/off switch (D26, migration `0031`) was added at slice 4a so a rollout needs no deploy.
- The second-opinion file `onboarding-blueprint-proposal.md` was reviewed against the data and the code; the findings are in the old review log.
- `first-review.md` (the first pool review, 2026-10-16) was kept until the merge and deleted on 2026-11-02.

**Traps:** the e2e spec is a `-gate` spec (global state); 150 words in 4 languages pass the Postgres parameter limit (insert in chunks of 5,000 rows); the Estonian locale folder is `ee`; re-run `onboarding-forms.ts` after every `pool.tsv` edit.

**Old text:** `git log -- .context/plans/onboarding.md`
