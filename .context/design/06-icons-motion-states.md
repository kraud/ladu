# 06 — Icons, flags, motion and states

## Icons

Library: **Phosphor** (`@phosphor-icons/react`). Import with the `Icon` suffix: `import { TagIcon } from '@phosphor-icons/react'`. Use no other icon set.

| Property | Value |
|---|---|
| Weight | `bold` is the default (48 uses in code). `fill` only for a filled state or a seal (5 uses). `duotone` is rare. |
| Size | 16px in buttons and nav, 22px beside a page title, 10–14px inside chips and badges, 40–44px in an empty state. |
| Colour | `currentColor`. Nav icons follow the nav text. Page title icon and quick-action icon use `--accent`. Muted helper icons use `--muted`. |
| Decorative icon | `aria-hidden`. |
| Icon-only button | Needs an `aria-label` (and usually a tooltip). |

Icon meaning (stay consistent):

| Meaning | Icon seen in the app |
|---|---|
| Words | translate (文A) |
| Tags | tag |
| Practice | brain |
| New / add | plus |
| Random practice | shuffle |
| Edit | pencil |
| Delete / remove | trash |
| Private | lock |
| Public | globe |
| Verified | seal-check (fill) |
| Followers | users |
| Hint | lightbulb |
| Correct / wrong | check / x |
| Save | floppy disk |
| Back | arrow-left |
| Expand / collapse | caret down / up |
| Start from a word (smart add) | sparkle |
| Theme | moon (go dark) / sun (go light) |
| Welcome | waving hand |

Do not use an emoji as an icon. Do not draw a new icon when Phosphor has one.

## Flags

- Component: `components/common/FlagIcon.tsx`. Pass the key (`EN`) or label (`English`).
- Files: `frontend/public/{GB,ES,DE,EE,FR}.svg`. **English uses the GB flag.**
- Box: 16×16 by default; `16×12` in tag cards. Radius 3px, `object-fit: cover`.
- A flag next to text is decorative. Give it a `title` only when it stands alone.
- `muted` prop: grayscale at 60% opacity. Use it for a language that is **not in use** (for example not selected in Practice).
- Always show a flag **and** the language code or name. A flag alone is not enough (colour-blind users, and flags do not equal languages).
- Order: the account's language order. Never sort EN or ES first on purpose.

## Motion

Motion is short and quiet. There is no animation library. Use CSS transitions and the `tw-animate-css` classes already in the primitives.

| Where | Effect | Time |
|---|---|---|
| Hover on nav, rows, icon buttons | Colour or background change | 80–120ms, `ease` |
| Chip and tile selection | Border, background, check swap | 100–150ms |
| Page enter (`PageTransition`, `.page`) | Fade in + rise 4px | 240ms |
| Dialog and menu open | Fade + scale from 95% | 100–150ms |
| Sheet (phone sidebar) | Slide 2.5rem + fade | 200ms |
| Progress bar fill | Width change | 200ms |
| Segmented toggle thumb | Slides to the new segment | short |
| Button press | Moves down 1px | instant |
| Skeleton | Shimmer sweep | 1.3s loop |

Rules:
- Animate only opacity, transform, colour, background and width.
- No bounce, spin (except the loading spinner), shake or confetti.
- Respect `prefers-reduced-motion`. The app already does this for the page enter, skeleton, onboarding and demo transition (`globals.css`, `onboarding.css`, `features/demo/transition.ts`). When you add a new animation, add the same guard. Component transitions in `components/ui/` have no guard yet. Treat that as a gap, not a pattern.
- Never animate content the user is reading or typing in.
- The demo start transition (`.demo-transition`) is the only full-screen animation: one line at a time, then a fade. Do not copy it into other flows.

## States

Every list, page and form needs all of these.

| State | Pattern | File | Look |
|---|---|---|---|
| **Loading (page)** | Skeleton | `components/ui/skeleton.tsx`, `.skeleton` | Rounded 6px blocks with a shimmer. Match the final layout (for example `.sk-num` 90×34, `.sk-label` 130×14). |
| **Loading (app start)** | `LoadingScreen` | `components/common/LoadingScreen.tsx` | Centred, minimal. |
| **Loading (button)** | `.spinner` | `globals.css` | Small ring that uses `currentColor`. Disable the button too. |
| **Saving** | Loading toast that turns into success or error | `lib/toast.tsx` | "Saving…" becomes "Saved" with an optional action link. |
| **Empty** | `EmptyState` | `components/common/EmptyState.tsx`, `.empty` | 44px rounded `--fg-soft` square with a muted icon, `h3` title, muted line, optional action. 44px vertical padding. |
| **Error (page)** | `ErrorState` | `components/common/ErrorState.tsx` | Centred `h3` "Something went wrong", mono message, outline "Try again". `role="alert"`. |
| **Error (field)** | `.err` | `globals.css` | 12px `--danger` text under the field, danger ring on the input. |
| **Error (action)** | Error toast | `react-toastify` | Say what failed and what to do. |
| **Success** | Green check + `--success-soft` fill | practice answers, toasts | Short text. No celebration. |
| **Warning** | `.banner.warning` | `globals.css` | `--warning-soft` fill, `--warning` text, 13.5px, 8px radius. Underlined bold link for the fix. |
| **Info** | `.banner.info` | `globals.css` | `--accent-soft` fill, `--accent-strong` text. |
| **Disabled** | 45% opacity | `Button`, `.chip:disabled` | Keep it visible. Add a hint that says **why** (for example Practice "Advanced" rows). |
| **Not built yet** | 50% opacity card with italic text "not implemented yet" | add-word type grid (`app-add-word-typeahead.png`) | Show honestly. Do not hide it. |
| **Offline or long task** | Toast, no modal | — | Do not block the page. |

Toasts use `react-toastify`. Keep them short. One sentence. Put an action link inside the toast body when there is a next step ("Open word").

## Responsive behaviour (summary)

| At 920px or less | Change |
|---|---|
| Header | Same items, tighter. Check that nav and controls fit at 375px. |
| Page padding | 12px sides, 8px top. |
| Sidebar | Becomes a slide-in sheet with a trigger button. |
| Table | Natural width, horizontal scroll inside the wrapper. Long press selects a row. |
| Grids | One column (tag grid under 640px). |
| Choice controls | Chips replace radio lists (`OptionRow`). |
| Auth and onboarding | The brand rail turns into a compact or sticky top bar. |
| Landing previews | All three show at once, left and right in turn. |

Test every new UI at **375px**, at **1440px**, in **light and dark**, and with **German or Estonian** text.

## Accessibility baseline

- Focus ring: `2px solid var(--accent)`, offset 2px (global `:focus-visible`). Do not remove it.
- Every control is reachable with the keyboard. Practice answers also accept the keys `1`, `2`, `3`.
- Colour is never the only signal.
- Touch targets: 36px or more on a phone where you can (choice rows are 44px).
- Use real `button`, `a`, `label`, `table`, `header`, `main` elements. Give dynamic errors `role="alert"`.
- Give every image either empty `alt` (decorative) or a real name.
