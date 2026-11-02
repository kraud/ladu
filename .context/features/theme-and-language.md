# Theme (light and dark) and the carried-over language

Live spec. It replaces a finished plan (archive record: `.context/archive/2026-09-phase-3-9-dark-mode.md`). Built 2026-09-25 to 2026-09-26 (slices 0 to 6 for dark mode, slices 7 to 18 for small fixes). Gate: `e2e/tests/phase-3-9-theme.spec.ts`.

The theme and the language carry over: landing page, then auth screens, then the logged-in app. Only **light** and **dark** are offered. There is no "system" option in the switch.

Code map: `frontend/src/lib/theme.ts` and the theme store, `frontend/index.html` (inline no-flash script), `frontend/src/styles/tokens.css`, `components/common/ThemeToggle`, `components/layout/PublicLanguageSelector.tsx`, `LanguageSelector.tsx`; `landing/` (static page, small inline JS, its own `style.css`); backend `users.theme` (migration with the other columns, nullable `'light' | 'dark'`); visual rules in `.context/design/02-colour.md`.

## 1. Decisions

| ID | Decision |
|---|---|
| D1 | The start value is the OS preference (`prefers-color-scheme`). The OS value is **not saved** until the user presses the switch, so a visitor who never touches it keeps following the OS. |
| D2 | The theme is stored in the user row (`users.theme`, same pattern as `uiLanguage`) and in `localStorage`, in the app and on the landing page. |
| D3 | The landing (`ladu.com.ar`) and the app (`app.ladu.com.ar`) are different origins, so `localStorage` does not carry over. The landing links add `?lng=es&theme=dark`. The app reads them once, saves them and removes them from the URL. i18next already reads `?lng=`. |
| D4 | The landing texts in ES, DE and EE were drafted by the assistant. The EE text is flagged for review. |
| D6 | Client precedence, highest first: `?theme=` in the URL, then the saved browser choice, then the OS preference. |
| D7 | Login sends `theme` only if the user chose one. `uiLanguage` is always sent and overwrites the row. If theme did the same, a login on a new device (OS default, no choice made) would overwrite the theme saved on another device. With no saved browser choice, the backend keeps the row value and the app applies it after login. If the row is empty (existing users), the app keeps the current theme and does not write it. |
| D8 | The theme is the attribute `data-theme="light|dark"` on `<html>`, not a class. The shadcn variant uses `[data-theme="dark"]`. `color-scheme` is set per theme so native controls and scrollbars follow. |
| D9 | No flash: a small inline script in `frontend/index.html` sets `data-theme` before the first paint. The React store reads the same value. |

(D5, "small fixes list", was closed: all items were built in slices 11 to 18.)

## 2. Contract

- **Palette:** `tokens.css` has six seed colours (`--bg`, `--surface`, `--fg`, `--muted`, `--border`, `--accent`). The derived tones use `color-mix()` and recompute. The dark block overrides the seeds plus `--accent-strong`, `--accent-ink`, `--lang-*`, `--success`, `--danger`, `--warning`. The dark values come from `landing/style.css`, and the two files are kept in sync by hand.
- **Backend paths that accept `theme`:** register, login, Google sign-up completion (`signupComplete`) and `updateUser`. The OAuth callback is a redirect with no body, so it cannot. The `serializeUser` allowlist includes it.
- **Switch positions:** landing, under the language list on the left; auth screens, next to the language selector (`.auth-lang` in `AuthLayout`); logged-in app, in the header next to the language selector (saves through `useUpdateProfile`).
- **Landing:** a language selector (EN, ES, DE, EE) and a theme switch, in small inline JS. The choice is in the landing's own `localStorage`. `<html lang>` follows the language. The "Log in" and "Open Ladu" links add `?lng=…&theme=…`. If a JS file is added, update the COPY list in `landing/Dockerfile`.
- **Hard-coded colours:** the Google icon keeps its brand colours. `lib/avatar.ts` and the chart colours (`chartColors.ts`) were audited.

## 3. Traps

- The landing and the app palettes drift if only one file changes.
- A trigger that uses `buttonVariants` directly must wrap it in `cn(...)` (see `design/04-layout.md`).
- Removing a translation from a saved word enabled "Save word" until it was fixed (slice follow-up). Test the dirty state after a removal.
- The filter sidebar looked stretched for an instant when it expanded (fixed in a follow-up). Check panel animation in both themes.
- The full e2e suite, including the OAuth specs, needs port 5001 free.

## 4. Open items

None. Closed 2026-11-02 (confirmed by the user): the review of the ES, DE and EE drafts from slices 12, 14 and 15 and of the landing texts.
