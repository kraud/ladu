# 05 — Components and patterns

Each pattern lists: what it is, how it looks, **the file to reuse**, and a screenshot. Before you write a new component, look here and in `frontend/src/components/`.

Naming in code: shadcn and Base UI primitives live in `components/ui/`. Ladu's own branded classes live in `styles/globals.css` (a `@layer components` block). Use Tailwind utilities for plain layout (flex, gap, padding). Use the branded class when one exists.

---

## 1. Buttons

File: `components/ui/button.tsx` (`Button`, `buttonVariants`, built on Base UI + `cva`).

| Variant | Look | Use |
|---|---|---|
| `default` | Solid `--accent`, white label | **One per view.** The main action: New word, Save word, Create tag, Next (after an answer). |
| `outline` | `--border` outline, `--background` fill | Secondary: Return, Previous, Next (before an answer), Cancel. |
| `secondary` | `--surface` fill | Neutral action in a toolbar. |
| `ghost` | No fill; `--muted` wash on hover | Tertiary and icon buttons: Leave session, Skip. |
| `destructive` | `--danger` 10% fill, red text | Delete, Remove words. Never solid red. |
| `link` | `--accent-strong` text, underline on hover | Inline action in text. |

Sizes: `default` 36px, `sm` 28px, `xs` 24px, `icon` 32px, `icon-sm` 28px, `icon-lg` 36px. Radius 8px. Label 14px / 500. Icon 16px, gap 7px.

Rules:
- Icon before the label for creation (`+ New word`) and for save (`Save word`).
- Disabled: 45% opacity, no pointer events.
- Press: moves down 1px. Focus: 3px ring in accent at 50%.
- Use `cn(buttonVariants(...))` when you style a non-button as a button. Without `cn`, `border-transparent` wins and the border disappears.
- Screenshots: `app-words.png` (primary), `app-word-detail.png` (outline, destructive, primary together).

## 2. Chips, pills and toggles

| Pattern | Class / file | Look | Use |
|---|---|---|---|
| **Chip** | `.chip` | 28px, 999px radius, 1px border, `--muted` text. Active: `--accent-soft` fill, `--accent-soft2` border, `--accent-strong` text, weight 600. | Scope filters (All / Yours / Followed / Discover), practice tabs, language pick. `app-tags.png`, `app-practice-configs.png` |
| **Large chip** | `.chip-lg` | 40px, 1.5px border. A topic icon swaps to a check when pressed; border turns `--accent`. | Onboarding topics. `onboarding-4-interests.png` |
| **Language tile** | `.lang-tile`, `components/common/LanguageTiles.tsx` | Card with flag, name, small mono list of types, and a round check in the corner. Selected: accent border, `--accent-soft` fill. | Pick languages. `onboarding-2-languages.png`, `demo-languages.png` |
| **Flag chip** | `.flag-chip` | 30px, mono, flag + language name. Static. | Show supported languages. `login-google.png` |
| **Tag chip** | `.tagchip`, `components/common/TagChip.tsx` | 22px, 12px text, `--fg-soft` fill, 1px border, optional lock and `×`. | A tag on a word. `app-words.png` |
| **Segmented toggle** | `components/ui/segmented-toggle.tsx`, `.segmented-toggle` | 36px pill track (`--fg-soft2`) with a sliding white thumb. Active label is accent. | Switch a view: Type / Language, Month / Language. `app-dashboard.png` |
| **Switch** | `components/ui/switch.tsx`, `.switch` | iOS-style on/off. | Settings that apply at once. |
| **Gender chip** | `.gender-chip` | 11px pill: `m` blue (`--lang-gb`), `f` red, `n` green. Placed after a noun. | Noun gender and German article. `app-words.png` |
| **Mode switch** | `.mode-switch` | Small outlined pill, pressed state is `--fg` fill. | Rare, small two-state control. |

Rule: a chip is a **filter or a choice**. A tag chip is a **label**. Do not mix them.

## 3. Badges (tags and status)

CSS: `.t-badge` plus `.b-owned`, `.b-followed`, `.b-mine`, `.b-unavail`. File: `features/tags/components/TagBadge.tsx`.

- Mono, uppercase, 9.5–11px, weight 600–700, 17–20px high, 999px radius.
- Each badge is a **soft fill + same-hue text**:
  - `YOURS` (`b-owned`): accent. `FOLLOWING` (`b-followed`): success. `PUBLIC`: success with a globe icon (landing preview). `PRIVATE` (`b-unavail`): warning with a lock icon.
- A verified seal is a `SealCheckIcon` (fill, 14px) in accent. It has a `title` and `aria-label`.
- Screenshots: `app-tags.png`, `landing-hero-tags.png`.

## 4. Cards

Base: `.card` — `--surface` fill, 1px `--border`, 12px radius. Padding: `.card-pad` (20px) or custom (stat card 16×18).

| Card | Class / file | Notes |
|---|---|---|
| **Stat card** | `.stat-card`, `features/metrics/components/StatCard.tsx` | Serif 34px number, 13px muted label, mono 11.5px sub line, optional 4px `.meter`. `.warn` turns the number and meter to `--warning`. `app-dashboard.png` |
| **Quick action tile** | `QuickActions.tsx` | Centred accent icon + 14px label. Whole tile is a button. Hover: border `--accent`. |
| **Tag card** | `.tagcard`, `features/tags/components/TagCard.tsx` | Serif title, one-line description, badge row, flags (max 3, then `+N`), dashed rule, footer stats. Hover: accent border + `--accent-soft`. Focus ring 2px. `app-tags.png` |
| **Language card** | `features/words/form-engine/TranslationCard.tsx` | **2px top border in the language colour**, flag + name header, collapse caret. `app-word-detail.png` |
| **Sense card** | `features/words/start-from-word/SensePreview.tsx` | Same top-border idea; a dropdown of meanings. `app-add-word-preview.png` |
| **Config card** | `features/practice/components/SavedConfigurations.tsx` | Title, subtitle, edit and delete icons top right, then four columns separated by 1px dividers: big serif count + label; flags + count; type pills + count; two pills. `app-practice-configs.png` |
| **Exercise card** | `features/practice/components/ExerciseCard.tsx` | See section 8. |
| **Option card** | onboarding welcome | Icon in a 32px rounded `--fg-soft` square, bold title, muted line. `onboarding-1-welcome.png` |
| **Landing word card** | `landing/index.html` (`.bubble`), `landing/style.css` | Flat card (12px radius, 1px border, soft shadow). A part-of-speech badge on top, then one **language row** per language: 2px top border in the language colour, 7% tint, bold code, serif word, gender badge on nouns. Five rows (EN, ES, DE, EE, FR). Sizes in `cqw`. Landing page only. `landing-hero-words.png` |
| **Landing exercise and tag cards** | `landing/style.css` (`.exercise`, `.tagcard`) | Same flat card. Exercise: language chip + prompt, then a typed input or answer tiles, then four attempt dots. Tag card: tag icon, serif title, badges, word rows in language colours, footer stats. `landing-hero-practice-*.png`, `landing-hero-tags.png` |

Rules:
- A clickable card is a real link or button. Keep a visible focus ring.
- Do not nest a card inside a card. Use a divider (`.rule`, 1px `--border`; or dashed for a softer split).
- Cards in a grid have equal width and a 12–16px gap.

## 5. Tables

CSS: `.tablewrap`, `.dtable` (`styles/globals.css`). Files: `features/words/review/` (words table), `features/tags/components/TagWordsTable.tsx`, `components/common/TablePagination.tsx`.

- Wrapper has a 1px border and 12px radius. Cell text 13.5px. Row padding 8×12px.
- Header: sticky, 12px/600, `--muted`. Language headers are `--fg` and show **flag + code** (`EN`, `ES`…).
- Row hover `--hover`. Selected row `--accent-soft`. Clickable row has `cursor: pointer`.
- One line per cell. Long text truncates.
- Fixed small columns use `.shrink-col`: checkbox, owner dot (`.owner-dot`: 20px circle), part of speech (`.pos-abbr`: mono `n.`).
- Cell that edits in place: `.cell-btn` (hover wash). Add-tag cell: dashed circle (`.cell-add`).
- Completion: `.ring` conic gradient (`components/common/CompletionRing.tsx`) with a tooltip.
- Footer: mono "Showing 1–14 of 14" left, "Rows per page" select right.
- Bulk selection: `.bulkbar` appears with the count and actions.
- Screenshots: `app-words.png`, `app-tag-detail.png`.

## 6. Forms

Files: `components/ui/form.tsx`, `input.tsx`, `textarea.tsx`, `select.tsx`, `combobox.tsx`, `checkbox.tsx`, `radio-group.tsx`, `password-input.tsx`, `label.tsx`. Validation: `react-hook-form` + `yup`.

- Field = `.field` (label, control, hint or error; 5px gap).
- Label: 12.5px/600 `--fg`. Required mark: red `*` after the label (`.req`).
- Input: 36px high, 8px radius, 1px `--border`, `--surface` fill. Focus: 1px `--accent` border + 3px soft ring.
- Error: 12px `--danger` text below the field and a danger ring. Hint: 12px `--muted`.
- Radio groups for 2–3 short choices (Regularity, Reflexivity). Chips for filters.
- Grammar forms: group by mood and tense. Group label = 12px uppercase muted. Use a 4-column grid on desktop, 1 column on phone. Underlined 14px/600 mood title (`Modo indicativo`).
- Footer bar for save (`SidebarLayout` `footer`). Add a small note: "Fields marked with * are required."
- Required fields show first. Optional fields stay out of the way.
- Screenshots: `app-add-word-draft.png`, `signup-account.png`, `login-google.png`.

### Type-ahead (start from a word)
- A card with a sparkle icon (accent), serif title, one muted sentence, then language select, type select and the text input in one row.
- The result list is a popover: group heading in accent mono-style caps (`NOUN`), each row has the word in 14px/500 and a muted gloss line under it.
- `app-add-word-typeahead.png`. File: `features/words/start-from-word/`, `features/autocomplete/`.

## 7. Dialogs, sheets, menus, tooltips

Files: `components/ui/dialog.tsx`, `alert-dialog.tsx`, `sheet.tsx`, `dropdown-menu.tsx`, `select.tsx`, `combobox.tsx`, `tooltip.tsx`.

| Part | Look |
|---|---|
| Overlay | `bg-black/10` with a small background blur. Fade 150ms. |
| Dialog | max 448px wide (`max-w-md`), 12px radius, 24px padding, `shadow-lg` + 1px ring at 10% `--fg`. Scale-and-fade in 150ms. `×` close top right. `app-tag-create.png` |
| Actions | Right-aligned: ghost or outline `Cancel`, then the primary action. |
| Alert dialog | Same shape. Use for destructive confirmation. Component: `components/common/ConfirmDialog.tsx`. |
| Sheet | Slides from an edge. Left on phone for the sidebar. |
| Menu / select / combobox popup | 12px radius, `shadow-md`, 1px ring, 4px inner padding. Slides 8px and fades 100ms. |
| Tooltip | `--fg` fill, `--bg` text, 12px, 6px radius. |

These are the **only** places that use a shadow. Cards and the header stay flat.

## 8. Practice

| Part | File | Look |
|---|---|---|
| Progress bar | `ProgressHeader.tsx` | Sticky under the header. Serif 17px "Exercise 1 of 10", mono count, 4px track `--fg-soft2` with an accent fill, ghost "Leave session". |
| Exercise card | `ExerciseCard.tsx` | `.card .card-pad`. Top: flag + language + type + tense line (14px muted). Then the prompt at 24px/600 (pronoun in muted). Then the question line with the target language and a hint toggle. Then answers. Then a dashed divider and the mastery row. |
| Choice answer | `ChoiceAnswer.tsx` | Full-width row, 44px min height, 8px radius, a small number key (`1`, `2`, `3`) in a bordered `kbd`. Correct: success border + success-soft fill + check icon. Wrong: danger border + danger-soft fill. Not chosen: 60% opacity. |
| Typed answer | `TextInputAnswer.tsx` | Standard input. Same correct and wrong colours. |
| Mastery row | `PerformanceIndicator.tsx`, `AttemptDots.tsx` | Mono eyebrow "KNOWLEDGE — THIS EXACT FORM". Four 24px round dots (`size-6`): dashed empty, green check, red cross. Then the percent (bold) and "Last practised: date". |
| Result row | `ResultRow.tsx`, `ResultsView.tsx` | Per-answer line with a typed or chosen icon. |
| Navigation | — | `Previous` (outline, disabled at start) left; `Next` right. `Next` becomes the primary button after an answer. |

Screenshots: `app-practice-exercise.png`, `app-practice-feedback.png`, `landing-hero-practice-choice.png`, `landing-hero-practice-typed.png`.

## 9. Charts

Files: `features/metrics/components/charts/`. Hand-made SVG, no chart library.

- Donut: centre has a serif total and a mono uppercase unit ("WORDS"). The legend is a grid of dot, name, percent, `[count]` (mono, tabular). Legend rows are buttons that filter.
- Bars: grouped, 2.5px radius, light grid lines (`--border`), mono 10px axis text, centred legend with 9px square dots.
- Colours: see `02-colour.md`, "Chart colours".
- Hover: a soft `--fg-soft` wash, never a colour change.

## 10. Banners, empty, loading, error

See `06-icons-motion-states.md`. Banner: `.banner.warning` / `.banner.info` (`WelcomeBanner.tsx`, `ResumeSessionBanner.tsx`). The onboarding "100 words added" banner (`onboarding-6-result.png`) uses a soft blue gradient panel, a title, one sentence, topic chips with counts, and a primary action.

## 11. Brand moments

- **Logo (app):** `components/common/BrandLogo.tsx`. App header: small word + outline bubble. Auth and demo: large word inside an outlined bubble (blue, 150px).
- **Logo (landing):** the logo sits **above the headline**, not in the header. Wordmark + small bubble below 1600px wide (336px). The larger logo inside the bubble at 1600px and up (256px wide, but it reads bigger). See `04-layout.md`, "Landing". Use the large mark where the logo is the first thing a visitor sees. Use the small one in a header.
- **Bubble shape:** the logo is a speech bubble. The landing words preview used to be drawn as a thick blue bubble with a tail. It is now a **flat card**. Do not draw new bubble frames. The logo carries the bubble idea alone.
- **Language list:** show `English · Español · Deutsch · Eesti · Français` as plain muted text under hero buttons. (Older screenshots show four languages.)
- **Highlight sync:** on the landing page, the sentence that matches the current preview has a blue track with a fill that sweeps across it (`landing-hero-words.png` shows it part way). The sweep sets the timing of the preview.

## Do not

- Do not add a new button style. Pick a variant.
- Do not write a new table, dialog, menu or side panel. Use the existing ones.
- Do not use a gradient, a heavy shadow, or an emoji as an icon.
- Do not colour a whole card with a language colour. Use the 2px top border only.
- Do not show only colour for state. Add an icon or text.
