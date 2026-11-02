# Conjunctions and prepositions (plan, 2026-10-24)

**Status:** done 2026-10-25 (slices 0 to 4), merged as PR #109. Rollout (reload of the reference data on staging and production) done 2026-10-25, safety copy deleted the same day. Review items closed 2026-11-02. The live spec is `.context/features/conjunctions-prepositions.md`; the checklist it produced is `.context/guides/add-part-of-speech.md`.

**Decisions kept:** Q1 to Q11 and the review log (13 findings) are in the spec, with the closing of findings 5, 7 and 8 on 2026-11-02 (the case list stays; "peale" keeps one case for both positions; adessive and ablative are not added).

**Plan versus built:**
- Slice 0 wrote the process guide `add-part-of-speech.md`; one exported `PROPERTY_PREFIXES` replaced two drifting lists (findings 1 to 3).
- The conjunction type radio became optional (Q2 changed to Q5), and the preposition position radio optional (Q6).
- Slice 3 was split in three: Estonian through Ekilex (3a), DE/EN/ES lexicon (3b), translations and "Start from a word" (3c).
- Form engine additions: `optionsLayout` on radios and multi-selects, `layout.fitRow`.

**Traps:** see the spec, section 5.

**Removed with this record:** the review sheet `conjunctions-prepositions-strings` (a generated table of the ES, DE and EE strings; the locale files are the truth).

**Deferred idea:** modal verbs (`research/deferred-ideas.md` I-1).

**Old text:** `git log -- .context/plans/conjunctions-prepositions.md`
