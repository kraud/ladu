# 04 — Layout

Sources: `frontend/src/components/layout/` (`AppShell.tsx`, `PageColumn.tsx`, `sidebar/SidebarLayout.tsx`), `.context/plans/sidebar-layout.md`, and `globals.css`.

## One breakpoint

**920px.** At 920px wide or less, the layout is a phone layout. There is no tablet layout.

- In code: `useIsMobile()` (`lib/useMediaQuery.ts`, `MOBILE_QUERY = '(max-width: 920px)'`) and `@media (max-width: 920px)` in CSS.
- Render a control **once** per breakpoint (with `useIsMobile`). Do not render two copies and hide one with CSS. A duplicate gives a control two accessible names.
- Smaller steps exist for single components: `720px` and `640px` (tag toolbar and tag grid).

## Page types

| Type | Used for | Screens |
|---|---|---|
| **App page** | Everything after sign-in | `app-*.png` |
| **App page with sidebar** | Words, Word detail, Add word, Tag detail, Practice | `app-words.png`, `app-add-word-draft.png`, `app-tag-detail.png` |
| **Split auth page** | Login, sign-up, demo | `login-google.png`, `signup-account.png`, `demo-start.png` |
| **Onboarding wizard** | First sign-in only | `onboarding-*.png` |
| **Landing page** | Public home, separate static site (`landing/`) | `landing-*.png` |
| **Focus page** | One exercise at a time | `app-practice-exercise.png` |

## App frame (every signed-in page)

```
┌────────────────────────────────────────────────────────────┐
│ AppHeader — sticky, 53px, blurred --bg 90%, 1px border     │
├────────────────────────────────────────────────────────────┤
│  <main> — centred column                                   │
│   max-w-5xl (1024px)  ← default                            │
│   max-w-7xl (1280px)  ← `wide` routes                      │
│   padding: 12px top, 24px sides, 32px bottom               │
│   phone: 8px top, 12px sides                               │
└────────────────────────────────────────────────────────────┘
```

### Header (`AppHeader`, `.app-header`)

- Left: the logo (`Ladu_title_with_icon.svg`), then three nav links: **words**, **tags**, **practice**. Each link is an icon + lowercase label. Nav is 32px high, 8px radius, 14px/500.
- Active link: `--accent-strong` text on `--accent-soft`. Inactive: `--muted`; hover: `--fg` on `--fg-soft`.
- Right: language selector (flag + code), theme toggle (moon or sun), demo timer pill (demo only), avatar (32px circle, initials).
- The header content is centred in the **whole window**, not in the space beside a sidebar. The sidebar column offsets itself to line up with it (see below).
- Nav order and names are fixed. Never hide "words" (principle 3).

### Page title row

`[icon] Title` on the left, the main action on the right (`+ New word`, `+ New tag`, `+ New configuration`). Under it: search and filters, then content.
- Icon: Phosphor, accent colour, about 22px.
- The action is one primary button (`default` variant) with a `+` icon.

### Grid and spacing

| Space | Value | Use |
|---|---|---|
| 4–6px | `gap-1`, `gap-1.5` | Icon to label, chip internals |
| 8–12px | `gap-2`, `gap-3` | Between chips, between stacked cards (12px) |
| 16px | `gap-4` | Between grid columns, `.dash-grid` gap |
| 20px | `p-5`, `.card-pad` | Card padding |
| 24px | `px-6` | Page side padding |
| 44–48px | auth panels | Large padding on brand side |

Controls are **36px** high (`h-9`). Header controls are **32px**. Small chips are **28px**. Tag chips are **22px**.

### Radius and borders

| Token | px | Use |
|---|---|---|
| `rounded-sm` | 6 | Skeleton, small buttons |
| `rounded-md` | 8 | Buttons, inputs, nav links, banners |
| `rounded-lg` | 12 | Cards, dialogs, tables, menus |
| `rounded-xl` | 16 | Large preview cards |
| 20px | `.auth-panel` | Tinted panel on auth and onboarding |
| `rounded-full` | 999 | Chips, pills, toggles, avatars |

Borders are **1px `--border`**. Selected tiles use **1.5–2px `--accent`**. Shadows are rare (see `05-components.md`, Dialog and Menu).

## Sidebar layout (`SidebarLayout`)

One shared side panel for Words, Word detail, Add word, Tag detail and Practice.

- **Desktop:** the panel is docked to the **left edge of the window**, from under the header to the bottom (or to a fixed footer bar).
  - Collapsed: a 3.5rem icon rail, one button per section, with a small count badge (`app-words.png`, `app-add-word-draft.png`).
  - Open: `narrow` (16rem) or `wide` (24rem).
  - The collapse button is always the first control.
- **Phone:** the panel is not on the page. A trigger button opens it as a slide-in `Sheet` from the left.
- **Footer bar:** a bar fixed to the bottom, full width, for the page's main save action. Example: `Change word type` on the left, `Save word` on the right (`app-add-word-draft.png`, `app-word-detail.png`).
- State lives in `uiStore.sidebarCollapsed[id]`. It is per session and not saved.
- The content column inside the layout lines up with the header's content. Do not add your own `mx-auto` column inside it.
- A page gives the layout a list of `sections` (icon, label, count, content). Do not write a new side panel.

## Wide pages

Pages that need more width set `staticData.wide` on the route in `app/router.tsx`. The column then uses `max-w-7xl`. Today: word compose, edit and detail (verb tense columns need the room).

## Common page layouts

### Dashboard (`app-dashboard.png`)
- Welcome row: waving-hand icon, serif "Welcome, {name}", a mono greeting line next to it.
- `.dash-grid`: two columns, **1fr / 2fr**, 16px gap.
  - Left: a stack of three `.stat-card`s, then two **quick action** tiles side by side (Random practice, New word).
  - Right: one big `.card` (`.metrics`) with a donut chart, a divider, then a bar chart. Each chart has a `SegmentedToggle` in its header.
- Phone: one column.

### List page: table (`app-words.png`)
- Title row → search box + count → `.tablewrap` table → footer row ("Showing 1–14 of 14", "Rows per page" select).
- Columns: select, owner dot, part of speech, one column per language (flag + code header), tags.
- Row hover `--hover`; selected row `--accent-soft`. Header is sticky.
- Phone: table is as wide as its content. Rows are selected by long press.

### List page: card grid (`app-tags.png`)
- Title row → toolbar (search, scope chips `All | Yours | Followed | Discover`, count, "Verified" checkbox, sort select) → 3-column grid of cards (`.tag-grid`). 1 column under 640px.

### Detail page (`app-tag-detail.png`, `app-word-detail.png`)
- Back link or arrow on the left of the title. Header card with title, description, badges, one stat tile, and Edit / Delete actions.
- Content below: table or a stack of language cards.

### Language cards (`app-word-detail.png`, `app-add-word-draft.png`)
- A stack of full-width cards, one per language. Each has the language's 2px top border, flag + language name on the header row, and a collapse caret on the right.
- Inside: group forms by mood and tense, with mono-like small caps group labels. Use a multi-column grid for tenses (4 columns on desktop).

### Focus page: practice (`app-practice-exercise.png`)
- Narrow centred column (about 720px). A top bar (`Exercise 1 of 10`, correct count, progress line, `Leave session`), one big card, then `Previous` / `Next` buttons below it.
- No sidebar and no distractions while an exercise runs.

### Split auth page (`login-google.png`, `signup-account.png`, `demo-start.png`)
- `.auth-shell`: 2 columns, `minmax(380px, 46%)` then `1fr`.
- Left: brand ground (`--surface`). Big outlined-bubble logo (150px), serif tagline (32px), sub text, five flag chips (mono, uppercase-ish), language and theme controls at the bottom left.
- Right: `.auth-panel`, a rounded (20px) panel tinted 4% with `--fg`, 20px margin. The form is centred, **360px** wide (`.auth-form`). Wider forms (demo) use 640px.
- Phone: the brand side becomes a compact top block.

### Onboarding wizard (`onboarding-1-welcome.png` … `-7-tags.png`)
- Same two-column idea: `.ob-shell`, `minmax(380px, 40%)` then `1fr`.
- Left rail: logo, one-line promise, a numbered step list (done = green check, current = filled blue circle, next = outline circle), and at the bottom a "Your choices so far" summary card.
- Right: a tinted rounded panel with a mono eyebrow ("STEP 1 OF 4"), a serif question, helper text, the options, and a footer bar with `Back` and `Next`. `Skip ›` sits top right.
- Under 900px the rail becomes a sticky top bar.

### Landing (`landing-hero-words.png` is the current design)
Source: `landing/index.html` and `landing/style.css`. The landing page is a separate static site. It has no React and no shadcn.

- **Header:** on the home page the header shows only "Log in" at the right. The brand is hidden there (`.home .brand`) because the logo is in the hero. Other landing pages (privacy, terms…) show the small logo (97×28) in the header.
- **Logo above the headline** (left column, on every width):
  - Below 1600px: the wordmark + small bubble (`Ladu_title_with_icon.svg`), `min(100%, 21rem)` wide.
  - 1600px and up (`min-width: 100rem`): the logo inside the bubble (`Ladu_inside_bubble_outline.svg`), 16rem (256px) wide. This is the screenshot.
  - Phone: the wordmark again, centred, `min(78%, 17rem)`.
- **Width:** content max `74rem` (1184px). At 1600px and up it is `90rem` (1440px).
- **Hero:** a grid with two columns. Left (as wide as its widest line): logo, serif headline on **one row** (never wraps), paragraph, two buttons (filled "Create account", outlined "Try the demo"), the language list, then the language and theme controls. Right: one preview card, 26rem wide (33rem at 1600px and up). Gap 3rem (4rem at 1600px and up).
- **Headline size:** `clamp(1.6rem, 3.1vw, 2.4rem)`; `3rem` at 1600px and up. Paragraph `1.15rem` (`1.3rem` at 1600px and up), max `34rem` (`40rem`).
- **Language list:** `English · Español · Deutsch · Eesti · Français` (five languages), plain muted text under the buttons.
- **Previews:** three cards share the right column and take turns: the **word card**, the **exercise card**, the **tag card**. Each is a **flat card**: 12px radius, 1px `--border`, `--surface` fill, a soft shadow under it. The old speech-bubble frame is gone. The CSS class is still `.bubble`, but it does not look like a bubble.
  - **Word card:** a part-of-speech badge on top (translate icon + "VERB", `.tag-badge` look), then one row per language (EN, ES, DE, EE, FR). Each row is a **language row**: 2px top border in the language colour, 7% tint of that colour, a bold code (`EN`), and the word in the serif font. A noun row ends with a gender badge (`la`, `das`). The words roll through dance, house, pretty, very.
  - Sizes inside a card use `cqw` (a hundredth of the card's width), so a card scales as a whole. Do the same for any new preview.
- **Highlight sync:** the part of the paragraph that matches the visible card has a blue track (accent 13%) with a fill (accent 30%) that sweeps across (10 seconds by default; `app.js` sets it). The sweep sets the beat of the preview on the right. With reduced motion, nothing sweeps.
- **Footer:** `© Ladu` left, five text links right (Blog, Privacy, Terms, Credits, Legal notice).
- **Phone** (`max-width: 52rem`): one column and no header. Order: centred logo, one-line headline with a 1px separator under it, sentence 1, then each preview beside its own sentence, left and right in turn. The buttons, language list, switches and "Already registered? Sign in" come last. All three previews show at once.

## Known drift — do not copy

| Where | Problem | Rule to follow |
|---|---|---|
| `app-add-word*.png` and `app-word-detail.png` | These pages use the wide column and start at about 104px or 96px from the left. Words, Tags and Practice start at about 232px. The switch looks like a jump. | Pick the column on purpose. Use `wide` only when the content needs it. Use `PageColumn` for states without a sidebar. |
| `app-word-detail.png` | Language cards have different widths (about 465px, 690px, 240px). The grid looks ragged. | Give sibling language cards the same width. Let tense columns inside wrap instead of resizing the card. |
| `app-add-word-preview.png` | "Choose the words to use" has two columns but leaves most of the page empty, and its button is far from the cards. | Keep the primary action close to the content, or in the footer bar. |
