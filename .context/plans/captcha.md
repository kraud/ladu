# Plan: Captcha (Cloudflare Turnstile) on demo, registration and password reset

Status: **approved on 2026-10-19. Slice 1 built on 2026-10-19** (backend: see "Slice 1 — what was built").
**Slice 2 built on 2026-10-19** (learner frontend: see "Slice 2 — what was built"). **Slice 3 built on 2026-10-19** (admin switch, e2e, docs: see "Slice 3 — what was built"). Open items: see "Open items".

## Context

Three public routes do expensive work for anyone on the internet:

- `POST /api/demo` (`backend/controllers/demoController.ts`) makes an account and copies the demo
  template into it. The only bot defences are a per-IP limit **in memory** (`backend/lib/demo.ts:123`,
  a restart clears it, many IPs pass it) and the live cap (`demo.maxLive`). A bot can fill the live
  cap and lock out real visitors.
- `POST /api/users` (`registerUser`, `backend/controllers/userController.ts:214`) makes an account
  and sends a verification email. It has no limit at all.
- `POST /api/users/requestPasswordReset` (`userController.ts:684`) sends an email to an existing
  account (with a cooldown per account).

The intended outcome: a human check on these three routes that most real users never notice.

## What this is (plain-language overview)

A **captcha** is a test that tells a human from a script. **Cloudflare Turnstile** is a free captcha
with no image puzzles. Two keys:

- **Site key** (public): the browser uses it to show the widget. The widget runs a short check and
  gives the page a **token** (a one-time ticket, valid for 5 minutes).
- **Secret key** (private): the backend sends the token + the secret to Cloudflare's `siteverify`
  endpoint. Cloudflare answers "success" or "fail". Only the backend can make this call.

**Managed mode** (chosen): most visitors see only a short check and a "Success" mark. Cloudflare
shows a checkbox only to visitors it does not trust.

Cloudflare gives **test keys** that always pass (or always fail), with no network to a real
widget check. Dev, Jest and e2e use them. Exact values are checked in the Turnstile docs at
Slice 1 start (known values: site `1x00000000000000000000AA`, secret
`1x0000000000000000000000000000000AA`).

## Decisions (made with the user on 2026-10-19)

| # | Decision |
|---|---|
| C1. Provider | Cloudflare Turnstile, **managed** widget mode. |
| C2. Switch | An **admin switch** on the Access page: `access_settings.captcha_enabled`, off by default, audit `access.captcha_configure`. Same pattern as the onboarding switch (`0031_onboarding_switch.sql`, `PUT /api/admin/access/onboarding`). Rollout with no deploy. |
| C3. Keys | `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` in the backend env (GitHub Environment secrets → `/opt/ladu/<env>/.env`, like `EKILEX_API_KEY`). The switch cannot be turned on while a key is missing (400 `captcha_not_configured`); the admin page shows "keys not set". If the keys are removed while the switch is on, the routes act as "not configured" = off, and log once per start. |
| C4. Site key delivery | At **runtime** through the public `GET /api/access`: `captcha: { enabled, siteKey }` (`siteKey` only when enabled). No Vite build arg, so one web image still works for staging and production (`frontend/Dockerfile` comment). |
| C5. Routes | `POST /api/demo`, `POST /api/users`, `POST /api/users/requestPasswordReset`. Not Google signup completion (Google already checks the user). |
| C6. Outage | When Cloudflare cannot be reached (timeout 5 s, network error, 5xx): **demo refuses** (503 `captcha_unavailable`); **registration and password reset continue** and send a warning to Sentry. A failed check (Cloudflare answers "fail") always refuses. |
| C7. Refusal | 400 `captcha_failed` (no token, bad token, expired, used, wrong `action`). The frontend resets the widget and shows a translated message. |
| C8. Action binding | Each widget sends an `action` (`demo`, `register`, `password_reset`). The backend checks that the `action` in Cloudflare's answer matches the route, so a token from one form does not work on another. |
| C9. Order of checks | After the cheap input checks, **before** any database write or counter: demo: gate → languages → **captcha** → IP limit → live cap (a bot does not use a real visitor's IP starts). Register: field/language/theme checks → **captcha** → access gate → names → uniqueness. Reset: **captcha** first (the answer stays the same for every email). |
| C10. Demo statistics | `captcha_failed` is a counted demo refusal (`COUNTED_REFUSALS`, `backend/lib/demoStats.ts`), so the admin demo stats show bot pressure. |
| C11. Widget code | A small own React component that loads `https://challenges.cloudflare.com/turnstile/v0/api.js` once and uses explicit render. No npm dependency. The Caddyfile has no CSP, so no header change. |

## Slices

### Slice 1 — Backend (verify + gate + switch)

- Migration `0032_captcha_switch.sql`: `captcha_enabled boolean NOT NULL DEFAULT false` on
  `access_settings`; `backend/src/db/schema.ts`.
- `backend/lib/accessGate.ts`: `captcha: { enabled }` in `AccessSettings`/`getAccessSettings`
  (no row → off).
- New `backend/lib/captcha.ts`:
  - `captchaConfig()` — reads both env keys on each call (tests can change them).
  - `verifyCaptcha(token, { action, remoteIp })` — `fetch` to `siteverify` (form body: secret,
    response, remoteip), `AbortSignal.timeout(5000)`. Returns `ok` / `failed` / `unreachable`.
  - `assertCaptcha(req, action, { onUnreachable: "refuse" | "allow" })` — no-op when the switch is
    off or keys are missing; else throws `CaptchaError` (an `HttpError` with `apiCode`, like
    `AccessGateError`) on failure. Token from `req.body.captchaToken`; IP from `req.ip`
    (`trust proxy` is already 1, `backend/app.js:13`).
- Wire into `createDemo` (throw a `DemoError`-compatible code so `countRefusal`/`withStatus` keep
  working), `registerUser`, `requestPasswordReset`, at the points of C9.
- `backend/controllers/accessController.ts`: add `captcha` to `GET /api/access`.
- `backend/controllers/admin/accessController.ts` + `backend/routes/admin/` access routes:
  `PUT /api/admin/access/captcha` (`requireStaff('access.manage')`, audit row, C3 check); add
  `captcha: { enabled, configured }` to the admin `GET`.
- `deploy/env/app.env.example`: the two keys with a comment; `.github/workflows/deploy.yml`: add both
  keys to the staging and production `.env` blocks (next to `EKILEX_API_KEY`, lines ~129 and ~219).
- Jest (each test file uses `require('./request')`, see memory): `backend/tests/captcha.test.js`
  (mock `global.fetch`: pass, fail, wrong action, timeout → demo 503 / register passes, switch off
  → no call, keys missing → no call) and `backend/tests/adminAccessCaptcha.test.js` (switch, audit,
  `captcha_not_configured`). Existing tests stay green because the switch is off by default.

#### Slice 1 — what was built

- Migration `0032_captcha_switch.sql`; `captcha.enabled` in `getAccessSettings`.
- `backend/lib/captcha.ts` (`assertCaptcha`, `verifyCaptcha`, `captchaKeys`, `CaptchaError`). Test keys answer with no `action`, so a missing `action` in the answer is accepted; a real widget always sets one.
- Wired in `createDemo` (before the IP limit), `registerUser` and `requestPasswordReset`. `countRefusal` now counts any `HttpError` with a counted code; `captcha_failed` is a counted refusal.
- `GET /api/access` sends `captcha: { enabled, siteKey }` only when the switch is on AND both keys are set. Admin: `PUT /api/admin/access/captcha`, and `captcha: { enabled, configured }` in the admin answer.
- Deploy: both keys in `deploy.yml` (staging + production) and `app.env.example`. A missing GitHub secret gives an empty value = off.
- Tests: `captcha.test.js`, `adminAccessCaptcha.test.js`; two older tests got the new field.
- **For Slice 3:** the admin `DemoRefusalCode` type and the `DemoActivity` table (`admin/src/features/access/`) need a `captcha_failed` row.

### Slice 2 — Learner frontend (widget on three forms)

- `frontend/src/features/access/types.ts` + hooks: the `captcha` field.
- New `frontend/src/features/captcha/Turnstile.tsx`: loads the script once, renders managed mode
  with `sitekey`, `action`, `language` (from `i18n.language`), `theme` (app theme), callbacks
  `onToken` / `onExpire` / `onError`; exposes `reset()`. Renders nothing when captcha is off.
- `DemoPage.tsx` (step 2, above the start button), `RegisterForm.tsx` (step 2, above submit),
  the forgot-password part of `LoginForm.tsx`: the submit button stays disabled until a token
  exists (only when captcha is on); the token goes in the request as `captchaToken`; after any
  error answer, `reset()` (a token is single use).
- Error mapping: `captcha_failed`, `captcha_unavailable` in `features/auth/errors.ts` `CODE_TO_KEY`
  and `features/demo/errors.ts` `KNOWN`.
- Strings in EN/ES/DE/EE: the two errors and a short hint ("Checking that you are human…").
- Vitest: the component (script load mocked), each form sends the token and blocks submit with no
  token, resets after an error.

#### Slice 2 — what was built

- `frontend/src/features/captcha/`: `turnstile.ts` (script loader, typed API, `turnstileLanguage`), `CaptchaWidget.tsx` (draws the widget, redraws on a new theme or language, `resetKey` asks for a new token), `useCaptcha.tsx` (reads `captcha` from `GET /api/access`; gives `widget`, `token`, `ready`, `reset`).
- Wired into `DemoPage` (step 2), `RegisterForm` (step 2) and the request mode of `ResetPasswordForm` (the forgot-password form is on `/resetPassword`, not in `LoginForm`). The submit button waits for a token; `{ onError: captcha.reset }` asks for a new one after any refusal.
- `captcha_failed` also makes the app read `GET /api/access` again (the owner may have turned the switch on since the page loaded).
- Strings: `common:captcha.{failed,unavailable,loadError}` in EN/ES/DE/EE (ES/DE/EE need a native review).
- **Estonian:** Turnstile has no Estonian widget text. The widget uses `auto` for Estonian (browser language if supported, else English). Our own messages are translated.
- Tests: `captcha.test.tsx` (7), `turnstile.test.ts` (3). Full frontend suite green (138 files, 1884 tests).

### Slice 3 — Admin switch, e2e, docs

- `admin/src/features/access/pages/AccessPage.tsx` + `types.ts`: a Captcha card with the switch,
  disabled with "keys not set" when `configured` is false. Vitest for the card.
- e2e:
  - `e2e/fixtures/db.ts`: `setCaptchaEnabled()`; `e2e/fixtures/global-setup.ts`: turn it off before
    each run (same reason as onboarding: the other specs must not meet the widget).
  - `e2e/playwright.config.ts` backend `env`: the always-pass test keys. Trap: the repo-root `.env`
    wins (`dotenv override: true`), so a real key there breaks the spec — document it, like the
    Ekilex stub note.
  - New `e2e/tests/captcha-gate.spec.ts` (a `-gate` spec, so it runs alone): switch on → `/demo`
    shows the widget and a demo starts; register succeeds through the widget; forgot password
    sends; a direct API call with no token gets 400 `captcha_failed`; switch off at the end.
- Docs: this plan's "what was built" notes; infrastructure guide (secrets file and file 02):
  where the keys live, how to create the widget in the Cloudflare dashboard (managed mode,
  hostnames = staging + production domains), how to turn the switch on per environment.

#### Slice 3 — what was built

- Admin: a **Captcha** tab on the Access page (`CaptchaCard`, `useSaveCaptcha`, `saveCaptcha`; the tab value `captcha` in `search.ts`). Save is off when the keys are not set; a "keys are not set" warning shows. The Demo tab's refusal list has a "Failed human check" row (`captcha_failed`). Vitest: 5 new tests for the card, 1 changed.
- e2e: `setCaptchaEnabled` in `fixtures/db.ts`; `global-setup.ts` turns the switch off before every run; the backend gets Cloudflare's test keys in `playwright.config.ts`; new `captcha-gate.spec.ts` (6 tests: access answer, demo start, sign-up, password reset, direct API calls without a token, switch off). The spec calls the real Cloudflare (the widget and `siteverify`), so it needs internet. Turnstile draws its iframe in a closed shadow root, so the spec checks the app's own `captcha-widget` box, not the iframe.
- Docs: infrastructure guide, `02` (new "Captcha (Cloudflare Turnstile)" section with the steps per environment and the test keys), `06` (the two secrets), `07` (glossary).

## Open items

1. Review the ES/DE/EE texts (`common:captcha.*`).
2. Create the real widgets in Cloudflare (staging and production), add the GitHub Environment secrets, deploy, turn the switch on in the admin panel (guide `02`, "Turn it on for one environment"). Not done yet.
3. Estonian: Turnstile has no Estonian widget text (the widget uses `auto`).

## Out of scope (note for later)

- Move the demo per-IP limit from memory to the database (useful with or without the captcha).
- A rate limit on `POST /api/users`.

## Verification

1. `npm test -w backend` — all green, including the two new Jest files (no `| tail`, see memory).
2. `npm test -w frontend` and `npm test -w admin` — Vitest green.
3. `npm run test:e2e` — full suite green, including `captcha-gate.spec.ts`. Before the run, check
   for an orphaned backend on :5001 and closed gates in the local DB (memory: e2e stub env traps).
4. By hand (local, test keys): turn the switch on in the admin Access page, start a demo, register,
   request a reset; with the always-fail test secret, each form shows the translated error.
5. Staging, after deploy: create the real widget, add the keys as GitHub Environment secrets,
   deploy, turn the switch on, try the three forms in a normal and a private browser window.

## Review log

| # | Severity | Finding | Resolution |
|---|---|---|---|
