# 02 — Colour

Source: `frontend/src/styles/tokens.css`. Brand pass on 2026-09-21 moved the accent from a teal placeholder to the real brand blue and cooled the neutrals.

## The rule

**Use tokens. Never write a hex value in a component.** Tailwind and shadcn names are mapped to the tokens, so `bg-background`, `text-muted-foreground` and `border-border` are valid.

## Six seed colours

Light and dark mode change only these six. Every other tone is derived from them with `color-mix`, so it follows the theme on its own.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#f7f8fa` | `#121417` | Page background |
| `--surface` | `#ffffff` | `#1b1e23` | Cards, inputs, popovers, table body |
| `--fg` | `#1a1c20` | `#eef0f4` | Main text, icons on neutral |
| `--muted` | `#666b73` | `#9aa0aa` | Secondary text, labels, placeholders |
| `--border` | `#e3e5ea` | `#2c3036` | Every 1px line |
| `--accent` | `#007aff` | `#4da3ff` | Brand blue: primary button, focus ring, active marks, charts |

## Accent variants

| Token | Light | Dark | Use |
|---|---|---|---|
| `--accent-strong` | `#0062cc` | `#7cbaff` | Accent as **small text** (links, active nav label, `.chip` active). `--accent` is only 3.8:1 on `--bg` (4.0:1 on `--surface`). The strong value reaches 5.5:1 on `--bg` (5.8:1 on `--surface`). |
| `--accent-ink` | `#ffffff` | `#062a52` | Text on an accent fill (primary button label) |
| `--accent-soft` | accent 12% | accent 12% | Active nav item, selected row, info banner |
| `--accent-soft2` | accent 22% | accent 22% | Hover on a selected row, chip border when active |

**Rule:** fills, rings, marks and chart series use `--accent`. Text under about 18px uses `--accent-strong`.

## Derived neutrals (do not change)

| Token | Formula | Use |
|---|---|---|
| `--fg-soft` | `--fg` 5% | Hover wash, tag chip fill, skeleton base |
| `--fg-soft2` | `--fg` 10% | Stronger hover, avatar fill, toggle track |
| `--hover` | `--fg` 4% over `--surface` | Table row hover |
| `--border-strong` | `--fg` 25% | Rare: emphasised outline |

These four mix in **sRGB**, not OKLCH. The dark seeds are nearly neutral. An OKLCH mix on them shows a faint red tint. Keep the sRGB mix.

## State colours

| Token | Light | Dark | Soft fill | Use |
|---|---|---|---|---|
| `--success` | `#1a7f37` | `#4cc36b` | `--success-soft` (12%) | Correct answer, neuter gender chip, "public" badge |
| `--danger` | `#c03038` | `#f0686f` | `--danger-soft` (11%) | Error text, delete, feminine gender chip, missing dot |
| `--danger-ink` | `#ffffff` | `#2a0a0c` | — | Text on a danger fill |
| `--warning` | `#a35a0a` | `#e0a03c` | `--warning-soft` (14%) | Incomplete words, "private" badge, unverified banner |

Pattern: a state shows as a **soft fill + a solid text colour of the same hue**. Example: `.banner.warning` uses `--warning-soft` behind `--warning` text.

## Language identity colours

Each language owns one colour. Flags are the source, then the hue is adjusted for contrast.

| Language | Token | Light | Dark |
|---|---|---|---|
| English | `--lang-gb` | `#2c4a8a` | `#7f9fe0` |
| Spanish | `--lang-es` | `#b8352f` | `#ef7d76` |
| German | `--lang-de` | `#42403c` | `#b4b0a6` |
| Estonian | `--lang-ee` | `#2265a8` | `#6fb0ec` |
| French | `--lang-fr` | `#6a3fa0` | `#b79af0` |

English uses the GB flag, so its token is `--lang-gb`. The French violet is not a flag colour. The tricolour left no hue that differs from the other four.

**Get a language colour in code:** `langTint('English')` or `langTint('EN')` from `frontend/src/lib/language.ts`. It returns `var(--lang-…)`.

**Where language colour appears (and only there):**
- A 2px **top border** on a language's card (`TranslationCard`, `SensePreview`). See `app-word-detail.png`.
- The language rows of the landing word card (EN, ES…): 2px top border, 7% tint, and the code in the language colour.
- The masculine gender chip (`--lang-gb`).
- Chart series (see below).

**Do not** use a language colour as a general-purpose accent, a button colour, or a background for large areas.

## Chart colours

| Series | Colour |
|---|---|
| Noun | `--accent` |
| Verb | `--lang-es` |
| Adjective | `--warning` |
| Adverb | `--lang-gb` |
| Conjunction | `--lang-ee` |
| Preposition | `--lang-de` |

Source: `features/metrics/components/charts/chartColors.ts`. The part-of-speech colours re-use language tokens. This is a shortcut, not a link. A red verb slice does not mean "Spanish". If a chart ever shows languages and parts of speech together, give parts of speech their own colours.

## Dark mode

- The theme is `data-theme="dark"` on `<html>`. `frontend/index.html` sets it before React loads, so there is no flash.
- The saved choice is `localStorage['ladu.theme']`. With no saved choice, the OS setting decides.
- In dark mode the accent is **lighter** (`#4da3ff`), and `--accent-strong` is lighter still. Do not reuse the light-mode strong blue on a dark ground.
- Dark surfaces step up in lightness: `--bg` `#121417` → `--surface` `#1b1e23`. Do not use pure black or pure white.
- A tinted panel (auth, onboarding) uses `color-mix(in srgb, var(--fg) 4%, var(--bg))`.

## Contrast

Ratios below are measured from the token values (WCAG 2.x). The AA bar is 4.5:1 for body text.

| Pair | Light | Dark |
|---|---|---|
| `--fg` on `--bg` | 16.1 | 16.2 |
| `--muted` on `--bg` | 5.1 | 7.0 |
| `--muted` on `--surface` | 5.4 | 6.4 |
| `--accent` on `--bg` | 3.8 (fails AA for text) | 7.0 |
| `--accent-strong` on `--bg` | 5.5 | 9.1 |
| `--accent-ink` on `--accent` (button label) | **4.0** (fails AA for 14px text) | 5.5 |

- Body text on `--bg` or `--surface`: `--fg`.
- Secondary text: `--muted`. Do not go lighter.
- Small accent text: `--accent-strong`. Never `--accent`.
- Never put `--muted` text on a coloured fill.
- Never use colour alone for state. Pair it with an icon or text (the correct answer has a green fill **and** a check icon).
- The primary button in light mode is white on `#007AFF`. That is 4.0:1, under AA for 14px/500 text. Keep the label at weight 500 or more and do not make it smaller. See "Known drift".

## Brand files

The logo is always `#007AFF` (light) with the speech-bubble shape. Files: `assets/brand/`.

| File | Use |
|---|---|
| `Ladu_title_with_icon.svg` | App header logo (word "ladu" + small outline bubble). On the landing home page it sits above the headline (below 1600px wide). |
| `Ladu_bubble_filled.svg` | Filled bubble, favicon base |
| `Ladu_inside_bubble_outline.svg` | Large mark: auth and demo screens, and the landing hero at 1600px wide and up (word inside an outlined bubble) |

## Known drift

- The old pass kept two sets of neutrals (warm and cool) "for A/B testing". Only the cool set is live. The comments in `tokens.css` still mention the warm values. Ignore them.
- **Moderate:** white text on the brand blue (`#007AFF`) is 4.0:1. It misses AA (4.5:1) for small text. This is a brand choice, so do not "fix" it in one component. If the team decides to fix it, change `--accent-ink` use or darken the button fill in one place (`button.tsx` `default` variant).
- The landing page (`landing/`) has its own CSS (`landing/style.css`). It copies the dark values from `tokens.css`. If you change the dark tokens, change `landing/style.css` too.
