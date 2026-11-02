# Shared sidebar layout (plan, 2026-10-04)

**Status:** done 2026-10-04 (layout and word pages, Review, Practice), with follow-ups to 2026-10-11. Merged as PR #68 (`sidebar-layout`). The live rules are in `.context/design/04-layout.md`, section "Sidebar layout".

**Decisions kept (all now in `design/04-layout.md`):**
- Desktop: docked left panel that collapses to a 3.5rem rail; phone: slide-in `Sheet`. Widths `narrow` 16rem and `wide` 24rem.
- Review: the "Filters" button is the phone trigger only. Practice (phone): settings in the slide-in, with a visible "New session" button.
- The column is centred in the window, not in the space beside the panel (2026-10-11).
- Review and Practice start collapsed; only `practiceResults` starts open.

**Plan versus built:**
- Practice was reworked on 2026-10-04 and 2026-10-05: tabs (Ongoing sessions, Saved configurations), "New configuration" as a view with a back arrow, a words/tags pre-selection sidebar, and `tag_ids` on a saved configuration (migration `0018`; see `features/saved-practice.md` S-10).
- The Start and Save buttons moved into the layout's fixed footer through a portal (`actionsHost`).
- `FilterBar.tsx` became the hook `useFilterSections`. The top filter bar, the position toggle and `MobileFilters` were removed.

**Traps:**
- A section's content unmounts when the phone menu closes (no `keepMounted` any more).
- Three Playwright specs run in parallel can give false login failures. The `oauth-2` to `oauth-5` specs stalled at the Google stub on unchanged code.
- The Review page still overflows on a phone when rows are selected (the bulk bar).

**Old text:** `git log -- .context/plans/sidebar-layout.md`
