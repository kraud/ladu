# Review Table — full column & cell-interaction specification

*2026-09-05. Consolidated spec for the Review table (`/review`), the most complex single component in the frontend. Every claim grounded in source `file:line`. Complements `pages-review-practice.md` (page-level flows) and `forms-*.md` (the forms the cell modal reuses). This is the document to rebuild from.*

---

## 1. What the table is

A multilingual, multi-owner vocabulary browser/edit surface. One **row per word**; one **column per language** (ordered by the user's language preference); cells show a single "primary case" value per word×language; clicking a cell opens a modal with the full translation for that language (all cases) where it can be edited or deleted. A leading select/owner column, a PoS ("Type") column, and a trailing tags column complete the layout. Rows are multi-selectable, feeding bulk actions (create exercises, mass tag assignment, mass delete) and later the exercise hand-off.

Data source: `GET /api/words/simple` (`getWordsSimplified`) — server-filtered by PoS/gender/tags, returning **simplified rows** (not full `WordData`).

## 2. Row model — `TableWordData` (what the backend sends)

Built server-side by `getWordsSimplified`. The **live** implementation is the TypeScript controller `backend/controllers/wordController.ts:151-232`; a legacy Mongoose `wordController.js` (same shape) is dead code.

```ts
type SimplifiedWord = {
  id: string,
  user: string,                 // owner id — used to flag followed-tag words
  partOfSpeech: PartOfSpeech,
  tags: string[],               // tag labels (array)
  creationDate?: string,
  lastUpdate?: string,
  // per-language "primary case" — the single case displayed in that language's cell:
  dataDE?: string, dataEE?: string, dataEN?: string, dataES?: string,
  genderDE?: string, genderES?: string,          // only DE/ES (nouns)
  registeredCasesDE?: number, registeredCasesEE?: number,   // count of cases with data
  registeredCasesEN?: number, registeredCasesES?: number,
}
```

> **Discrepancy to note for the rewrite**: the FE type `TableWordData` (`ReviewTableColumns.tsx:13-40`) declares `singularEN`/`singularNimetavEE`/`genderDE`/`singularNominativDE`/`genderES`/`singularES`/`registeredCases*` — but the column factory actually reads `dataDE`/`dataEE`/`dataEN`/`dataES` accessors (`ReviewTableColumns.tsx:63,79,94,109`). The type is stale; the **actual** row fields are the `dataXX`/`genderXX`/`registeredCasesXX` set above. Rebuild against the real response (`wordController.ts:155-232`), not the stale type.

### 2.1 The "primary case" mapping (what `dataXX` contains)

`getWordsSimplified` extracts exactly one case per language — the **required/representative** case for that PoS. From `wordController.ts:155-232`:

| PoS | EN → `dataEN` | ES → `dataES` | DE → `dataDE` | EE → `dataEE` |
|-----|--------------|--------------|--------------|--------------|
| Noun | `singularEN` | `singularES` (+`genderES`) | `singularNominativDE` (+`genderDE`) | `singularNimetavEE` |
| Verb | `simplePresent1sEN` | `infinitiveNonFiniteSimpleES` | `infinitiveDE` | `infinitiveMaEE` |
| Adjective | `positiveEN` | `maleSingularES` (fallback `neutralSingularES`) | `positiveDE` | `algvorreEE` |
| Adverb | `adverbEN` | `adverbES` | `adverbDE` | — (no EE adverb) |

`genderDE`/`genderES` are emitted alongside `dataDE`/`dataES` only for **nouns** (`wordController.ts:174-183`). `registeredCasesXX` = count of cases with non-empty data for that language (`wordController.ts:234-250`).

## 3. Column layout (in render order)

From `createColumnsReviewTable` (`ReviewTableColumns.tsx:52-321`). Columns assemble as:

| # | Column | accessor | Content | Notes |
|---|--------|----------|---------|-------|
| 0 | **Select / owner** | `user` | select-all checkbox (header); per-row checkbox + owner icon (cell) | sorting + column filter disabled |
| 1 | **Type (PoS)** | `partOfSpeech` | translated PoS label (`translateFunction`) | display-only, centered, no filter |
| 2..n | **Language columns** | `dataDE`/`dataEE`/`dataEN`/`dataES` | `TableDataCell` with the primary case | ordered by `selectedLanguagesList` (user preference); width 200px; sortable; no column filter |
| last | **Tags** | `tags` | `TableDataCell` type=`array` (tag chips) | sorting disabled |

### 3.1 Select/owner column (`ReviewTableColumns.tsx:175-263`)

- **Header**: `IndeterminateCheckbox` toggling all rows (`table.getToggleAllRowsSelectedHandler()`).
- **Cell**: an `Avatar` when the row's `user` === current `user._id` (own word); a `GroupIcon` otherwise (word that belongs to a tag the user follows — the **owner-differentiation** signal). A per-row `IndeterminateCheckbox` (`row.getToggleSelectedHandler()`) sits beside the icon.

### 3.2 Language columns (`ReviewTableColumns.tsx:52-173`)

For each language in `selectedLanguagesList`, one column:
- **Header**: `TableHeaderCell` with the translated language name (`getCurrentLangTranslated`).
- **Cell**: `TableDataCell` receiving `language`, `partOfSpeech`, `wordId`, `wordUser`, `content` (= `dataXX`, the primary case), `wordGender` (= `genderDE`/`genderES`, DE/ES only), `displayWordGender` (from the gender-toggle), `amount` (= `registeredCasesXX`), `onlyDisplayAmountOnHover: true`, `type: "text"`.
- DE and ES carry `wordGender` + `displayWordGender`; EE/EN do not (`ReviewTableColumns.tsx:62-115`).
- `enableColumnFilter: false` on all (header search inert — see §4).

### 3.3 Gender toggle

A "Display gender" switch, shown only when the active filters include Noun, toggles `displayGender` → `displayWordGender` (`TranslationsTable.tsx:314-324` → `ReviewTableColumns` `displayGender` param). When on, the DE/ES cells render the gender alongside the primary case.

### 3.4 Tags column (`ReviewTableColumns.tsx:297-323`)

`TableDataCell` type=`array`, content = the word's tag label list, `onlyForDisplay: false` (interactive), min-width 50px. Renders tag chips; clicking a chip navigates to `/review?tags=<id>`.

## 4. Cell → modal interaction model (`ExtraTableComponents.tsx` `TableDataCell`)

The cell is a stateful mini-component owning one modal instance (`openWordModal`, `selectedTranslationData`, `selectedWordTagsData`).

### 4.1 Text cell (a language column, `type: "text"`)

- **Displayed**: the single primary case value (`content`) for that word×language, with a hover reveal of `registeredCasesXX` as a completion ring/percentage (`getPercentage` over max cases per PoS/language; `ExtraTableComponents.tsx:276-354, 507-560`).
- **Click** (when not `onlyForDisplay`): `openModal()` → dispatches `getWordById(wordId)` (full word) + `setSelectedPoS(partOfSpeech)` and opens the modal (`ExtraTableComponents.tsx:142-155`). The modal seeds `selectedTranslationData` from `word.translations.find(lang === props.language)` and renders it through **`WordFormSelector`** — i.e. the *same* per-language/PoS form as the AddWord page, showing **all stored cases** for that translation (`ExtraTableComponents.tsx:170-206, 600`).
- **Edit**: labels toggle to inputs; Save (when dirty) → `updateWordById({id, translations: appendUpdatedTranslation(...)})`; success toast + `getWordsSimplified()` refresh (`ExtraTableComponents.tsx:617-681`).
- **Delete translation** (text only): removes the whole `TranslationItem` for that language from the word's translations via `updateWordById` without that language (`ExtraTableComponents.tsx:683-701`). Guarded: only for words the user authored, and only when the word has ≥3 translations (the delete button is hidden otherwise, `:886-905`).

### 4.2 Empty cell (no translation for that language)

When a word has no translation for a column's language, the cell shows an **icon** instead of text:
- **Add icon** for own words → clicking opens the modal in *create* mode for that language (an empty form to load the new translation).
- **Block icon** for foreign words (from followed tags) → read-only; no create allowed (`ExtraTableComponents.tsx:740-767`).

### 4.3 Tags cell (`type: "array"`)

Click → tags modal with `AutocompleteMultiple` (allowNewOptions), dirty-detection; Save → `updateWordById({id, tags})` (`ExtraTableComponents.tsx:579-591, 617-640`). A tag chip click navigates to `/review?tags=<id>` and reloads filtered (`:417-420`).

### 4.4 Modal scaffolding to reuse

`openModal`/`handleOnClose` reset `selectedTranslationData`, `displayComponentAsLabels`, `userIsWordAuthor`, PoS, and `clearWord()` (`ExtraTableComponents.tsx:227-241`). Edit/delete is disabled when `!userIsWordAuthor` (set by `user._id === word.user`, `:157-160`).

## 5. Row selection & bulk actions

Selection is **local to the table** (`rowSelection` state in `TranslationsTable.tsx:139-140`), surfaced to `Review.tsx` as an object of selected row keys. Bulk action buttons in `Review.tsx` are gated by selection count:

| Action | Min selection | Behavior | Source |
|--------|---------------|----------|--------|
| Create exercises | > 2 | `setWordsSelectedForExercises(selectedWordsData)` + navigate `/practice` | `Review.tsx:528-547` |
| Detailed view | == 1 | navigate `/word/<id>` | `Review.tsx:549-555` |
| Assign tag | > 0 | tag-assign modal → `applyNewTagToSelectedWordsById` | `Review.tsx:557-569, 660-680` |
| Delete selected | > 0 (confirmation) | `deleteManyWordsById(ids)` | `Review.tsx:571-596` |

### 5.1 The index-keyed selection bug (must fix in the rewrite)

Selection keys are TanStack **row indices**, and the three `goToDetailedView` / `getWordsIdFromRowSelection` / `getWordsDataFromRowSelection` helpers do `wordsSimple.words[parseInt(selectionKey)]` (`Review.tsx:228-254`). But the displayed rows are a **language-filtered subset** (`filterWordsWithNoMatchesWithLanguageList`, `Review.tsx:304-319, 513`) and re-indexed by search/sort — so under filter/search the index points at the **wrong word**. The rewrite keys selection by stable `word.id` (`pages-review-practice.md` cross-cutting note; study §8.4 #6).

## 6. Rebuild checklist

1. Row type = real simplified shape (`wordController.ts:155-232`), not the stale `TableWordData` (§2).
2. Columns = select/owner → Type → N language columns (user-ordered) → tags; DE/ES carry gender + `registeredCasesXX`; width 200px; sortable; no column filter (§3).
3. Cell text = primary case `dataXX`; hover reveals `registeredCasesXX` completion ring (§4.1).
4. Cell click → `getWordById` → `WordFormSelector` modal with all cases; edit via `updateWordById`; delete-translation guarded (author + ≥3 translations) (§4.1).
5. Empty cell → Add icon (own) / Block icon (foreign) → new-translation modal (§4.2).
6. Tags cell → `AutocompleteMultiple` modal; chip click → `/review?tags=<id>` (§4.3).
7. Owner signal: `Avatar` (own) vs `GroupIcon` (followed-tag) (§3.1); edit/delete disabled unless author.
8. Selection by stable id; bulk actions gated by count (§5).
