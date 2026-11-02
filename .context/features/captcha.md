# Captcha (Cloudflare Turnstile)

## Summary

Four public routes do expensive work for anyone on the internet: starting a demo, registering, asking for a password reset, and asking for access. This feature adds a short human check (Cloudflare Turnstile, "managed" mode) to them. Most visitors see only a quick "Success" mark. The owner turns the check on or off in the admin panel, with no deploy.

Live spec. It replaces the finished plan `captcha.md` (archive record: `.context/archive/2026-10-captcha.md`). Built 2026-10-19 (slices 1 to 3), merged in PR #95. Gate: `e2e/tests/captcha-gate.spec.ts` (a `-gate` spec: it needs the internet and uses Cloudflare's test keys). Operator steps: `.context/guides/infrastructure-guide/02-environments-and-databases.md`, "Captcha (Cloudflare Turnstile)".

Code map: backend `backend/lib/captcha.ts` (`assertCaptcha`, `verifyCaptcha`, `captchaKeys`, `CaptchaError`), `lib/accessGate.ts` (`captcha` in the settings), `controllers/admin/accessController.ts`; migration `0032_captcha_switch.sql`; frontend `frontend/src/features/captcha/` (`turnstile.ts`, `CaptchaWidget.tsx`, `useCaptcha.tsx`); admin `admin/src/features/access/` (the Captcha tab, `CaptchaCard`).

## 1. Decisions (taken with the user on 2026-10-19)

| ID | Decision |
|---|---|
| C1 | Provider: Cloudflare Turnstile, **managed** mode. |
| C2 | An admin switch on the Access page: `access_settings.captcha_enabled`, off by default, audit `access.captcha_configure`. Same pattern as the onboarding switch. |
| C3 | Keys `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` in the backend env (GitHub Environment secrets, written to `/opt/ladu/<env>/.env` by `deploy.yml`). The switch cannot be turned on while a key is missing (400 `captcha_not_configured`). If the keys are removed while the switch is on, the routes act as off and log once per start. |
| C4 | The site key reaches the browser at **runtime** in `GET /api/access`: `captcha: { enabled, siteKey }`, with `siteKey` only when the switch is on and both keys are set. No build argument, so one web image serves staging and production. |
| C5 | Routes: `POST /api/demo`, `POST /api/users`, `POST /api/users/requestPasswordReset`, and `POST /api/access/request` (action `access_request`). Not Google sign-up completion (Google already checks the user). |
| C6 | Outage rule: when Cloudflare cannot be reached (5 s timeout, network error, 5xx), the **demo and the access request refuse** (503 `captcha_unavailable`); registration and password reset **continue** and send a warning to Sentry. A failed check always refuses. |
| C7 | A refusal is 400 `captcha_failed` (no token, bad, expired, used, wrong action). The frontend resets the widget and shows a translated message. |
| C8 | Each widget sends an `action` (`demo`, `register`, `password_reset`, `access_request`). The backend checks that the action in Cloudflare's answer matches the route, so a token from one form does not work on another. |
| C9 | Order of checks: after the cheap input checks and **before** any database write or counter. Demo: gate, languages, **captcha**, IP limit, live cap. Register: field, language and theme checks, **captcha**, access gate, names, uniqueness. Reset: captcha first (the answer stays the same for every email). |
| C10 | `captcha_failed` is a counted demo refusal (`COUNTED_REFUSALS`, `lib/demoStats.ts`), so the admin demo statistics show bot pressure. The Demo tab has a "Failed human check" row. |
| C11 | A small own React component loads `https://challenges.cloudflare.com/turnstile/v0/api.js` once and uses explicit render. No npm dependency. The Caddyfile has no CSP, so no header change. |

## 2. Contract

- `assertCaptcha(req, action, { onUnreachable: 'refuse' | 'allow' })` is a no-op when the switch is off or a key is missing. Otherwise it reads `req.body.captchaToken`, calls Cloudflare's `siteverify` (form body: secret, response, remoteip; `req.ip`, with `trust proxy` 1), and throws `CaptchaError` (an `HttpError` with `apiCode`) on failure.
- Cloudflare's test keys (site `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA`) always pass and answer with no `action`, so a missing `action` in the answer is accepted. A real widget always sets one.
- Admin: `PUT /api/admin/access/captcha` (`access.manage`, one audit row per real change); the admin `GET` has `captcha: { enabled, configured }`.
- Frontend: the submit button waits for a token (only when the switch is on). The token goes in the request as `captchaToken`. After any refusal, `{ onError: captcha.reset }` asks for a new token (a token is single use). `captcha_failed` also makes the app read `GET /api/access` again, because the owner may have switched the check on since the page loaded. The forgot-password form is on `/resetPassword`, not in `LoginForm`.
- Estonian: Turnstile has no Estonian widget text, so the widget uses `auto`. Our own messages (`common:captcha.{failed,unavailable,loadError}`) are translated.

## 3. Traps

- The repo-root `.env` wins over the e2e keys (`dotenv` `override: true`): a real Turnstile key there breaks the gate spec.
- `e2e/fixtures/global-setup.ts` turns the switch off before each run, so the other specs never meet the widget. The gate spec turns it on and off again.
- Each Jest file must use `require('./request')` (one server per file).
- A missing GitHub secret gives an empty value, which means off.

## 4. Open items

Closed 2026-11-02 (confirmed by the user): the review of the ES, DE and EE texts, and the rollout (real widgets, secrets, deploy, switch on). The Estonian widget text is a limit of the service and needs no action.

Not planned (kept as ideas in `.context/backlog/deferred-ideas.md` if wanted): moving the demo per-IP limit from memory to the database; a rate limit on `POST /api/users`.
