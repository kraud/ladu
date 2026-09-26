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
| 5 — landing page | Language selector + theme switch under the language list (left side); ES/DE/EE texts; `[data-theme]` palette; links add `?lng=&theme=`; `<html lang>`; Dockerfile. | ✅ done 2026-09-25 — checked in a browser; Docker image builds. **EE texts need the user's review** |
| 6 — phase gate | `phase-3-9-theme.spec.ts`; both themes checked on every screen; docs; full green run. | ✅ done 2026-09-25 — backend **244/244**, frontend **680/680**, e2e **32/32** (default and `--workers=1`), `tsc -b` + eslint + build green |
| 7 — small fixes, part 1 | A page-only theme switch on the 404; `<html lang>` follows the interface language. | ✅ done 2026-09-25 — frontend **688/688**, e2e **34/34** |
| 8 — small fixes, part 2 | Word forms: bottom-align the cells of a field row (`items-end`). | ✅ done 2026-09-25 — frontend **689/689** |
| 9 — small fixes, part 3 | Word forms: reserve room under every field; validation messages out of the layout flow. | ✅ done 2026-09-25 — frontend **691/691** |
| 10 — small fixes, part 4 | Word forms: the reserved message room only on rows that have a mandatory field. | ✅ done 2026-09-26 — frontend **696/696** |
| 11 — small fixes, part 5 | Word forms: the "+ Add translation" tile lists the free languages as chips (no dialog). | ✅ done 2026-09-26 — frontend **696/696** |
| 12 — small fixes, part 6 | Word forms: sticky bottom bar (Save word, Change word type, hints); sidebar for clue + tags only; icon rail with clue/tags buttons. | ✅ done 2026-09-26 — frontend **706/706** (see the review round in the Slice 12 outcome) |
| 13 — small fixes, part 7 | "Use autocomplete values" in the brand colour. | ✅ done 2026-09-26 — frontend **707/707** |
| 14 — small fixes, part 8 | Confirm before removing a translation that has data. | ✅ done 2026-09-26 — frontend **719/719** |
| 15 — small fixes, part 9 | Review, phone: filters and display switches in a side menu. | ✅ done 2026-09-26 — frontend **733/733** |
| 16 — small fixes, part 10 | Review, desktop sidebar: collapse button points left/right. | ✅ done 2026-09-26 — frontend **736/736** |
| 17 — small fixes, part 11 | Review, desktop sidebar: "Language order" title and hint in a column. | not started |
| 18 — small fixes, part 12 | Cell dialog: translation form without its own header and frame. | not started |

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

## Slice 5 outcome (2026-09-25)

**Shipped.** The landing page has a language selector and a light/dark switch, in one row under the
list of languages on the left side. The page is in EN/ES/DE/EE. The theme has the dark palette. The
links into the app carry the visitor's choices.

New: `landing/app.js`, `landing/flags/{GB,ES,DE,EE}.svg` (copied from `frontend/public/`).
Changed: `index.html`, `privacy.html`, `style.css`, `Dockerfile` (copies `app.js` and `flags/`).

**How it works**

- **Theme:** `style.css` follows `data-theme` on `<html>`, as the app does. A small script in the head
  sets it before the first paint. Start value: saved choice, then the OS preference. There is a
  no-script fallback (`prefers-color-scheme` on `:root:not([data-theme])`), so a visitor without JS
  still gets the OS theme. The two dark blocks hold the same values as `frontend/src/styles/tokens.css`
  and must be kept in sync by hand.
- **Language:** saved choice, then the browser language, then English. Estonian browsers report `et`;
  the script maps it to the app's code `ee`. `<html lang>` is set to `et` for Estonian (`ee` is the
  code for Ewe). It also sets the page title, the meta description and the `og:` tags.
- **Selector:** a small script-built menu, same look as the app's `LanguageMenu`: flag + code, four
  items with native names and a check. Keyboard: Arrow Up/Down, Home, End, Escape (returns focus),
  Tab, and click outside all work.
- **Links into the app (D3, D7):** "Log in" and "Open Ladu" get `?lng=<code>`. They also get
  `&theme=<choice>` **only** when the visitor pressed the switch on the landing page. Sending the
  OS default as a "choice" would let a returning user on a new device overwrite the theme saved on
  their account (the Slice 3 rule). The app reads both once and cleans the address (Slice 4).
- **Without script:** the language/theme row stays hidden (it would do nothing). The page shows in
  English with plain links to the app.
- **Privacy page:** the legal text stays English. It gets the theme switch in its header, the same
  dark palette, and the same links. Its header and footer follow the language chosen on the home
  page. It has no language selector.

**Checked by hand** (Playwright MCP, local static server, real browser): light and dark, Spanish, the
row position under the language list, the menu, selecting a language (text, title, `lang`, links,
switch label), the switch (links gain `&theme=dark`), reload persistence, the privacy page (a theme
change there carries back to the home page), keyboard use, click outside, a phone width (390 px),
and browser-language detection in fresh profiles (`et-EE` gives Estonian, `de-AT` gives German,
`fr-FR` gives English, and none of them adds a `theme` parameter). The Docker image builds and
contains `app.js` and `flags/`.

**Please check**

- **The Estonian texts** (`STRINGS.ee` in `landing/app.js`, marked with a `TODO(user review)`
  comment): title, description, heading, paragraph, "Ava Ladu", "Logi sisse", "Privaatsus", the
  labels. Remove the TODO comment after review.
- **The Spanish and German texts** are also drafted by Claude.

**Not done here**

- No automated test: the landing page has no test setup, and Slice 6's e2e spec covers the
  landing → app handoff end to end.
- The production landing links go to `https://app.ladu.com.ar`, so the real handoff can only be
  walked on staging/production. Slice 4's browser check covered the app side.

## Slice 6 outcome (2026-09-25) — the dark-mode gate

**Gate: green.** Backend **244/244**, frontend **680/680**, e2e **32/32** (run at default
parallelism and with `--workers=1`, the CI shape), `tsc -b`, eslint and `vite build` clean. Slices
0–6 are the dark-mode part of the phase. Slice 7+ (the small fixes) waits for the user's list.

**New e2e spec** `e2e/tests/phase-3-9-theme.spec.ts` (4 tests, real backend + Postgres + browser) and
a `getUserTheme` fixture in `e2e/fixtures/db.ts`:

1. **Handoff:** `/login?lng=es&theme=dark` gives a Spanish, dark login page with a clean address, and a
   reload keeps both. `?redirect=` survives, and an address value beats a saved choice.
   `/?lng=ee&theme=dark` ends on `/login?redirect=%2F`, in Estonian and dark.
2. **Auth-screen choice:** the theme pressed on the login screen rides along with the login, and the row
   goes from `NULL` to `dark`.
3. **Header switch and a new device:** a login with no choice leaves the row `NULL`. The header switch
   writes `dark` to the row. A fresh browser (OS light, no saved choice) starts light, logs in without
   touching the theme, ends dark, and the login did **not** overwrite the row. Switching back on the new
   device writes `light`.
4. **OS start value:** with no saved choice the page follows the OS (`dark` and `light`), the OS value
   is not saved, and a pressed switch beats it, also after a reload.

**The spec can fail.** Mutation check: with `useSessionTheme` disabled, test 3 fails and the other
three pass. The file was restored (`git diff` empty).

**Screen sweep** (Playwright MCP, real backend, seeded account, light and dark, desktop and phone).
Checked: login, register (both steps), reset request, bad verify link, 404, Home with both charts,
Add Word (type picker, noun form, language dialog), Word page (view, edit, delete dialog), Review
(filters, table, selected row with the bulk bar, cell dialog), Account (view and edit), the phone
header, the navigation sheet, a phone Review table, an error toast. Two more real problems found and
fixed:

- **Toasts were white in the dark theme.** `Providers.tsx` hard-coded `theme="light"` on the
  `ToastContainer`. It now follows the theme (`useTheme()`).
- **Bulk bar buttons in the dark theme** had a grey fill and weak "Delete" text. Since Slice 1 the shadcn
  `dark:` variants really apply, and the `Button` outline variant's `dark:` fill (a utilities-layer
  rule) beat the bar's own component-layer rules. Those rules now use `!important` on
  `background` / `border-color`, with a comment saying why.

**Not swept, same layout as swept screens:** verify-success, set-new-password, and the Google
sign-up / link screens (all inside `AuthLayout`).

**Found, not fixed (candidates for the "small fixes" list)**

- **The 404 page has no theme switch.** *Fixed in Slice 7.*
- **`<html lang>` stays `en`** when the UI language changes in the app. *Fixed in Slice 7.*
- **A signed-in user arriving with a different `?theme=`** sees a short switch back to the account
  theme (Slice 4 edge case).
- **Nothing serves `landing/` in the e2e suite**, so the landing → app link is checked by hand (Slice
  5) and the app side by test 1 above.

**Environment note.** `playwright.config.ts` reuses a backend already running on port 5001. A backend
started by hand (`npm run dev -w backend`) lacks the `OAUTH_ISSUER_GOOGLE` stub settings the config
gives to its own backend, so the 8 OAuth specs time out against it. Run the e2e suite with port 5001
free, or start the backend the way the config does. (Found because a backend of mine held the port.)

## Slice 7 outcome (2026-09-25) — small fixes, part 1

Two fixes the user asked for after the gate. Frontend **688/688** (+8), e2e **34/34** (+2, default and
`--workers=1`), `tsc -b`, eslint and `vite build` clean. Backend untouched.

**1. A theme switch on the 404 page that only lives on that page.**

- New `components/layout/PageThemeToggle.tsx`. It changes `data-theme` and its own state, and nothing
  else: no `localStorage` write, no request. So the choice is not saved, does not become the "saved
  choice" that a later login sends (D7), and does not reach the account. Leaving the page restores what
  applies normally (`currentTheme()`: the saved choice, else the OS preference). A reload also resets it.
- `AuthLayout` got a `themeToggle` prop. Its default is the saved-choice `PublicThemeToggle` next to
  the language selector, as before. The 404 passes `<PageThemeToggle />` with
  `showLanguageSelector={false}`, so it shows the switch alone. The 404 still has no language
  selector (the Phase 1 decision stands).
- The switch sits bottom-left, where the language row is on the other auth screens.
- **How the request was read:** "no need to store/transfer that" was taken as not saved in the browser
  and not sent to the account. If the 404 choice should be saved like the other public screens, change
  `themeToggle={<PageThemeToggle />}` to nothing (the default) in `routes/not-found.tsx`.

**2. `<html lang>` follows the interface language.**

- `lib/language.ts`: `htmlLangByI18nCode()` (region variants stripped, unknown gives `en`, and the
  app's Estonian code `ee` becomes the HTML tag `et`, because `ee` is the code for Ewe) and
  `bindHtmlLang(i18n)`, which sets the attribute at once and on every `languageChanged`.
- `i18n.ts` calls `bindHtmlLang(i18n)` before `init`, so the first detection (saved choice, browser
  language, or a `?lng=` handoff) is caught too. This covers every change path: the public selector,
  the header selector's session sync, and the handoff.
- The landing page already did this (Slice 5).

**Tests:** `routes/not-found.test.tsx` (switch shown and no language selector; page-only: nothing saved
and the normal theme comes back on leaving; a saved choice is restored, not the OS value),
`language.test.ts` (the mapper, and `bindHtmlLang` at start-up, on change and when bound late), and two
e2e tests in `phase-3-9-theme.spec.ts` (404 switch: nothing saved and a reload resets it; `<html lang>`
goes `et` for `?lng=ee`, then `es` after the selector, and survives a reload).

**Not done here:** the OS-preference listener (`initTheme`) can still re-apply the OS theme on the 404
if the OS switches while the preview is on. It is a rare case, accepted.

## Follow-up: code-scanning alert on `landing/app.js` (2026-09-25)

GitHub code scanning (github-advanced-security) flagged `applyLinks()` in `landing/app.js`: "DOM text
reinterpreted as HTML without escaping meta-characters". The link address was built by joining
`data-app` (text read from the page) and `language` / the stored theme (read from storage) into an
`href`. The values were checked before that, so it could not be exploited as written. But the scanner
could not see the checks, and nothing stopped a bad `data-app` value from becoming a link.

Changes (in `landing/app.js` only):

- **`appHref(path)`** builds the address with `new URL(path, APP_ORIGIN)` and `searchParams.set`, so
  the values are encoded. It **refuses** any address whose origin is not `APP_ORIGIN`
  (`//other.example`, `https://other.example`, `javascript:...`). A refused link keeps its static
  `href` from the HTML.
- **Constants only:** `knownLang()` returns the language table's own code, never the stored or browser
  string. `storedTheme()` returns the literal `'light'` or `'dark'`. So unchecked text cannot reach the
  address.
- The unused `isLang()` helper is removed.

Checked in a browser: normal links are unchanged (`?lng=es&theme=dark`). Hostile stored values (a
`"><img onerror>` language, a `javascript:` theme) give `?lng=en` with no theme. Hostile `data-app`
values are refused. A normal path (`/login`) still works. The root link now has a trailing slash
(`https://app.ladu.com.ar/?lng=es`), which is the same address.

Not changed: the picker still adds its check icon with `insertAdjacentHTML` from a constant string.
It takes no outside text, so it is not flagged. It could be replaced with `createElementNS` if the
scanner ever objects.

## Slice 8 outcome (2026-09-25) — small fixes, part 2

**Word forms: the fields next to an autocomplete field are now bottom-aligned.**

- **Cause:** the autocomplete trigger has a bold label and a 2px border (`border-2`), so its cell is
  taller than its neighbours'. In a row (a noun's singular/plural pair, a Spanish adjective's gender
  grid, a verb's tense columns) the inputs' bottom edges drifted apart. Measured in a browser on a
  Spanish noun: the Singular input ended at 376.9 px and the Plural input at 369.9 px (7 px apart).
- **Fix:** `items-end` on the row container in `TranslationCard.tsx` (the `grid gap-x-4 gap-y-3` block
  with `gridTemplateColumns`). Measured after: both inputs end at 376.9 px.
- **Side effect, accepted:** the cells align at the bottom, so a shorter cell's *label* now sits a few
  pixels lower than the taller cell's label (for example "I" next to the bold "I *" in the verb
  grid). The input bottoms, which the fix is about, line up.
- **Checked visually:** English verb (tense grid), German noun (four-case grid), Spanish noun.
- **Not covered:** a validation message under one cell (`FormMessage`) makes that cell taller, so its
  neighbour's input moves down to the message's bottom edge. That comes with bottom alignment; the
  form shows messages only after a field has been touched.
- **Test:** `TranslationCard.test.tsx` checks that the row container has `items-end` and holds both
  fields (jsdom cannot measure layout, so the pixel check was done in the browser).
- Frontend **689/689**, `tsc -b`, eslint and `vite build` clean. e2e (the form-related specs: Phase 2,
  Phase 3, Phase 3.5 and Phase 3.9) **11/11**. The full suite was not re-run (the OAuth specs need
  port 5001 free).

## Slice 9 outcome (2026-09-25) — small fixes, part 3

**Word forms: validation messages no longer disturb the layout.**

- **What it does:** every editable field in the word forms reserves a 16px strip under its control
  (`pb-4` on the field's wrapper). Its validation message is `position: absolute` inside that strip
  (`absolute inset-x-0 bottom-0 leading-4`), so it is out of the normal flow and adds no height. A
  message appearing or disappearing moves nothing, and the bottom-aligned rows from Slice 8 stay aligned.
- **Where:** `FieldRenderer.tsx` only (constants `FIELD_ITEM` and `FIELD_MESSAGE`), on all six editable
  field kinds: text, radio, toggle, select, multi-select and checkbox. `displayOnly` fields have no
  messages and reserve nothing. The shared `FormItem` / `FormMessage` are not restyled, so the auth
  and Account forms are unchanged.
- **One-line messages:** a message is cut with an ellipsis if it is too long for its cell. `FormMessage`
  now puts the full text in `title` (hover). This is the only change to `components/ui/form.tsx`, and
  it also adds the tooltip on the other forms, which is harmless. All current messages fit
  (the longest, German "Darf keine Zahlen enthalten", is about 150px in a cell of 200px or more).
- **Measured in a browser** (German noun, four-case grid; English verb, tense grid): the card height,
  every field's top and height, and every input bottom are identical before and after two messages
  appear. Checked in light and dark mode.
- **Cost, accepted (asked for):** forms are taller. The space between an input and the next label went
  from 12px to 28px (16px reserved + the existing 12px row gap). The row gaps were not reduced. If the
  forms feel too airy, lower `gap-y-3` in `TranslationCard.tsx` (for example to `gap-y-2`) and the
  stack's `gap-3`.
- **Tests:** `TranslationCard.test.tsx` (an editable field has `relative pb-4`; after typing `abc1` and
  leaving the field, the message is inside the field, `absolute`, `bottom-0`, `truncate`, with a
  `title`; a `displayOnly` field reserves nothing). Frontend **691/691** (+2), `tsc -b`, eslint and
  `vite build` clean. e2e Phase 1, 2, 3, 3.5 and 3.9 specs **15/15**. The full suite was not re-run
  (the OAuth specs need port 5001 free).

## Slice 10 outcome (2026-09-26) — small fixes, part 4

**Word forms: the reserved room under a field is now only added on rows that have a mandatory field.**
This narrows Slice 9. Every other row is back to how it was before Slice 9.

- **Rule:** a "row" is one layout row: a single field on its own, or one row of a grid block (a
  noun's singular/plural pair, a verb's tense grid, a Spanish adjective's gender grid). If any field in
  the row is mandatory (`field.required`, the same flag that draws the red `*`), **every** field in that
  row reserves the 16px strip and shows its message out of the flow. Otherwise the row reserves
  nothing, and a message, if one appears, takes its own line, as before.
- **Code:** `FieldRenderer` got a `reserveMessageSpace` prop (default `false`; ignored in `displayOnly`).
  `TranslationCard` decides it per row: `item.field.required` for a single field, and
  `rowFields.some((field) => field?.required)` for each row of a grid.
- **Measured** (German noun): the mandatory row is 78px high (reserved), the three optional rows are
  55px each again (12px row gap, as before Slice 9). The card is 545px high, down from 609px in Slice
  9. A message in the mandatory row moves nothing. A message in an optional row flows: the rows below
  shift down by the message's height (23px), the two inputs of that row stay level.
- **Adjustment to Slice 8 (needed by this rule):** the grid keeps `items-end`, but the cells of an
  optional row are now `self-start` (cells of a mandatory row are `self-end`). Reason: every
  autocomplete trigger is a mandatory field (checked for all 8 language/part-of-speech pairs), so the
  bold label and 2px border that Slice 8 aligns for only ever occur in mandatory rows. In an optional
  row with a message in the flow, `items-end` would have dropped the neighbour's input to the message's
  bottom edge; `self-start` keeps it level, as it was before Slice 8.
- **Tests (+5):** a mandatory field reserves room and shows an `absolute` message; per-row rule (a
  mandatory field's optional row partner also reserves; an all-optional row reserves nothing and its
  message is in the flow; a lone optional field reserves nothing and a lone mandatory one does); the
  `self-end` / `self-start` split; the `reserveMessageSpace` prop on `FieldRenderer`. Frontend
  **696/696**, `tsc -b`, eslint and `vite build` clean. e2e Phase 1, 2, 3, 3.5 and 3.9 specs **15/15**.

## Slice 11 outcome (2026-09-26) — small fixes, part 5

**Word forms: pick the language straight from the "+ Add translation" tile.**

- **What it does:** the dashed tile at the end of the translation grid now shows the label and, under
  it, one chip per language that is still free (flag + native name). One click on a chip adds that
  translation. The language dialog is gone (`Dialog` import, `addLangOpen` state and `pickLanguage`
  removed from `WordForm.tsx`).
- **Tile states:** the tile is a `role="group"` named "Add translation" (a button cannot hold other
  buttons). When no translation can be added (four already, or every account language used) the
  tile is **not rendered**. Removing a translation frees its language, so the tile and its chip come
  back. The tile keeps the accent hover (border, background, text) on the whole tile.
- **Spacing (review round):** tile padding `p-5`, minimum height `min-h-28`, `gap-4` between the
  title and the chips, `gap-3` between chips.
- **Removed:** the unused `wordRelated:translationFormGeneric.selectLanguage` key (4 locales).
- **Tests:** `WordForm.test.tsx` (chips listed, a click adds the card and drops its chip, disabled
  tile has no chips, a removed language's chip returns), `AddWordPage.test.tsx` (one click per
  language). The three e2e specs and the smoke spec drop the extra "Add translation" click before
  the language click. Frontend **696/696**, `tsc -b` and eslint clean (the 2 old `ReviewPage`
  warnings remain). e2e Phase 2 and Phase 3 specs **11/11**.
- **Checked visually** (Playwright, real backend): desktop and 390 px wide, light and dark.

## Slice 12 outcome (2026-09-26) — small fixes, part 6

**Word editor: a bottom bar (fixed to the viewport) holds the actions. The sidebar holds only the clue and the tags.**
Same on Add Word, the Word page in edit mode and the Word page in view mode.

**The bar** (`layout/WordEditorBar.tsx`, look from `MOCKUPS/word-editor.html` `.savebar`)

- **Desktop:** left = the secondary actions (create: *Change word type*; edit: *Cancel*, *Delete*;
  view: *Return*, *Delete*), then the "* Fields marked with * are required" note (create/edit).
  Right = the reason Save is disabled, then the main button (*Save word*; *Edit* in view mode).
- **Phone (max 920px):** only the reason and the main button, full width. The secondary actions are in
  the drawer, above the clue. Choosing one closes the drawer.
- **The reason** (`useWordFormState.saveBlockReason`, one at a time, in this order): `minTranslations`
  (fewer than 2), `incomplete` (a required field is missing in some translation), `noChanges`.
  Enabled Save shows **no** message. The button text changed from "Save" to **"Save word"** (new key
  `wordForm.buttons.saveWord`; `hints.incomplete` and `hints.noChanges` are new; 4 languages, **the EE
  texts need your check**). "Saving…" replaces the reason while a save runs.
- **One copy of each action:** `WordEditorLayout` uses the new `useIsMobile` (`lib/useMediaQuery.ts`,
  also used by Slice 15) to render the secondary actions in the bar (desktop) or the drawer (phone),
  never both. So each button keeps one accessible name at every width. `matchMedia` is missing in
  jsdom and reports `false` (desktop); the tests that need the phone stub it.
- **API change:** `WordEditorLayout` now takes `actions`, `primary`, `statusText` and
  `showRequiredHint`. `WordForm`'s `extraActions` is now `EditorAction[]` (was a node). The bar
  background mixes in `srgb` (an `oklch` mix with transparent gave a faint pink tint, as in Slice 1).

**The sidebar** (`layout/SidebarFields.tsx`)

- Expanded: Clue and the Tags placeholder only. The collapse caret stays.
- Collapsed (desktop rail): the expand caret plus a **Clue** button and a **Tags** button. Clue icon:
  `PencilSimple` when empty, `PencilSimpleLine` when it has text. Tags icon: `Tag` regular, or duotone
  with a count badge when `tagCount` > 0 (always 0 until Phase 4). The Clue button expands the sidebar
  and focuses the clue field. The Tags button only expands it. A read-only word with no clue shows
  only the Tags button.
- `useWordSidebar` (new) gives `collapsed` = the stored preference **and** desktop. So a phone always
  shows the full drawer, and the old `max-[920px]:` overrides in the fields are gone.

**Removed:** `SidebarAction.tsx` and its test (nothing uses them now).

**Tests (+9, frontend 705/705):** `useMediaQuery`; `useWordFormState.saveBlockReason` (all four
outcomes); `WordEditorLayout` (desktop bar content, no reason when enabled, phone: actions only in the
drawer and one copy each, the rail preference ignored on a phone); `SidebarFields` (rail buttons, both
icon swaps, the badge, focus on Clue, no focus on Tags); `WordForm` (the reason changes as the form
fills and disappears when Save is enabled; the actions are in the bar, not the sidebar); `WordPage`
(Edit/Delete/Return in the bar). `tsc -b`, eslint (the 2 old `ReviewPage` warnings remain) and `vite
build` clean. e2e Phase 1, 2, 3, 3.5, 3.9 and Review specs **15/15**. One Phase 1 run failed once
(register did not redirect) and passed on 2 reruns and on the unmodified code; it does not touch this page.

**Checked visually** (Playwright, real backend): Add Word (empty, incomplete, ready), the rail in light
and dark, the Word page in view and edit, and a 390 px phone (reason shown when disabled, no message
when enabled, drawer with the actions).

**Known, not fixed here**

- In edit mode, removing one of three translations does not enable Save (no remaining card is
  "dirty"), and the reason then says "Make a change…". This comes from how `isDirty` is tracked
  (`canSave` did the same before). A fix belongs in `useWordFormState`.
- The Word page skeleton and the not-found redirect are unchanged.

**Review round (2026-09-26)** — three fixes after the first look:

1. **The bar was not at the bottom on a short page** (no translations yet), and **at the end of a long
   page it stopped about 32px above the viewport bottom.** Cause: `position: sticky` cannot push a bar
   down, and it stops where its parent ends (`AppShell`'s `py-8`). Fix: `WordEditorBar` is now
   `position: fixed` (`inset-x-0 bottom-0`). Its inner row keeps the wide column (`max-w-7xl`, `px-6`).
   A spacer of the bar's own height (measured with a `ResizeObserver`, because the phone bar grows
   when the reason wraps to two lines) keeps the last content from hiding behind it. Measured in a
   browser: the bar's bottom equals the viewport height on a short page, at the end of a long page
   (verb, 2 translations) and on a 390px phone.
2. **The sidebar starts collapsed.** `uiStore.wordSidebarCollapsed` now defaults to `true` (session
   only, not saved). `test/setup.ts` sets it to `false` before each test, so the component tests
   keep working with the open sidebar; `SidebarFields.test.tsx` checks the real default.
3. Seen while checking, not changed: a toast (bottom-centre) can cover the middle of the bar for a
   few seconds; on a phone it covers the Save button. After a save the form has already reset, so
   nothing is lost. Tell me if the toast should move above the bar.

## Slice 13 outcome (2026-09-26) — small fixes, part 7

**The ready-to-click "Use autocomplete values" button is in the brand colour.**

- **Look:** a soft accent fill (`--accent-soft`), an accent border (`--accent`), and semibold text in
  `--accent-strong` (the small-text tone that passes AA on both themes). Hover deepens the fill
  (`--accent-soft2`). It is deliberately not the solid `default` variant: that stays the page's one
  primary action (*Save word*). If you want it louder, change the class constant to
  `variant="default"`.
- **Code:** `APPLY_BUTTON_CLASS` in `form-engine/AutocompleteRow.tsx`, on the same outline button as
  before. The `dark:` twins are needed because the outline variant sets its own `dark:` fill and
  border, which would win in the dark theme (same cause as the bulk bar in Slice 6).
- **Unchanged:** the states before a lookup (magnifier and status text) and after values match (green
  check, "Autocomplete values applied").
- **Test (+1, frontend 707/707):** the button carries the accent fill, border and text classes and
  their `dark:` twins. `tsc -b`, eslint and `vite build` clean. e2e Review, Phase 2 and Phase 3.5
  specs pass (the Review spec clicks this button on a German noun).
- **Checked visually** (Playwright, real offline autocomplete on "Baum"): light, dark, and hover in
  both.

## Slice 14 outcome (2026-09-26) — small fixes, part 8

**Removing a translation that holds data now asks first.** An empty card is still removed at once.

- **Rule:** the card reports a new `hasData` value (`TranslationCardChange`, also on `TranslationItem`).
  It is true when any field holds a value — non-blank text, a chosen radio/select, or a ticked option —
  saved or not. It looks at **every** field, so a value that is never stored as a case (the Spanish
  adjective's gender radio) counts too. Checkboxes are ignored: they are form-only options (Estonian
  "search in English"), not data the user would miss. Code: `fieldsHaveData` in `TranslationCard.tsx`.
- **Why not `isDirty` or `cases`:** `cases` misses the non-stored radio. The parent's `isDirty` stays
  `true` after *Clear* on an empty card (Clear sets it on purpose so a saved word can be saved), which
  would ask about an empty card. `hasData` comes from the card's own current values, so it is right
  after typing, deleting, *Clear* and on a saved word that was not touched.
- **Flow:** `WordForm.handleRemove` uses `translationHasData(translation)`
  (`useWordFormState.ts`; falls back to the cases when a slot has not reported yet). With data it opens
  the existing `ConfirmDialog` (destructive style, *Remove* / *Cancel*). The pending card is tracked by
  language, not by index. Confirm removes it and its language chip returns to the "Add translation" tile.
- **Text** (`wordForm.confirmRemoveTranslation`, 4 languages, **EE needs your check**): "Remove this
  translation?" / "The {{language}} translation and everything entered in it will be removed." The
  language shows as its native name, like everywhere else in the app.
- **Edit mode:** a saved translation always asks, even when nothing was changed (it holds data). The
  removal still only reaches the database when the word is saved.
- **Tests (+11, frontend 719/719):** `fieldsHaveData` (blank, whitespace, text, radio, multi-select,
  checkbox ignored); `translationHasData` (trusts the card, falls back to cases, add/clear leave no data);
  `WordForm` (empty card goes at once; typed data asks, Cancel keeps; Confirm removes and frees the
  language; typed-then-deleted and *Clear*ed cards go without asking; edit mode asks). Existing
  exact-shape assertions got `hasData`. `tsc -b`, eslint and `vite build` clean. e2e Phase 2 and 3 specs
  pass (no spec clicks Remove).
- **Checked visually** (Playwright, real backend): empty card removed directly; card with data shows
  the dialog; Cancel keeps the value; Confirm removes. Light and dark.

## Slice 15 outcome (2026-09-26) — small fixes, part 9

**Review, phone (below 920px): the filters are in a side menu that can be hidden.** Desktop is unchanged.

- **The trigger:** a "Filters" button (sliders icon) is the first item in the toolbar row, before the
  search box. It shows the number of active filters, so a closed menu never hides that the table is
  filtered (same count as the desktop pill: each gender and part-of-speech value, plus the search text).
- **The menu:** the existing `Sheet` (`components/ui/sheet.tsx`), from the left, with a "Filters"
  title and a close button (also closes on backdrop click and Escape). Inside, one column: Gender,
  Part of speech, Language order, then a "Display" heading with the **Display gender** and **Display
  progress** switches. The menu stays open after a choice, so several filters can be picked in a row;
  the table updates behind it.
- **Stays where it was:** the search box and the "x of y words" label (toolbar row above the table).
- **One copy of each control:** `ReviewPage` uses `useIsMobile` (from Slice 12) to render either the
  inline `FilterBar` (desktop) or `MobileFilters` (phone), never both. The stored top/sidebar choice is
  a desktop setting and is ignored on a phone (it is kept for when the window is wide again).
- **Code:** new `review/MobileFilters.tsx` and `review/DisplayOptions.tsx` (the two switches, shared
  with `TableToolbar`, which on a phone gets `hideDisplayOptions` and the button through `leading`).
  `FilterBar` got `layout="menu"` (only the groups in a column: no card, header, collapse or position
  toggle) and an exported `activeFilterCount`. New text `review:filters.display` (4 languages;
  **ES/DE/EE are drafts**). New test helper `test/viewport.ts` (`mockMobileViewport`), reset in
  `test/setup.ts`; `WordEditorLayout.test.tsx` uses it too.
- **Tests (+14, frontend 733/733):** `MobileFilters` (button only until opened; active count on the
  button; one column + switches in the menu; chip and switch report changes; no gender switch without a
  noun; closes); `FilterBar` menu layout (no card/header/toggles, ignores the stored position) and
  `activeFilterCount`; `TableToolbar` (`hideDisplayOptions`, `leading`); `ReviewPage` on a phone (no
  inline bar, search and count stay, switches in the menu; a filter in the menu reaches the request and
  the button counts it; the progress switch in the menu shows the rings). `tsc -b`, eslint (the 2 old
  `ReviewPage` warnings remain) and `vite build` clean. e2e Phase 1, 2, 3, 3.5, 3.9 and Review **15/15**.
- **Checked visually** (Playwright, real backend, two seeded words): 390px closed, open, with filters
  on, after closing, dark; and 1280px desktop after resizing back.

**For Slice 17:** in the phone menu the "Language order" title and hint sit in one row and wrap
awkwardly (the menu is about 280px wide). Slice 17 stacks them for the desktop sidebar; the phone
menu would look better with the same stacking. Say if you want it there too.

## Slice 16 outcome (2026-09-26) — small fixes, part 10

**Review filters on desktop: the collapse button now points the way the bar moves.**

- **Sidebar position:** left arrow when expanded (press to collapse), right arrow when collapsed
  (press to expand) — the same as the word editor's sidebar.
- **Above the table:** unchanged, up when expanded and down when collapsed.
- The arrow follows the bar's position at once when the position toggle is used. The button names
  ("Collapse filters" / "Show filters") did not change.
- **Code:** one expression in `review/FilterBar.tsx` (`isSidebar` × `collapsed` picks the icon), and
  the file's header comment. The phone menu (Slice 15) has no collapse button, so it is not affected.
- **Tests (+3, frontend 736/736):** the button's icon markup is compared with the expected Phosphor
  caret for above/collapsed, above/expanded, sidebar/expanded, sidebar/collapsed, and after moving
  back above the table. Mutation check: with the old up/down arrow in the sidebar branch, the
  sidebar test fails; restored, it passes. `tsc -b`, eslint and `vite build` clean. e2e Review spec
  passes.
- **Checked visually** (Playwright, desktop): above the table (up), sidebar open (left), sidebar
  collapsed (right).
