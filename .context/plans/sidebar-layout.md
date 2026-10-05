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
- **Slice B — done.** `wordFilter.ts` (`describeWords`): a word is used when its type is selected and at least one of its languages is. `PreselectedWords` follows the live settings (`SetUp` keeps `liveParams`, fed by `ParametersForm.onParamsChange`); the eye button switches between *visible* (default: all words; unused words gray + struck through; flags of unselected languages gray via `FlagIcon muted`) and *hidden* (unused words and unselected flags left out). Rows are a fixed grid: flags (4.75rem) | word | type, right-aligned. A line says "N of M words will be used". The results page renders `ResultsView` inside the sidebar layout (`ResultsPage`) with the session's words and settings (fixed, no "Remove pre-selection"); the words list left the "Settings used" summary. Mode state is per page (not shared between set-up and results).
- **Slice C — done.** With no words from Review, the New configuration sidebar exists but starts collapsed (`uiStore.sidebarCollapsed.practice` default `true`; it opens when words arrive from Review, from a loaded configuration, or from "Change settings"). The results page uses its own entry `practiceResults` (starts open). Opened, the sidebar shows a note, a separator and a `TagCombobox` (`selected={[]}`: chosen tags never show inside the box). Each chosen tag is a container (`TagWordsSidebar.tsx`: name, word count, remove, fold — folded at first). `useTagWords` (`practice/hooks.ts`) loads every page of each tag's words under `wordKeys.all`; `unionWords` joins them; the union is the pre-selection (types, Start, list marks). Start and Save are blocked, with a reason, while the words load, fail, or the tags have none. `ParametersForm` now derives its word types from the pre-selection at render (`narrowToPickable`), so types the words lack fall away and return when a tag is removed. Review words and tags are exclusive (Review words: no tag search). Tags are not saved in a configuration yet (slice D).
- **Slice D — done.** Backend: migration `0018_practice_config_tags` (`practice_configs.tag_ids uuid[]`, nullable), `validateConfigRequest` (`tagIds`, max 20, code `invalid_tag_ids`), `practiceConfigService` (create / update / list return `tagIds`); backend tests (unit + integration). Frontend: `SavedConfig.tagIds` / `SaveConfigBody.tagIds`; `ConfigDraft.tagIds` (set when the words came from tags); the save dialog says "includes the words of N tags"; renaming keeps the tags; `SavedConfigurations` reads the tags again on click (`LoadedTags`: the tags that are still there + how many are gone) and `SetUp.loadConfig` restores the containers (words come live from the tags). If no tag can be read it falls back to the saved words, with the "some words are not available" banner. Also: `TagCombobox` got `excludeIds`, so a tag already chosen in Practice's picker is not offered again. E2E: new scenario in `phase-5-5-saved-practice.spec.ts`. The dev database needs `npm run db:migrate` (done locally 2026-10-04); staging and production get it from the deploy step (`node scripts/migrate.js`).

### Practice follow-ups (2026-10-05)

- A lone sidebar section shows its title in the header row beside the collapse button (desktop); the phone menu keeps its own title.
- `TagCombobox`: picking a tag closes the list and clears the input (all hosts). Tests that pressed Escape after a pick no longer do.
- Every Practice tab has a one-line hint (`sessions.note`, `configs.note`, `setup.newNote`).
- Selecting a saved configuration opens `StartConfigDialog`: **Start session** (generates the exercises at once; for tags the words are read live via `tagWordsQuery`; if nothing matches, the dialog stays open with the reason) or **Change settings first** (the old flow, New configuration tab).
- Start / Save no longer use `position: sticky` inside the form. `SetUp` gives the layout a `footer` (the fixed bottom bar, shared with the word editor) on the New configuration tab, and `ParametersForm` puts its buttons into it through a portal (`actionsHost`; the submit button uses `form=`). This removes the extra scroll at the end of the page and works on a phone.
- Mobile horizontal scroll on Practice: measured 0 px overflow on the set-up tabs, the exercise and the results screens after these changes (the old negative-margin bar is gone). The Review page still overflows on a phone when rows are selected (bulk-action buttons, table) — not part of this change.

### Titles, bars and headers (2026-10-05)

- Every `SidebarLayout` shows its `label` as the panel title in the header row, beside the collapse button (desktop), and as the phone menu's title: "Additional information" (Add word / Word page; was "Word options"), "Filters" (Review), "Selected words" (Practice). A lone section with the same name is not repeated.
- Practice's bottom bar: `SidebarLayout` prop `footerAligned` lays the footer out like the page (a spacer the width of the panel, then the centered column), so Start / Save end at the right edge of the settings card. On a phone the buttons are small, labelled "Save" / "Start", never wrap; the hint goes on its own line above.
- Word editor bar on a phone: the reason and the button share one row (the reason takes the space left).
- Tags page on a phone: `.toolrow .searchbox { flex: none }` — in the column layout its 260px flex-basis had become its height.
- Add word and Practice have a title only (no subtitle), like Tags and Review. The part-of-speech gate lost its prompt line ("What kind of word is it?").

### New configuration as a view, not a tab (2026-10-05)

- The set-up has two tabs (Ongoing sessions, Saved configurations). "New configuration" is a button on the title row, right-aligned (like "New tag"). It opens the New configuration view: no tabs, no button, a back arrow (`practice:setup.newConfigurationBack`) before the title "New configuration", and no hint. The form stays mounted (hidden) when the user goes back, so the working copy is kept. State: `creating` (view) and `tab` (list tab) in `SetUp`.
- The view opens with the sidebar expanded (as for words from Review). The panel title is slightly larger (15px) and has no icon (shared `SidebarLayout`, so Review and Add word follow).
- Phone: the "Selected words" row is the first row of the settings card (`ParametersForm` prop `wordsSlot`; `WordsBadges` in `PracticePage.tsx`). Two badges, one active: "All" (active with no words; a click clears the selection) and "(X) Selected" with a magnifying-glass-plus icon (opens the drawer, also with X = 0). `SidebarTrigger` got an `active` prop (`data-active`, styled like a pressed `.chip`).
