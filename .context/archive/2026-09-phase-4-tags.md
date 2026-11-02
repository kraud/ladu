# Phase 4: tags (plan, 2026-09-27)

**Status:** done 2026-09-28 (slices 0 to 9). PR #53 (`tags`, `dd9b1ad`). Final state: backend 291, frontend 960, e2e 35 (the known `oauth-*` specs not run in the build sandbox). The live spec is `.context/features/tags.md`.

**Decisions kept:** D1 to D20 (the spec keeps all of them): `/tags` is the permanent home; scope chips; Public and Private only; `tagIds` on word create; a small resource API instead of the 15 legacy routes; clone provenance columns; unique label per author; OR tag filter; one `TagCombobox`; staged tags in the word editor.

**Plan versus built:**
- `GET /api/words/simple?tag=` was extended so a Public tag's words can be previewed before following (a bug found in slice 6).
- `WordPickerDialog` kept both checkbox and row click with no flag (D18).
- Tags in the word editor were first applied at once, then staged until Save.
- `TagPickerDialog` got an optional `wordIds` (create flow).

**Traps:** a partial-ownership call to the link endpoints is 403 as a whole; the unique label index needs a data step for existing duplicates; do not make the tag filter AND.

**Slice order (for old citations):** 0 plan, 1 backend word-side fixes and migration `0006`, 2 tag API, 3 clone rebuild, 4 data layer, 5 `/tags`, 6 `/tag/$tagId`, 7 Review integration, 8 word editor sidebar, 9 gate.

**Old text:** `git log -- .context/plans/phase-4-tags.md`
