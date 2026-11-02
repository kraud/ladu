# Autocomplete slice G: "One term → whole Word" (plan, 2026-10-11)

**Status:** done 2026-10-11 (steps G1 to G6), polished the same day and on 2026-10-23. Shipped with `autocomplete-improvements` and later branches. The contract lives in `.context/plans/autocomplete-data-source-strategy.md`, section "Slice G".

**Decisions kept:** G-a to G-j (entry section, the type-ahead chooses the sense, preview before cards, `Any` part of speech, senses from the translation table, one draft route, no save in the draft, one-language drafts allowed, account languages only, no English hub line).

**Plan versus built:**
- The first plan showed one row with a checkbox per language. The built preview uses one collapsed card per language with radio words and "No translation".
- The language select now remembers the last choice, and each suggestion lists the covered languages (2026-10-23). The plan said nothing is remembered.
- The preview has its own title and back arrow, so the page header is passed into `StartFromWord`.
- The draft answer seeds the lookup cache, so the card footer agrees with the draft ("die See", not "der See").
- Affixes inside inputs (German "am", "habe") were reworked in the same days (`FieldRenderer`).

**Traps:**
- The route order matters: `translate/:fromLanguage` before `/:language/:partOfSpeech`, and `translate/sense/...` above `/:language/:partOfSpeech/:query`.
- A plain B-tree index cannot serve `LIKE 'co%'` under the `en_US` collation: use `text_pattern_ops`.
- The "Estonian gap" e2e test fails when a dev backend runs on `:5001`.

**Old text:** `git log -- .context/plans/autocomplete-slice-g-one-term-to-word.md`
