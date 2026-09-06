# UI Spec — Global conventions & index

*2026-09-05. Screen-by-screen UI blueprint for the reimplementation frontend, distilled from the snapshot behavior inventories. **Design is intentionally neutral** — this spec fixes structure, hierarchy, states, and interactions, not branding. Target stack: Tailwind v4 + shadcn/Base UI + Phosphor icons; React 18; TanStack Router + Query; RHF + yup; i18next (all copy through translation keys, 4 UI languages EN/ES/DE/EE). Feed files 00→06 in order.*

Files:
1. `00-global.md` (this file) — shell, navigation, shared patterns, states
2. `01-auth.md` — Login, Register, Email verification, Reset password, 404
3. `02-dashboard.md` — Dashboard
4. `03-word-editor.md` — Add/Edit word, translation forms
5. `04-review.md` — Review table
6. `05-practice.md` — Exercise parameter menu, cards, results
7. `06-social.md` — Account, Notifications, Tag view, modals

---

## 1. App shell

```
┌──────────────────────────────────────────────────────┐
│ Header (sticky top)                                   │
│  [logo → /] [Add Word] [Practice] [Review]   [search] │
│                                    [EN ▾] [🔔3 avatar]│
├──────────────────────────────────────────────────────┤
│ Content: centered container, max-w-5xl, px-6, py-8    │
│   <page>                                              │
└──────────────────────────────────────────────────────┘
```

- **Header** (`AppHeader`): always present for authenticated routes. On mobile collapse nav + search into a hamburger `Sheet`.
  - Left: logo (click → `/`).
  - Nav: `Add Word` (→ `/addWord`), `Practice` (→ `/practice`), `Review` (→ `/review`). Active item visually emphasized. Business rule: Add Word and Review require the user to have **≥2 languages** configured; if not, show a toast with a button "Go to Account" (→ `/user`).
  - Right: global search input with a **word/tag mode Switch**; selecting a word result → `/word/:id`, a tag result → `/tag/:id`. Language selector dropdown (EN/ES/DE/EE) — selecting persists `uiLanguage` via profile update. Avatar (initials, deterministic bg color) with unread-notification **badge** (count of non-dismissed); avatar menu: Dashboard, Account, Notifications, Logout.
- **Header visibility**: hidden on `/login`, `/register`, `/user/:id/verify/:token`, `/resetPassword/**` (route-config table, not page callbacks).
- **Content container**: single centered column, `max-w-5xl`; Review may go wider (`max-w-7xl`).
- **Page transition**: simple CSS fade/slide-in on route change (no JS animation lib needed).

## 2. Route map & guards

| Route | View | Guard |
|-------|------|-------|
| `/` | Dashboard | protected |
| `/addWord/:partOfSpeech?` | Word editor (create) | protected |
| `/word/:wordId` | Word editor (view/edit) | protected |
| `/review/:filtersURL?` | Review table | protected |
| `/practice` | Exercise flow | protected |
| `/user` | Account | protected |
| `/user/:userId/notifications` | Notification inbox | protected |
| `/tag/:tagId` | Tag view | protected |
| `/login`, `/register` | Auth | public |
| `/user/:userId/verify/:tokenId` | Email verification | public (link) |
| `/resetPassword/:userId?/:tokenId?` | Reset password | public |
| `*` | 404 | public |

- One `ProtectedRoute` wrapper for **every** protected route (fixes the old app's unauthenticated-render bug).
- Detail routes with optional params double as create modes (`/addWord` = create; `/word/:id` = edit/view).

## 3. Shared UI patterns

| Pattern | Specification |
|---------|--------------|
| **Language identity** | Every language is shown as a **country flag icon** (EN=GB, ES, DE, EE) optionally with its native name (Deutsch / Eesti / English / Español). Used in headers of translation forms, exercise cards, table column headers. |
| **Forms** | shadcn `Form` + RHF + yup. Label above field; validation errors inline below field, red; Enter submits; submit button `disabled` while saving (with inline spinner) or when invalid. |
| **Dialogs** | shadcn `Dialog` for content modals (word editor-in-cell, tag info, friend search). Destructive confirmations use `AlertDialog` (replaces the old two-step inline confirm button). |
| **Toasts** | bottom-center; `success`/`error`/`warning`/`info`; one toast per action (deduped); success toasts may include an action link (e.g. "See details" → `/word/:id`). |
| **Loading** | Page-level: skeleton placeholders matching final layout. Buttons: inline spinner. Tables: skeleton rows. Never block the whole page behind a spinner when a section can load independently. |
| **Empty states** | Centered icon + one-line message + primary CTA (e.g. "No tags yet" → "Create your first tag"). |
| **Errors** | Toast with message + optional Retry; inline alert for form errors. |
| **PoS selector** | Radio group of 4 cards (Noun/Verb/Adjective/Adverb) with icons; used standalone (first step of Add Word) and inline. |
| **DnD lists** | @dnd-kit two-container sortable with click-to-move (+/−) buttons as fallback; drag threshold 5px. Invariant: minimum 2 languages selected. Native-language pin button on items. |
| **Completion indicator** | A small progress ring or `x/y cases` badge showing how complete a translation is (cases filled / max cases for that PoS+language). Shown on hover in table cells; shown as a ring on avatars/cards where relevant. |
| **Feature flags** | Build-time flags equivalent to the old `checkEnvironmentAndIterationToDisplay` — tags (iter 2), search (iter 2), notifications (iter 3), friends (iter 4). New repo: env-based flags, default all-on. |

## 4. Interaction & data conventions (fixing old defects)

These are **intentional deltas** vs the old app — build the fixed behavior:

1. **All protected routes guarded** (old: Practice/Account/Notifications/Tag rendered unauthenticated).
2. **Selection by stable id** everywhere (old Review table selected rows by array index → wrong row under filters).
3. **Filters/params live in the URL** (searchParams), so reload/share restores state; word lists are paginated (cursor + `useInfiniteQuery`, load-more button or infinite scroll).
4. **401 → clear session + redirect to /login** (interceptor).
5. **Notifications are a display-only inbox**; pending actions (friend request, tag share) render from domain queries with **explicit accept/decline** — decline is a new capability.
6. **Tag share accept/decline** replaces the old notification-dismissal-as-state.
7. **One mutation per action** — no multi-wait "flag machines"; toasts fire from mutation `onSuccess/onError`.
8. **Language ordering** is user preference data (`languages` array order) — ordering UI writes it, everything else (table columns, exercise generation) reads it.

## 5. Visual baseline (neutral, professional)

- Font: Inter (or system stack); base 16px; headings 600 weight.
- Palette: zinc/slate neutrals + one accent (indigo or teal); success=green, destructive=red, warning=amber — shadcn defaults are fine.
- Cards: `rounded-lg border bg-card` with subtle shadow; consistent 16px internal padding.
- Buttons: primary (solid accent), secondary (outline), ghost (text); destructive red.
- Spacing: 4px grid; sections separated by 24–32px.
- Focus: visible focus rings everywhere; all interactive elements are real buttons/links (no clickable divs).
- Dark mode: not required for v1; use CSS variables so it can be added later.
