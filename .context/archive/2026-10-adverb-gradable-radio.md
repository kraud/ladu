# Gradable radio for EN, ES and EE adverbs (plan, 2026-10-24)

**Status:** done 2026-10-24 (slices 1 to 4). The rollout (lexicon reload and the demo reseed on staging and production) was done 2026-10-25. The user checked the form in the app on 2026-11-02. The live spec is `.context/features/adverb-gradability.md`.

**Decisions kept:** Q1 to Q9 (the required radio; old words not migrated; one checkbox for EN, one for ES, the Estonian one kept; both the derived text and the checkbox are stored). Code cites Q9 and the strategy decisions D20, D25 and D27.

**Plan versus built:**
- The first idea was a fixed prefix on the field (as German "am"). The prefix analysis showed it does not fit EN or ES, so the Estonian checkbox design was used instead (Q4, changed the same day).
- The Estonian derived superlative is now stored (review-log item 5), which changes the old Estonian behaviour for new words only.
- The status line of the plan said "No slice started" while slices 1 and 3 were done, and the Progress boxes of slices 2 and 4 were never ticked; the code and the e2e specs existed.

**Traps:** the exercise code needs `periphrastic` in `PROPERTY_PREFIXES`; `pool-forms.json` is built by a script, not by hand.

**Old text:** `git log -- .context/plans/adverb-gradable-radio.md`
