# Add French to Ladu (plan, 2026-10-25)

**Status:** done 2026-10-26 (slices 0 to 12), merged as PR #110 (`new-language-french`), rolled out on staging and production from 2026-10-27. The live spec is `.context/features/french.md`. The reusable checklist is `.context/guides/add-language.md`.

**Decisions kept:** L1 to L5 (a full language, learnable and interface; forms first, then autocomplete; consolidate the language lists first; onboarding pool and demo late; working mode) and M1 (merge the machine-made French as a first draft, review later). The review-log findings M2, M3, S3, F1 to F5, m1, V1 to V10, A1 to A10, S6, S7, O1 to O5 are in the spec, section 2.

**Plan versus built:**
- Slice 1 reduced the hand-copied language lists (`backend/lib/languages.ts`, `LANG_SUFFIX`), so later languages need fewer edits.
- Slice 3 found a hard limit of 4 translations per word (S3-1); one `MAX_TRANSLATIONS` replaced it.
- Verbs have a group (1er, 2e, 3e) instead of the regular/irregular radio (m1).
- A side task gave e2e its own ports and database (not part of the French plan).
- The coverage research (slice 8) went to `research/french-lexicon-coverage.md`; V10 became its own plan.

**Traps:** see the spec, section 3 (searching for the old four languages in files the branch did not change; the French verb table rule; digits in a radio value; the e2e demo template).

**Not folded (operational, done):** the rollout runbook of 2026-10-26 (load the lexicon and the translations per environment, check, reseed the demo template, delete the safety copy). The generic steps are in `guides/add-language.md` section 6 and the infrastructure guide, file 02.

**Old text:** `git log -- .context/plans/language-french.md`
