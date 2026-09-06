# UI Spec 04 — Review table (`/review/:filtersURL?`)

*Grounded in `snapshot/review-table.md` (full column/cell spec) + `pages-review-practice.md` (page flows). The most complex view — read `review-table.md` for the data contract.*

---

## Layout

```
┌────────────┬──────────────────────────────────────────────────┐
│ Filters    │ [global search____]  [Display gender ◯]          │
│ (sidebar,  │ ┌──────────────────────────────────────────────┐ │
│ collapsible│ │☑│Type│🇩🇪 data│🇪🇪 data│🇬🇧 data│🇪🇸 data│Tags│ │
│ via chevron│ │☑│ n. │ der Baum│ puu│ tree│ el árbol│ 🏷️ │ │
│)           │ │☑│ v. │ …       │ …  │ …   │ …      │    │ │
│ Gender:    │ └──────────────────────────────────────────────┘ │
│ [chips]    │ Bulk bar (when selection > 0):                   │
│ PoS:       │ [Create exercises] [View] [Assign tag] [Delete]  │
│ [chips]    │                                                  │
│ Tags:      │  [Load more]                                     │
│ [multi]    │                                                  │
│ Lang order │                                                  │
│ [DnD list] │                                                  │
└────────────┴──────────────────────────────────────────────────┘
```

## Filter sidebar (collapsible)

- **Gender** chips (nouns): der/die/das + el/la/el-la; multi-select toggle chips.
- **Part of speech** chips: Noun/Verb/Adjective/Adverb.
- **Tags**: multi-select autocomplete (`AutocompleteMultiple`, matchAll semantics: all selected tags must be on the word).
- **Language order**: two-container DnD list (selected ⇄ other, min 2) — reorders the table's language columns.
- **Every filter state lives in the URL** (searchParams) — reload restores it. Any change re-queries the list (debounced).

## Table (`ReviewTable` on TanStack Table)

- **Columns in order**: select/owner → Type → one column per selected language (user's language order) → Tags.
  - *Select/owner*: header select-all checkbox; per-row checkbox; owner icon — avatar (own word) vs group icon (word from a followed tag).
  - *Type*: translated PoS abbreviation (n./v./adj./adv.), centered, read-only.
  - *Language columns*: the **primary case** value (`dataXX` — see `review-table.md` §2.1); sortable; DE/ES optionally show gender (per the Display-gender switch, nouns only); hover reveals a completion ring (`registeredCases`/max cases). Column headers draggable to reorder (same as sidebar language order).
  - *Tags*: tag chips; chip click → sets `?tags=<id>` filter.
- **Global search** (debounced 500–750 ms) filters the visible rows client-side; per-column filters are NOT enabled (keep off).
- **Row selection**: checkbox state keyed by **stable word id** (not row index — old bug); selection survives refetch.
- **Pagination**: server cursor pagination; "Load more" appends (`useInfiniteQuery`).

## Cell interactions (the modal system)

- **Text cell click** → Dialog opens the **full word editor for that language** (the same config-driven form: all stored cases of that translation), fed by `getWordById`. Inside: Edit labels ⇄ inputs; **Save** (when dirty) → update → success toast + list refresh; **Delete translation** (author only, only when the word has ≥3 translations — button hidden otherwise) → removes that language's translation entirely.
- **Empty cell** (no translation in that language): shows an **+ Add** icon (own words) → same dialog in create mode for that language; foreign words show a **block icon** (read-only, no create).
- **Tags cell click** → tag-picker dialog (`AutocompleteMultiple`); save → update word's tags.
- Non-author words: edit/delete disabled in the dialog (Block icon on empty cells).

## Bulk action bar (visible when selection > 0)

| Action | Gate | Behavior |
|--------|------|----------|
| Create exercises | >2 selected | stores selected words → navigates `/practice` (pre-selected mode) |
| View | ==1 | → `/word/:id` |
| Assign tag | ≥1 | tag-picker dialog → apply to all selected words |
| Delete | ≥1 | AlertDialog confirm → bulk delete → success toast + list refresh |

## States

- Loading: skeleton rows (keep table shape).
- Empty: "No words match your filters" + CTA "Add a word" (→ `/addWord`); if no filters, "No words yet" + CTA.
- Error: toast + retry.

## Intentional deltas (vs old)

- Stable-id selection (was index-keyed — wrong-row bug).
- URL-persisted filters (old: only the tag param, once).
- Server pagination (old: unpaginated full list).
- `TableWordData` typed against the real simplified shape (`dataXX`), not the stale type.
