# Auth and app shell

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

## 2. Invariants

- One `ProtectedRoute` gate on every guarded route. Practice, Account and every page after them are inside it.
- One session shape in Zustand `persist`, with a guarded parse. Never write `JSON.parse(localStorage['user'])`.
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
