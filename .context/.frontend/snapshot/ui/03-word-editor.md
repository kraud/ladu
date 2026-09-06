# UI Spec 03 — Word editor (`/addWord/:partOfSpeech?` create · `/word/:wordId` view/edit)

*Grounded in `snapshot/pages-word-flow.md` (WordForm, TranslationFormGeneric, WordFormSelector) + `forms-*.md` (field lists) + `data-model.md` (TranslationItem model). This is the app's core editor — rebuild via the config-driven form engine (one renderer + per-PoS×language configs).*

---

## Purpose

Create, view, and edit a word: one part-of-speech + N translations (one per language), each translation holding its PoS-specific case fields, plus optional clue and tags.

## Page layout (Add Word)

```
┌───────────────────────────────────────────────────┐
│ Title: Add word / <PoS name>                      │
│ ┌─ Step 1 (only until PoS chosen) ──────────────┐ │
│ │  What kind of word?  ( ) Noun ( ) Verb        │ │
│ │                      ( ) Adjective ( ) Adverb │ │
│ └───────────────────────────────────────────────┘ │
│ ┌─ Step 2: translations grid ───────────────────┐ │
│ │ ┌─[🇬🇧 English]──────────────[−]─────────┐    │ │
│ │ │  Regularity ( ) regular ( ) irregular │    │ │
│ │ │  Singular [______] *  Plural [______] │    │ │
│ │ └───────────────────────────────────────┘    │ │
│ │ ┌─[🇪🇪 Eesti]────────────────[−]─────────┐    │ │
│ │ │  … 8 Estonian case fields …           │    │ │
│ │ └───────────────────────────────────────┘    │ │
│ │            [ + Add language ]                 │ │
│ ├─ Clue ────────────────────────────────────────┤ │
│ │ [textarea]                                    │ │
│ ├─ Tags ────────────────────────────────────────┤ │
│ │ [multi-select tag picker]                     │ │
│ └───────────────────────────────────────────────┘ │
│ [Save]  (create mode)                             │
└───────────────────────────────────────────────────┘
```

## Page layout (View/Edit — `/word/:wordId`)

- Header row: **Back** (arrow, history-back) + title (`<PoS> — <primary case word>`) + (owner only) **Delete** (AlertDialog confirm → toast → navigate `/`).
- Same WordForm body; owner: editable with **Edit ⇄ Cancel** toggle + **Update** save; non-owner: fully read-only (fields render as text; only non-empty fields shown).

## Translation card (one per language, `TranslationFormGeneric`)

- Header: flag + native language name; card border tinted with a per-language accent (flag-color gradient — carry over as a 2px top border, cheap and effective).
- Body: the PoS×language form (from `forms-*.md` field lists) — text inputs for case fields, radio groups for regularity/gender, checkbox for extras (e.g. EE "search in English").
- **Autocomplete row** (EE noun/adj/verb, ES verb, DE noun/verb, ES noun gender): status icon (empty `?` / no-match `✗` / found `✓` / partial `⚠` / loading) + "Autocomplete" button that fills the empty fields from the stored response; debounced 450–600 ms per-field (never a shared timer).
- Footer buttons (not in read-only): **Remove** (deletes the language slot; disabled when only 2 remain) and **Clear** (empties the slot, keeps position).
- Empty-case filtering: case values left blank are dropped on save (never persisted as empty rows).
- "Switch language" hint: when other languages remain unselected, a small flag picker lets you swap this slot's language in place.

## Language slot rules

- Available slots = user's languages (profile `languages` order) minus already-used ones.
- Max 4 slots (EN/ES/DE/EE). "+ Add language" disabled at 4 or when no languages remain.
- Minimum 2 translations to save.

## Save gating (Submit button)

Disabled unless: ≥2 translations AND all present translations complete (`completionState` — required fields filled) AND something is dirty (any field changed / clue / tags). While saving: inline spinner, forms stay visible.

## Save results

- **Create** success: morph the "Saving…" toast into success with a "See details" action → `/word/:id`; then reset the form and stay on `/addWord`.
- **Update** success: success toast; stay on the word (edit mode re-locks fields).
- **Delete** success: success toast → navigate `/`.
- Errors: error toast; form state preserved.

## Clue & tags

- Clue: multiline text, always visible in edit mode (create: appears once PoS is chosen).
- Tags: multi-select picker (`AutocompleteMultiple`) — search tags by label, add new options allowed; removal via chip ×.

## States

- Loading (edit mode): skeleton of the translation cards while `getWordById` runs.
- Not found: error toast + redirect back.
- Read-only (non-owner): all inputs render as text; no Save/Delete/Edit; Back only.
