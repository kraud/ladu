# Ladu design system — start here

This folder tells you how Ladu looks and why. Read it before you build or change any component, layout or page.

All facts here come from two sources: the real screenshots in `assets/screens/` and the real code in `frontend/src/`. Nothing is invented. When the code and a document disagree, **the code wins**. Then fix the document.

## Open the mood board first

Open [`mood-board.html`](mood-board.html) in a browser. It shows the palette, type, patterns and screens on one page. It has a light and dark switch.

## Documents

| File | Read it when you… |
|---|---|
| [01-principles.md](01-principles.md) | decide *what* to build. Seven rules and the tone of the product. |
| [02-colour.md](02-colour.md) | pick any colour. Tokens, dark mode, state colours, language colours. |
| [03-typography.md](03-typography.md) | add any text. Three font roles and the size scale. |
| [04-layout.md](04-layout.md) | build a page. Shell, header, sidebar, widths, breakpoint, split layouts. |
| [05-components.md](05-components.md) | build a part of a page. Every pattern, with the file to reuse. |
| [06-icons-motion-states.md](06-icons-motion-states.md) | add an icon, an animation, or a loading, empty or error state. |
| [07-agent-checklist.md](07-agent-checklist.md) | finish a UI task. A pass/fail list to run before you say "done". |

## The 60-second summary

- **One brand colour:** blue `#007AFF`. Everything else is cool grey.
- **Three fonts, three jobs:** serif for titles and big numbers, sans for body, mono for small facts (counts, labels, steps).
- **Languages have colours and flags.** A card for one language gets a 2px top border in that language's colour. No language is "primary".
- **Flat and quiet.** 1px borders, almost no shadow, 8px controls, 12px cards. Colour carries meaning, not decoration.
- **Light and dark mode** both work. You change six seed colours; every other tone follows.
- **One breakpoint:** 920px. Below it, the layout is a phone layout.
- **Use tokens, never hex.** Use `var(--accent)`, not `#007AFF`.
- **Reuse before you build.** Check `frontend/src/components/` and the classes in `frontend/src/styles/globals.css` first.

## Source of truth in code

| What | File |
|---|---|
| Colour, font and radius tokens | `frontend/src/styles/tokens.css` |
| Component classes (`.card`, `.chip`, `.dtable`, `.stat-card`…) | `frontend/src/styles/globals.css` |
| Onboarding styles | `frontend/src/styles/onboarding.css` |
| Primitives built on shadcn and Base UI | `frontend/src/components/ui/` |
| Shared parts (flags, tag chip, empty state…) | `frontend/src/components/common/` |
| App frame (header, shell, sidebar) | `frontend/src/components/layout/` |
| Language list, flags, colours | `frontend/src/lib/language.ts` |
| Theme switch | `frontend/src/lib/theme.ts` |
| Brand files | `frontend/public/brand/` (copies in `assets/brand/`) |

## How to keep these documents true

- When you change a token, a class or a pattern, change the matching document in the same pull request.
- When you add a new pattern, add a screenshot to `assets/screens/` and a row to `05-components.md`.
- Each document has a "Known drift" or "Do not" part. Add to it when you find code that breaks a rule. Do not copy that code.

## Screenshot index

All files are in `assets/screens/`. Size is 1440×900 unless noted.

| Group | Files |
|---|---|
| Landing | `landing-hero-words` (**current design**, 2559×1289, a 1600px+ window), `landing-hero-practice-choice`, `landing-hero-practice-typed`, `landing-hero-tags`, `landing-hero-dark`, `landing-mobile` (375×1027) |
| Auth and demo | `login-google`, `signup-account`, `demo-start`, `demo-languages` |
| Onboarding | `onboarding-1-welcome`, `-2-languages`, `-3-level`, `-4-interests`, `-5-count`, `-6-result` (1425×939), `-7-tags` |
| Dashboard | `app-dashboard` |
| Words | `app-words`, `app-word-detail` (1440×1450) |
| Add word | `app-add-word`, `app-add-word-typeahead`, `app-add-word-preview`, `app-add-word-draft` |
| Tags | `app-tags`, `app-tag-detail`, `app-tag-create` |
| Practice | `app-practice-configs`, `app-practice-exercise`, `app-practice-feedback` |

The app screenshots show the demo account in light mode. Only `landing-hero-dark` shows dark mode.

**Landing screenshots are partly out of date.** Only `landing-hero-words` shows the current design (logo above the headline, flat word card, five languages). The others (`landing-hero-practice-*`, `landing-hero-tags`, `landing-hero-dark`) still show the older 1440px layout: small header logo, a speech-bubble frame in the dark one, four languages, and the "practise" spelling. `landing-mobile` also shows a bubble-framed card and four languages. Use them for the card and phone patterns only, and take the layout from `04-layout.md`. Replace them when you can.
