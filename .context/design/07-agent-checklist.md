# 07 — Checklist for agents that build UI

Run this list before you say a UI task is done. Each line is pass or fail.

## Before you start

- [ ] I read `README.md` and the documents that match my task.
- [ ] I looked at the matching screenshot in `assets/screens/`.
- [ ] I searched `frontend/src/components/` and `styles/globals.css` for a part I can reuse.
- [ ] If a part nearly fits, I extended it. I did not copy it.

## Colour and type

- [ ] I used tokens (`var(--accent)`, `bg-background`…). I wrote **no hex value** in a component.
- [ ] One primary (`default`) button per view.
- [ ] Small accent text uses `--accent-strong`, not `--accent`.
- [ ] Language colour appears only as a 2px card top border, a code label, or a chart series.
- [ ] Titles and big numbers are serif. Body text is sans. Small facts are mono.
- [ ] No text is smaller than 12px (the 9.5px card badge is the one exception).

## Layout

- [ ] The page uses `AppShell` with the default column, `wide`, or `SidebarLayout`. I did not write my own frame.
- [ ] One breakpoint: 920px (`useIsMobile`). I render each control once per breakpoint.
- [ ] Controls are 36px high; radius 8px for controls, 12px for cards.
- [ ] Borders are 1px `--border`. I added no shadow outside dialogs and menus.
- [ ] I did not nest a card in a card.

## Content

- [ ] Every visible string is in the i18n files for **all five** languages (EN, ES, DE, EE, FR).
- [ ] Sentence case. Buttons start with a verb.
- [ ] Every language shows with a flag **and** a code or name, in the account's order.
- [ ] No language is treated as the default or main one.

## States and behaviour

- [ ] Loading, empty, error and success states exist (`06-icons-motion-states.md`).
- [ ] Forms show errors under the field and keep the user's input.
- [ ] Destructive actions use the `destructive` variant and a confirm dialog.
- [ ] Icons are Phosphor, `bold`, with an `aria-label` when icon-only.
- [ ] Motion is 100–240ms and uses only opacity, transform, colour or width.

## Verify in the browser

- [ ] Light mode and dark mode both look right.
- [ ] 375px wide: no horizontal page scroll (inside a table wrapper is fine).
- [ ] 1440px wide: content is in the expected column.
- [ ] German or Estonian text does not break the layout.
- [ ] Keyboard: I can reach and use every control. Focus ring is visible.
- [ ] The Playwright e2e spec for this phase still passes (`npm run test:e2e`).

## Finish

- [ ] If I added or changed a pattern, I updated the matching document here and added a screenshot.
- [ ] I did not copy anything from a "Known drift" part.

## Quick answers

| Question | Answer |
|---|---|
| Which blue? | `var(--accent)` for fills. `var(--accent-strong)` for small text. |
| Which grey for secondary text? | `var(--muted)` |
| Card background and border? | `.card` (`--surface`, 1px `--border`, 12px radius) |
| Hover wash? | `--fg-soft` (or `--hover` in tables) |
| Selected wash? | `--accent-soft` |
| Error colour? | `--danger` text on `--danger-soft` |
| Page title? | Serif `.h1`, Phosphor icon in accent on the left |
| Small label above a title? | `.eyebrow` (mono, uppercase) |
| Which radius? | 8px control, 12px card, 999px chip |
| How do I show a language? | Flag + code, 2px top border in `langTint(lang)` on its card |
| Where is the breakpoint? | 920px |
