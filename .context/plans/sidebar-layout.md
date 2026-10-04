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
3. **Done 2026-10-04 — Practice.** `PracticePage` set-up renders `SidebarLayout id="practice" width="wide" keepMounted`: one section ("Practice settings", rail badge = words picked from Review) holds `ParametersForm`. The main area has the title, the resume banner and `Tabs` (new `components/ui/tabs.tsx`): Saved configurations (default) | Saved sessions, one visible at a time. On a phone a full-width "New session" button above the tabs opens the menu, and loading a saved configuration opens it too. Stages 2/3 and the "no words" message wrap in `PageColumn`. `SavedConfigurations` / `SavedSessions` lost their card and title (the tab label is the title). `ParametersForm`'s Start / Save row is sticky at the bottom of the panel. Unit tests green (1310); e2e `phase-5-practice` and `phase-5-5-saved-practice` green (the latter opens the sessions tab first).

## Notes

- A sidebar section's content unmounts when the phone menu closes (no `keepMounted` option any more). Keep working state outside the sidebar.
- A layout with `sections={[]}` renders no panel and no trigger (Practice uses this on the tabs that have no words list).
- A lone section with the same name as the layout `label` hides its heading in the phone menu (the menu title already says it).
- Full e2e run 2026-10-04: 55 passed, 8 failed — all 8 are the OAuth specs (`oauth-2` to `oauth-5`) that stall at the Google test stub. `oauth-2` fails the same way on the original code (checked with the changes stashed), so it is not caused by the layout work. Cause not yet found.

- A trigger that uses `buttonVariants` directly must wrap it in `cn(...)`: `Button` does, and without it `border-transparent` beats `border-border` and the button has no border.
- The "Linked words" section is a placeholder for a future feature (links between synonyms and related words). It stores nothing.

## Practice rework (2026-10-04, in progress)

The user asked to swap the Practice split: main area = three tabs (Ongoing sessions — default, Saved configurations, New configuration), sidebar = only the pre-selected words. Plan in four slices; the order and assumptions are in the session plan.

- **Slice A — done.** Tabs renamed / reordered; the settings form is the New configuration tab (kept mounted, so tab switches keep the working copy); the Start / Save row is a sticky bar at the bottom of the window; saved-configuration cards have a 4th column with two stacked pills (words, order); the sidebar shows the words list only on the New configuration tab and only when words came from Review (`sections=[]` otherwise); on a phone a "Selected words (N)" button opens the list; the page opens on New configuration when words came from Review, when a configuration is loaded, and after "Change settings" on the results page. The words list lost its hide button.
- **Slice B — next:** live filtering of the list by the settings, eye / eye-closed switch, uniform columns, results-page sidebar.
- **Slice C:** tag picker in the sidebar when no words came from Review (tag containers; the tags' words become the pre-selected words).
- **Slice D:** save the tags in a configuration (new `tag_ids` column).
