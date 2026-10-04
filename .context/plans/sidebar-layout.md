# Sidebar layout (shared side panel)

Started 2026-10-04. One reusable layout for the side panel on Review, Add word / Word page and Practice, so the three behave the same.

## Decisions (taken with the user)

- Desktop: the panel is **docked to the left edge of the window**, from under `AppHeader` to the bottom (or to a fixed footer bar). It collapses to an icon rail.
- Phone (≤920px): the panel is not on the page. A trigger button opens it as a slide-in menu (`Sheet`, from the left).
- Two widths: `narrow` (16rem) and `wide` (24rem). Rail: 3.5rem.
- Review: the "Filters" button is the **phone trigger only**. On desktop the panel has its own collapse arrow. The top filter bar and the position toggle are removed.
- Practice (phone): settings live in the slide-in; a visible "New session" button above the tabs opens it.
- `/word/:id` uses the same sidebar as Add word, including the "Linked words" placeholder.

## Pieces

| Piece | File |
|---|---|
| Layout, `SidebarTrigger`, `useSidebar` | `frontend/src/components/layout/sidebar/SidebarLayout.tsx` |
| Centered column for states without a sidebar | `frontend/src/components/layout/PageColumn.tsx` |
| Route flag `staticData.sidebar` | `frontend/src/app/router.tsx`, `routes/protected-layout.tsx`, `AppShell.tsx` |
| Collapse state `uiStore.sidebarCollapsed[id]` | `frontend/src/stores/uiStore.ts` |
| Header height variable `--app-header-h` | `frontend/src/styles/globals.css` |

A page gives `SidebarLayout` a list of `sections` (`id`, `label`, `icon`, optional `filledIcon` / `filled` / `count` / `focusSelector`, `content`). Optional: `drawerTop` (phone only), `footer` (fixed bar, full width), `header` (page title, first in the content column), `wide` (content column `max-w-7xl`).

A state of a sidebar route that has no sidebar (loading skeleton, the part-of-speech gate) wraps itself in `PageColumn`.

## Slices

1. **Done 2026-10-04 — layout + Add word + Word page.** `WordEditorLayout` is a thin wrapper; `SidebarFields.tsx` is now the hook `useWordSidebarSections` (Clue, Tags, Linked words). `WordEditorBar` is the content of the layout's `footer`. Unit tests green (1321); e2e `phase-1-auth`, `phase-2-noun-crud`, `phase-3-review`, `phase-4-tags` green when run one spec at a time (three specs in parallel gave two false failures: login and registration errors, not related to the layout).
2. **Done 2026-10-04 — Review.** `FilterBar.tsx` is now the hook `useFilterSections` (Gender, Part of speech, Tags, Language order; each group has its own rail counter). `ReviewPage` renders `SidebarLayout id="review"`; on a phone the display switches join the menu as a last section and the toolbar gets the "Filters" button (`SidebarTrigger`, with the active-filter count). Removed: the top filter bar, the top/sidebar toggle, `MobileFilters`, `uiStore.reviewSidebarCollapsed` / `reviewFilterPosition`, the old `.filterbar` / `.fb-header` / `.layout` CSS and 7 unused `review:filters.*` keys. Unit tests green (1304); e2e `phase-2`, `phase-3-review`, `phase-4-tags`, `phase-5-practice`, `phase-5-5-saved-practice` green, one spec at a time.
3. Practice (+ `components/ui/tabs.tsx`) — not started.

## Notes

- A trigger that uses `buttonVariants` directly must wrap it in `cn(...)`: `Button` does, and without it `border-transparent` beats `border-border` and the button has no border.
- The "Linked words" section is a placeholder for a future feature (links between synonyms and related words). It stores nothing.
