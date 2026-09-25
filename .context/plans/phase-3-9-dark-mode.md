# Phase 3.9 — Dark mode + small fixes

## Context

Added 2026-09-25 (see `new-repo-build-plan.md` §5). This phase adds a light/dark theme to three
places: the landing page (`landing/`), the auth screens and the logged-in app. The landing page
also gets a language selector. The theme and the language must carry over: landing → auth screens →
logged-in app.

Only **light** and **dark** are offered. There is no "system" option in the switch. The OS
preference is used only as the **start value** (D1).

The user will list the "small fixes" after the dark-mode slices are done. They become Slice 7+.

## Decisions taken with the user

- **D1 — Start value = OS preference (2026-09-25).** A first visit with no stored choice follows
  `prefers-color-scheme`. The switch itself only has light and dark. The OS value is **not saved**
  until the user presses the switch. So a visitor who never touches the switch keeps following the
  OS.
- **D2 — Storage = user row + browser (2026-09-25).** A new `users.theme` column
  (`'light' | 'dark'`, nullable), same pattern as `users.uiLanguage`. Also `localStorage` in the
  app and on the landing page.
- **D3 — Landing → app handoff = URL parameters (2026-09-25).** The landing (`ladu.com.ar`) and the
  app (`app.ladu.com.ar`) are different origins. `localStorage` does not carry over. The landing
  links add `?lng=es&theme=dark`. The app reads them once, saves them, and removes them from the
  URL. i18next already reads `?lng=`.
- **D4 — Landing texts (2026-09-25).** Claude drafts ES/DE/EE. The EE text is flagged for user
  review.
- **D5 — Small fixes (2026-09-25).** Not defined yet. The user adds them after Slice 6.

### Calls made by the agent rather than asked — each reversible

- **D6 — Precedence on the client.** Highest first: `?theme=` in the URL → saved browser choice →
  OS preference. The URL wins because it carries the latest choice made on the landing page.
- **D7 — Login sends the theme only if the user chose it.** `uiLanguage` is always sent at login
  and overwrites the user row. If theme did the same, a user who logs in on a new device (OS
  default, no choice made) would overwrite the theme they saved on another device. So: send `theme`
  only when a saved browser choice exists. Otherwise send nothing. The backend then keeps the row
  value, and the app applies it after login. If the row is empty (existing users), the app keeps the
  current theme and does not write it.
- **D8 — Attribute, not class.** The theme is `data-theme="light|dark"` on `<html>`. This is what
  `tokens.css:1-9` already planned. The shadcn variant in `styles.css:11` changes from
  `.dark` to `[data-theme="dark"]`. Also set `color-scheme` per theme so native controls and
  scrollbars follow.
- **D9 — No flash.** A small inline script in `frontend/index.html` sets `data-theme` before the
  first paint. The React store reads the same value.

## What the exploration established

- **Tokens**: `frontend/src/styles/tokens.css` holds six seed colours (`--bg`, `--surface`, `--fg`,
  `--muted`, `--border`, `--accent`). The derived tones use `color-mix()`, so they recompute. Dark
  overrides are: seeds + `--accent-strong`/`--accent-ink`, `--lang-*`, `--success`, `--danger`,
  `--warning`.
- **Dark values exist**: `landing/style.css:28-45` already has a dark palette (under
  `prefers-color-scheme`). Reuse it, so the app and the landing page match. `landing/style.css`
  says the two files are "kept in sync by hand".
- **Hard-coded colours to audit**: `frontend/src/styles/globals.css` (4 hex values),
  `components/common/GoogleIcon.tsx` (brand colours — keep), `lib/avatar.ts`, and the chart
  colours in `features/metrics/components/charts/` (`chartColors.ts`).
- **Language selectors — the two patterns to copy**:
  `components/layout/PublicLanguageSelector.tsx` (public: `i18n.changeLanguage`, cached in
  `localStorage['i18nextLng']`) and `components/layout/LanguageSelector.tsx` (header: saves through
  `useUpdateProfile`, full payload). Slots: `.auth-lang` in `AuthLayout.tsx`; `AppHeader.tsx:81`.
- **Backend**: `users.ui_language` and `users.native_language` are `varchar` in
  `backend/src/db/schema.ts:63-64`. `theme` follows the same shape. Paths to cover: register,
  login, OAuth callback, `updateUser`, and the `serializeUser` allowlist.
- **Landing**: plain static HTML, no JS (`landing/index.html`, 55 lines). The language list is
  `<p class="note">` in `.hero-copy` (left side). `landing/Dockerfile` lists files by name, so a new
  JS file needs a new `COPY` entry.

## Slices

Each slice ends with something runnable. The user reviews and commits between slices.

| Slice | Scope | Status |
|---|---|---|
| 0 — persist the plan | This file. Row status in `new-repo-build-plan.md` §9. | ✅ done 2026-09-25 |
| 1 — dark palette + theme store + no-flash script + `ThemeToggle` on the auth screens | `tokens.css` dark block; `styles.css` variant; `index.html` inline script; `lib/theme.ts` (external store, see outcome); `components/layout/ThemeToggle.tsx` + `PublicThemeToggle.tsx`; slot in `AuthLayout` next to `PublicLanguageSelector`; hard-coded-colour audit; tests. | ✅ done 2026-09-25 — frontend **660/660**, `tsc -b` + eslint + `vite build` green |
| 2 — backend `users.theme` | Drizzle migration; validation; register/login/OAuth signup/`updateUser`; serializer allowlists; Jest tests. | ✅ done 2026-09-25 — backend **244/244**, `tsc` + eslint green |
| 3 — header switch + login/register carry-over | Header `ThemeToggle` saves through `useUpdateProfile`; login/register/Google sign-up send `theme` per D7; session applies the row value. | ✅ done 2026-09-25 — frontend **670/670**, `tsc -b` + eslint + `vite build` green |
| 4 — URL handoff | Read `?theme=` once (D6), save it, remove `?theme=` and `?lng=` from the URL. | ✅ done 2026-09-25 — frontend **680/680**, `tsc -b` + eslint + `vite build` green |
| 5 — landing page | Language selector + theme switch under the language list (left side); ES/DE/EE texts; `[data-theme]` palette; links add `?lng=&theme=`; `<html lang>`; Dockerfile. | not started |
| 6 — phase gate | `phase-3-9-theme.spec.ts`; both themes checked on every screen; docs; full green run. | not started |
| 7+ — small fixes | Added later by the user. | not started |

## Gate

- Backend and frontend suites green. Build green.
- Every screen checked in both themes (Playwright MCP screenshots): landing, all auth screens, 404,
  Home/Dashboard, Add Word, Word page, Review, Account.
- No theme flash on reload.
- **e2e** (`phase-3-9-theme.spec.ts`):
  1. Open `/login?lng=es&theme=dark` → the page is Spanish and dark. The parameters are removed.
  2. Switch the theme on the auth screen → log in → the app stays dark.
  3. Switch the theme in the header → reload and log in from a new browser context → the theme comes
     back from the user row.
  4. A user with no saved choice follows the OS preference (`colorScheme` emulation).

## Slice 1 outcome (2026-09-25)

**Shipped.** The auth screens have a light/dark switch next to the language selector. The whole
app and the auth screens render in dark. The choice is saved in the browser only (no backend yet —
that is Slice 2).

New files: `lib/theme.ts` (+test), `components/layout/{ThemeToggle,PublicThemeToggle}.tsx` (+test).
Changed: `index.html` (inline no-flash script), `main.tsx` (`initTheme()`), `styles.css` (`dark`
variant now follows `[data-theme='dark']`), `styles/tokens.css` (dark block), `styles/globals.css`,
`AuthLayout.tsx`, `WordForm.tsx`, `WordPage.tsx`, `common.json` × 4 (`theme.switchToDark` /
`switchToLight`; **EE strings flagged for the user to check**).

**Deviations from the slice plan**

- **No Zustand store.** The theme is an external store in `lib/theme.ts`, read with
  `useSyncExternalStore`. Reason: the inline script in `index.html` must read the same saved value
  before React loads, so it is a bare `'light' | 'dark'` string under `localStorage['ladu.theme']`,
  not a `persist` JSON blob. It also keeps to the "three stores" rule in `stores/uiStore.ts`. The
  phase-level wording ("Zustand `persist`") in `new-repo-build-plan.md` §5 is superseded by this.
- **Neutral derived tokens now mix in `srgb`** (`--fg-soft`, `--fg-soft2`, `--hover`,
  `--border-strong`), and the auth panel too. In the dark theme `--fg` has almost no chroma, so an
  `oklch` mix has no usable hue and Chrome rendered a faint red-brown tint (seen on the auth panel).
  Accent and state tones keep `oklch`.
- **New `--danger-ink` token** (white in light, dark ink in dark) for the count badge. The
  language-tile check uses `--accent-ink` instead of a fixed `#fff`.
- **Bulk bar** (`.bulkbar`): the fixed white overlays and the fixed pink "danger" text became
  `--bg` / `--danger` mixes, because in the dark theme this bar is light.
- **Two sticky save bars** (`WordForm`, `WordPage`) used `bg-background` inside a `--surface` card.
  It was almost invisible in light and a dark band in dark. Now `bg-card`.

**Checked by hand in the browser** (Playwright MCP, dark): login, register (desktop + 390 px wide),
Home, Add Word. Start value follows the OS; the switch saves the choice; the choice survives a
login. Not yet checked (Slice 6 covers every screen in both themes): Review, Word page, Account,
Dashboard charts, dialogs, 404.

**Known, not fixed here**

- The header logo's speech-bubble outline is dark blue and low-contrast on the dark header
  (`BrandLogo`). Look at it in Slice 3 when the header gets its switch.
- 2 pre-existing eslint warnings in `ReviewPage.tsx` (`userLanguages` memo). Untouched.

## Slice 2 outcome (2026-09-25)

**Shipped.** The backend stores, validates and returns a per-user theme. The frontend does not use it
yet (Slice 3).

- **Column:** `users.theme varchar(10)`, nullable, no default. `NULL` = "the user never chose one".
  Migration `0005_users_theme.sql` (one `ALTER TABLE … ADD COLUMN`). Applied to the dev and test
  databases. The deploy script applies it on staging and production (`deploy.sh` → `scripts/migrate.js`).
- **Validation:** one helper, `parseThemeInput` (`userController.ts`), exported and reused by
  `oauthController.ts`. Absent (`undefined` / `null` / `""`) means "no choice". Anything except
  `light` or `dark` returns 400 `Invalid theme selection` (so `system` is refused on purpose).
- **Where it is accepted:**
  | Endpoint | Behaviour |
  |---|---|
  | `POST /api/users` (register) | Stored when given. Otherwise `NULL`. |
  | `POST /api/users/login` | Saved to the row **only when sent** and different (D7). Absent → the stored theme is returned unchanged. |
  | `PUT /api/users/updateUser` | `theme ?? stored`. A profile edit that omits it (for example a UI-language change) keeps it. |
  | `POST /api/auth/signup/complete` (Google sign-up) | Stored when given. Otherwise `NULL`. |
- **Where it is returned:** `serializeUser`, `serializeLoginUser`, `publicUserResponse`, and `getMe`
  (`authMiddleware` column list). It is `null` when unset (like `uiLanguage`, not omitted like
  `nativeLanguage`).
- **Tests (+12, backend 244/244):** register (omit / store / four bad values, no account created),
  login (store / null / omit keeps / different overwrites / bad value leaves the stored one), `getMe`
  shape, `updateUser` (save / omit keeps / bad value changes nothing), Google sign-up (store / reject).

**Correction to the phase plan:** it said "the OAuth callback accepts the theme". The callback
(`GET /api/auth/:provider/callback`) is a browser redirect with no request body, so it cannot carry
one. Only the sign-up completion request can. A returning Google user gets the saved theme from the
row through `serializeLoginUser`. What Slice 3 must do for the Google **start** link is still open:
a `theme` query parameter on the start URL would have to travel through the signed state token.
Decide that in Slice 3.

**Known, not fixed here**

- `.context/.frontend/snapshot/*.md` still describe the old user shape. They are frozen by their own
  maintenance rule, so they are not edited.
- The dev backend on port 5001 was restarted by nodemon and reads the new column. If a dev backend
  from before this slice is still running without nodemon, restart it.

## Slice 3 outcome (2026-09-25)

**Shipped.** The header has a light/dark switch next to the language selector. It saves the choice to
the user row. A theme chosen on the auth screens follows the user through login. On a new device the
row's theme is applied after login.

Decision taken with the user: **the Google start link does not carry the theme** (recommendation
accepted). A new Google user gets the OS default until they press the switch. A returning Google user
gets the row's theme. Revisit only if it is missed: the value would have to travel through the signed
state token.

New: `components/layout/ThemeSelector.tsx` (header container), `components/layout/useSessionTheme.ts`
(the row wins after sign-in), `themeForRequest()` + exported `isTheme` in `lib/theme.ts`.
Changed: `AppHeader` (mounts `ThemeSelector`), `AppShell` (mounts `useSessionTheme`),
`features/auth/types.ts` (`theme` on login / register / updateProfile / OAuth signup / `AuthUser`),
`stores/authStore.ts` (`SessionUser.theme`, normalised: anything except light/dark becomes `null`),
`LoginForm`, `RegisterForm`, `OAuthSignupForm` (send `themeForRequest()`), `test/msw/authHandlers.ts`
(the mock backend knows `theme`).

**How the pieces fit**

- **Header switch:** the page and `localStorage` change first, so it feels instant. Then
  `updateProfile` saves a full payload plus `theme` (the endpoint clears `nativeLanguage` when that
  key is absent). The button is disabled while the save runs, so two quick clicks cannot race and a
  stale echo cannot flip the page back. A failed save shows the usual error toast. The page keeps the
  chosen theme.
- **Sending the theme at sign-in (D7):** the three forms send the *saved* browser choice only
  (`themeForRequest()`). With no saved choice the key is omitted, and the backend keeps the row value.
  The OS-derived start value is never sent.
- **After sign-in (`useSessionTheme`):** if the row has a theme and it differs from the browser's saved
  choice, the row wins: it is applied and saved in the browser. If the row has none, nothing happens.
  It runs in `AppShell`, so one effect covers form login, email verify, Google callback, Google
  sign-up and account link.
- **Old sessions:** a session saved in `localStorage` before this slice has no `theme` key. It is read
  as `null`, with no migration.

**Tests (+10, frontend 670/670):** `ThemeSelector` (instant change, full payload, disabled while
saving, kept on failure, no session), `useSessionTheme` (applies / row wins / row empty), login flow
(choice on the login screen is saved to the row; no choice does not overwrite the row and the row's
theme is applied), `toSessionUser` theme normalisation.

**Checked by hand** (Playwright MCP, real backend): a login with no chosen theme leaves the row
`NULL`; the header switch writes `dark` to the row; after clearing browser storage (a "new device",
OS light) a login with no choice ends dark with `ladu.theme = dark` saved; the header fits at 390 px.

**Removed from "Known" in Slice 1:** the header logo. All three brand SVGs are pure `#007AFF`. The
faint bubble is just the thin outline, not a theme problem. No change made.

**Not done here**

- Not run: e2e. The auth flow is unchanged, and the spec for this phase is Slice 6.
- Still open: the auth screens' "carry to the app" is only tested through the login form. The
  registration path stores the theme on the new row (backend-tested) but there is no frontend test
  for it yet.

## Slice 4 outcome (2026-09-25)

**Shipped.** The app reads `?lng=` and `?theme=` once at boot, uses them, saves them and removes them
from the address. The landing links (Slice 5) only have to add these two parameters.

New: `lib/handoff.ts` (+test). Changed: `i18n.ts` (calls `takeHandoffParams()` first; starts in
the handoff language), `index.html` (the no-flash script also reads `?theme=`).

**How it works**

- **Timing:** `i18n.ts` is the first app module to run, so it takes the parameters before i18next's
  detector or the router see the address. The values are read and the address is cleaned in one
  step, with no timing dependency on i18next's async start and no router desync.
- **Theme:** an address value beats the saved browser choice (D6). It is saved with `setTheme`, so it
  is now the browser's choice. The inline script in `index.html` applies it first, so the first paint
  is already right.
- **Language:** i18next starts with `lng` set to it and caches it, like the language selector does.
  A reload without the parameter keeps it. Accepted codes: `en`, `es`, `de`, `ee` (any letter case).
- **Cleaning:** only `lng` and `theme` are removed. Other parameters (for example `?redirect=`) keep
  their exact text, and the `#…` fragment (the Google sign-in result) is not touched. An invalid value
  (`?theme=system`, `?lng=fr`) is ignored but still removed.
- **Signed-in users:** not special-cased. Once a session exists, the account's theme and language win
  (Slice 3). A signed-in user who arrives with a different theme in the address sees a short switch
  back to the account theme. This is the accepted edge case of the landing page keeping its own
  choice.

**Tests (+10, frontend 680/680):** `parseHandoff` (both values, all four codes, letter case, invalid
values, other parameters kept, keys that only look similar), `takeHandoffParams` (apply + save + clean,
beats a saved choice, keeps other parameters and the fragment, does nothing when absent, invalid
values cleaned).

**Checked by hand** (Playwright MCP, dev server): `/login?lng=es&theme=dark` on empty storage gives
a Spanish, dark login page, the address becomes `/login`, and a reload keeps both. `?redirect=%2Freview`
survives the cleaning. `/?lng=ee&theme=dark` while signed out ends on `/login?redirect=%2F` in Estonian
and dark with no leftover parameters.

**Found, not fixed here (candidate for the "small fixes" list)**

- `<html lang>` stays `en` when the UI language changes, in the whole app. Screen readers and
  browser translation use it. It is a two-line fix in `i18n.ts` (`languageChanged` handler).
- `.dev-context/` and the landing docs are not updated yet for the link format. Slice 5 does that.
