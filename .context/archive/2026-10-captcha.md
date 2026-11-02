# Captcha with Cloudflare Turnstile (plan, 2026-10-19)

**Status:** done 2026-10-19 (slices 1 to 3), merged in PR #95. Rollout done (confirmed by the user, 2026-11-02). The live spec is `.context/features/captcha.md`.

**Decisions kept:** C1 to C11 of the plan, all in the spec. Key constraints: an admin switch with no deploy (C2); keys in the backend env, site key at runtime in `GET /api/access` (C3, C4); an `action` bound to each route (C8); a fixed order of checks, captcha before any write (C9); the demo and the access request refuse when Cloudflare is down, registration and reset continue (C6).

**Plan versus built:**
- The forgot-password form is on `/resetPassword`, not in `LoginForm`.
- Cloudflare's test keys answer with no `action`, so a missing action is accepted.
- The access-request route was added later with the action `access_request` (spec section 2).
- `captcha_failed` makes the app read `GET /api/access` again.

**Traps:** the repo-root `.env` wins over the e2e keys; `global-setup.ts` turns the switch off before each run; the gate spec needs the internet.

**Old text:** `git log -- .context/plans/captcha.md`
