# Frontend re-implementation study: refactor in place or rebuild (study, 2026-09-04 to 2026-09-08)

**Status:** closed. The verdict was **rebuild**; the build plan executed it. Evaluation only; no code changed.

**What it decided:**
- About 70 to 75% of the old frontend should not survive (Redux and service plumbing, 8,700 lines of copy-paste forms, about 100 of 148 effects that only watch status).
- The rewrite is the cheapest moment to fix the domain models, in a copied backend with no users to migrate.
- Deficiency catalog (§8): notifications keep polling and become visibility-aware (§8.1); friendships and tag sharing are redesigned (§8.2, §8.3); frontend and backend hygiene lists (§8.4, §8.5). §9 lists the flows that must be re-encoded on purpose.

**Where the content lives now:**
- §8.1 to §8.3 and the flows for friend requests, tag share and notification polling: `.context/roadmap.md`, section "Design for the deferred social phases".
- §8.4 and §8.5 became standing rules: `.context/README.md` (frontend invariants, backend copy rules, the `id`-only rule) and `features/auth-and-shell.md`.
- The cost model and the kill-switch (§11b) were used after Phase 1: `features/auth-and-shell.md` has the result (continue).

**Traps:** the study points to two migration-plan files (`migration-plan` and `production-migration-plan`) that do not exist in this repo (dead links since the migration). Its claims about the old app were checked on 2026-09-04 and are not updated.

**Old text:** `git log -- .context/.frontend/frontend-reimplementation-study.md`
