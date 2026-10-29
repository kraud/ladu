# 03 — Typography

Source: `@theme` block in `frontend/src/styles/tokens.css`, and the type classes at the top of `frontend/src/styles/globals.css`.

Ladu loads **no web fonts**. It uses system font stacks. This keeps the app fast and private. The look changes a little by operating system. Design for that.

## Three font roles

| Role | Tailwind | Stack | Job |
|---|---|---|---|
| **Display** (serif) | `font-display` | `Iowan Old Style`, `Charter`, `Georgia`, `Times New Roman`, serif | Page titles, card titles, big numbers, taglines, word headings in previews. It gives the dictionary feel. |
| **Body** (sans) | `font-body` (default) | `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `system-ui`, sans-serif | Everything else: forms, tables, buttons, nav, long text. |
| **Mono** | `font-mono` | `ui-monospace`, `SF Mono`, `JetBrains Mono`, `Menlo`, monospace | Small facts: counts, steps, eyebrow labels, badges, page subtitles, language codes. |

**Rule of thumb:** serif = *what this is* (a title or a headline number). Sans = *what you do* (read, type, click). Mono = *a small fact about it* (3 words, step 1 of 4, last practised).

## Scale

| Name | Size / line | Font | Weight | Class or token | Use |
|---|---|---|---|---|---|
| Landing hero | `clamp(1.6rem, 3.1vw, 2.4rem)`; 3rem at 1600px and up | serif | 600, one row, never wraps | `landing/style.css` `.hero-title h1` | Landing headline only. The plain `h1` rule in that file (`clamp(1.9rem, 4.4vw, 3rem)`) is for the legal pages. |
| Auth tagline | 32px / 1.22 | serif | 600 | `.auth-tagline` | Left side of auth and demo |
| Stat number | 34px / 1.1 | serif | 600, tabular | `.stat-card .s-num` | Dashboard big numbers |
| **H1** | 26px / 1.15 | serif | 600, −0.015em | `.h1`, `text-h1` | Page title |
| **H2** | 20px / 1.2 | serif | 600, −0.01em | `.h2`, `text-h2` | Section or dialog title |
| **H3** | 16px | sans | 600 | `.h3`, `text-h3` | Card subtitle, empty-state title |
| **Body** | 14px / 1.5 | sans | 400–500 | `text-body` (default) | Default text |
| Label | 12.5px | sans | 600 | `.label` | Form field label |
| **Meta** | 12px | mono | 400 | `.meta`, `text-meta` | Counts, subtitles, "Showing 1–14 of 14" |
| **Eyebrow** | 11px, +0.08em, uppercase | mono | 400 | `.eyebrow` | Small label above a title ("STEP 1 OF 4", "WELCOME") |
| Hint / error | 12px | sans | 400 | `.hint`, `.err` | Help text, validation text |
| Table cell | 13.5px | sans | 400–500 | `.dtable` | Table text |
| Tag chip | 12px | sans | 400 | `.tagchip` | Tag label |
| Badge | 9.5px (card) to 11px, uppercase | mono | 600–700 | `.t-badge` | "YOURS", "PRIVATE". The card size is the smallest text in the app. Do not go smaller. |

Numbers in any column, stat or chart use `.num` or `font-variant-numeric: tabular-nums` so digits line up.

## Rules

1. **Page title = serif H1 + a Phosphor icon** in the accent colour on the left (`app-words.png`, `app-tags.png`). Add a mono `.meta` line next to it or below it for a subtitle.
2. **Never use serif for body text, buttons or form labels.** Serif is for titles and numbers only.
3. **Never use more than three sizes in one card.** Typical card: H3 or serif title, 14px body, 12px meta.
4. **Weight:** 400 body, 500 for nav and buttons and table words, 600 for titles and labels, 700 only for tiny uppercase badges.
5. **Headings use `text-wrap: balance`** (already set in `globals.css`). Do not add manual line breaks.
6. **Line length:** keep paragraphs near 34–60 characters wide. Examples: `.auth-sub` is `34ch`, `.auth-tagline` is `20ch`.
7. **Letter-spacing:** only on serif headings (slightly negative) and on mono eyebrows (positive). Never on body text.
8. **Word forms are content, not UI.** Show a stored word (for example `Haus`, `tantsima`) in the body font at 14–16px, weight 500. In landing previews (word, exercise and tag cards), words use the serif font to give them weight.
9. **Truncate with an ellipsis, not a wrap,** in tables (`.dtable td` is `nowrap`). Give long text a `title` or tooltip.
10. **All text comes from i18n.** Test the longest language. German and Estonian words are often 30–50% longer than English.

## Capitalisation

- Sentence case for titles, buttons, labels. ("New word", "Choose the words to use".)
- UPPERCASE only for mono eyebrows and badges, and for tense and mood group labels in the word form (`PRESENT`, `TIEMPO SIMPLE`). The text in the file stays lowercase; CSS does the transform.
- Language codes are uppercase two-letter codes: `EN`, `ES`, `DE`, `EE`, `FR`.
- Part-of-speech short forms are lowercase with a dot, in mono: `n.`, `v.`, `adj.`, `adv.` (`.pos-abbr`).

## Platform differences to expect

| OS | Serif renders as | Sans renders as |
|---|---|---|
| macOS, iOS | Iowan Old Style | San Francisco |
| Windows | Georgia (Charter is rare) | Segoe UI |
| Android, Linux | Georgia or the system serif | Roboto or the system sans |

Georgia is wider than Iowan Old Style, and its digits are old-style figures (some sit below the baseline). Big serif numbers can look uneven on Windows. If a serif title wraps there, give its container more room. Do not shrink the font. Check stat numbers on a Windows browser before you ship a new one.

## Known drift

- Some dialogs (`New tag`, in `app-tag-create.png`) use a sans title instead of the serif H2. Prefer the serif H2 for new dialogs.
- The `New word` page title (`app-add-word-typeahead.png`) has no page icon. The Words, Tags and Practice titles do. Prefer the icon.
