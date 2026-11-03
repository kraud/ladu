# Auth and app shell

## Summary

A person registers, verifies the email, signs in and resets a password. After sign-in, the app shell gives the header with the navigation, the language switch and the user menu. The Account page lets the person change name, username, languages, native language and mastered language pairs, in two cards. The home page started as a welcome banner; `/` is now the dashboard.

Live spec. It replaces a finished plan (archive record: `.context/archive/2026-09-phase-1-auth-app-shell.md`). Built 2026-09-08 to 2026-09-10, merged as PR #1. Gate: `e2e/tests/phase-1-auth.spec.ts`. Later additions: OAuth sign-in (`features/oauth-login-strategy.md`), access gates (`features/access-control.md`), the theme switch (`features/theme-and-language.md`).

Code map: `frontend/src/api/` (one axios client), `stores/` (Zustand session and UI state), `app/` (router, query client), `routes/` (`ProtectedRoute`, layouts, 404), `components/layout/` (`AppShell`, `AppHeader`, `LanguageSelector`, `UserMenu`), `features/auth/`, `features/account/`, `features/metrics/` (welcome banner), `styles/` (`tokens.css`, `globals.css`).

## 1. Decisions

| ID | Decision | Rejected option |
|---|---|---|
| P1-1 | Unverified users are blocked. Login with `verified !== true` shows a warning toast and writes **no** session. Register (which returns no token) shows an info toast with the email and goes to `/login`. So `VerifyEmailBanner` has no use and was dropped. | Log in unverified, with a banner. |
| P1-2 | shadcn is initialised with the CLI, but its semantic tokens are bridged onto the Ladu tokens with `@theme inline`. Generated components are not hand-edited. Lucide icons are swapped for Phosphor. | Hand-written primitives. |
| P1-3 | The password hash and `passwordTokens` never leave the backend: `serializeUser` is an allowlist, and `userColumnsWithoutPassword` has no `passwordTokens`. | None. |
| P1-4 | New i18n keys land in all four locales (en, es, de, ee) in the same change. Estonian text is flagged for the user to check. | English first. |
| P1-5 | The home page `/` is only the welcome banner (the name and a greeting that cycles EN, ES, DE, EE) with an empty-state link to Add Word. It has no `useQuery`. The metrics endpoint aggregates words and translations only, so on a new account every number is zero. | A full dashboard in Phase 1. |
| P1-6 | The full dashboard is its own feature (`features/dashboard.md`). | None. |
| P1-7 | Phase 1 shipped no `useQuery`: the read path was first used in the word feature. | None. |
| P1-8 | Registration has a language step (`users.languages`, at least 2, in selection order, checked by the backend). The public routes have a UI-language selector. It is kept by the i18next detector cache and written to `users.uiLanguage` on the login and register requests. | None. |
| P1-9 | `/user` (Account) lets the user edit name, username and languages. `updateUser` checks `languages` (at least 2, like registration). An account with zero languages gets a warning banner. The full Account page with tags and friends stays for the social phases. | None. |
| P1-10 | `/user` has two cards. The account card (name, username, email, sign-in methods, Logout) and the languages card (selected languages, native language, mastered language pairs) take half of the row each. Below 920px they stack, account card first. Each card has its own edit button and form (`AccountDetailsForm`, `LanguagesForm`). Only one card is edited at a time: while one is in edit mode, both edit buttons are hidden. While a card is edited, Save and Cancel replace its header buttons (in the account card they replace Edit profile and Logout, so Logout is hidden), and the edit form draws the whole card. Both cards share one frame (`CardFrame`), so their headers have the same height and layout: a 56px lead on the left (the avatar, or an accent-colour translation icon), the name or the title beside it, and the buttons on the right. The languages card has a title and no subtitle. Its edit form shows the hint of each field under the field's title (the long mastered-pairs hint stays at the bottom), the native language as one badge out of the selected languages (a second click clears it), and the mastered pairs as a list under their title with the two pickers and Add pair on one row below it. A pair shows as `English & Español`. The account card's name and username stay on separate rows. Each form sends only its own fields plus `email`, because `updateUser` keeps every field that is absent. A demo account has no edit button on the account card (it cannot change its name or username, `demo-access.md` D10), only the lock note. | Rejected: one card with one form (the old layout), and a full payload from each card (a stale value of the other card could overwrite newer data). |

## 2. Invariants

- One `ProtectedRoute` gate on every guarded route. Practice, Account and every page after them are inside it.
- One session shape in Zustand `persist`, with a guarded parse. Never write `JSON.parse(localStorage['user'])`. A session restored from storage runs through `toSessionUser` like every other way into the store, because a browser keeps its session across a deploy: a field added later (for example `masteredLanguagePairs`) must read as its empty value for a user who was signed in before, never as `undefined`. When you add a field to `SessionUser`, give it its default in `toSessionUser`.
- One axios client with a request interceptor. A 401 clears the session and redirects. No refresh endpoint exists.
- All server state is in TanStack Query. A mutation uses `isPending`, `isError`, `onSuccess` and `onError`, never a status boolean.
- Responses and types use `id` only. `_id` is a MongoDB artifact.

## 3. Traps

- Run `shadcn init` after you commit the config changes, so any damage is a visible diff. Keep the Ladu token files authoritative.
- `@theme` cannot hold `color-mix()` values. A derived tone that must be a utility has to be flattened to a literal.
- `noUnusedLocals` and `noUnusedParameters` are on, and `build` runs `tsc -b`. Generated shadcn components can carry unused props. Trim them. Do not relax the compiler options.
- A second i18next namespace needs the Suspense boundary of the app plumbing, or the app throws.
- `ee` is not an ISO code for Estonian (`et` is). The language detector never finds it. This was carried over on purpose. Do not change it without a migration.
- `button.tsx` is wrapped in `forwardRef` (React 18 ref support, first needed by `sheet.tsx`).

## 4. Open items

Closed 2026-11-02 (confirmed by the user): the review of the ES, DE and EE texts of the account page and the registration language step.

1. `sendMail` never rejects: it catches its own errors and logs them, so delivery is unknown (see `features/admin.md`). Its `Boolean("false") === true` flag issue was logged for later and is not fixed.
