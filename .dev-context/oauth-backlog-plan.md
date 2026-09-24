# Plan — OAuth backlog: stub e2e flakiness + real Google smoke check

> **Status: both slices done (2026-09-24).** Slice A: PR #49 (skips removed,
> real cause was missing Google credentials in CI, not SMTP — see A3).
> Slice B: PR #50 (redirect check in the staging smoke), production confirmed
> by hand. Below is the plan as approved, with results filled in where they
> changed it. Final docs: `.dev-context/oauth-login-strategy.md` Phase 6,
> `infrastructure-guide/05` and `06`.

## Context

Two items are left from the OAuth work (`.dev-context/oauth-login-strategy.md`):

1. **Stub OAuth e2e specs are skipped in CI.** `oauth-2` … `oauth-5` each have
   `test.skip(() => !!process.env.CI, …)` (e.g. `e2e/tests/oauth-2-google-login.spec.ts:42`).
   The suspected cause: a registration test fires an un-awaited SMTP send to
   `EMAIL_HOST=localhost:1025` (nothing listens there in CI). On CI, the refusal
   is slow, and the backend stalls. `backend/utils/sendEmail.js` now caps SMTP
   timeouts at 5 s, but we did not confirm this fix on real CI runs.
2. **Phase 6's last item: a real Google check on the deployed app.** The
   current staging smoke (`e2e/tests/deployed-smoke.spec.ts`) tests only
   password login. Nothing proves that the real Google client ID and the
   registered redirect URI work.

Decisions from the user (2026-09-24):
- Item 2 = **redirect check only**. No Google account, no full login automation.
- Item 2 runs in the **existing staging smoke job, blocking** production deploy.
  Production is checked manually one time.
- Item 1 exit rule = **5 green CI e2e runs in a row**.

Work in two slices. Each slice starts with a plain-language overview to the
user before any file changes (CLAUDE.md rule). The user makes all commits and
branches; Claude only drafts messages and names.

---

## Step 0 — Save this plan in the repo (before any other change)

Copy this plan, unchanged, into `.dev-context/oauth-backlog-plan.md` for
future reference. Later slices update its status (e.g. run IDs from Slice A,
spike results from B1) as work continues.

---

## Slice A — Re-enable the stub OAuth specs in CI

**Step A1 — Remove the skips, change nothing else.**
- Delete the `test.skip(...)` line and its comment block in:
  `e2e/tests/oauth-2-google-login.spec.ts`, `oauth-3-google-signup.spec.ts`,
  `oauth-4-linking.spec.ts`, `oauth-5-connected-methods.spec.ts`.
- Do not change `EMAIL_HOST` yet. If we change two things at once, a green
  result does not tell us which change fixed it.

**Step A2 — Collect evidence (5 runs).**
- User pushes the branch and opens a PR. CI runs once.
- Re-run only the e2e job with `gh run rerun <run-id> --job <job-id>` until
  there are 5 green runs in a row. Note: `ci.yml` has `retries: 2` in CI
  (`e2e/playwright.config.ts:40`). A test that passes only on retry is shown
  as "flaky" in the report. Count a run as green only if it has **0 flaky
  tests** in the oauth specs — check the report/log for "flaky", not only the
  job status.
- Record each run ID and result in the PR description.

**Step A3 — First CI run after A1 failed. Real cause found (2026-09-24).**
- The CI log showed every "Continue with Google" test failing on all 3
  attempts, waiting for a link that never rendered. The SMTP errors in the
  log were instant `ECONNREFUSED`, not slow. So the SMTP theory (and the 5 s
  timeout cap in `sendEmail.js`) was not the cause.
- Real cause: the frontend shows the link only if `/api/auth/providers`
  reports `google: true`. The backend reports that only if `GOOGLE_CLIENT_ID`
  and `GOOGLE_CLIENT_SECRET` are set. Locally the gitignored repo-root `.env`
  supplies them. CI has no `.env`, and `ci.yml` did not set them.
- Fix: fake `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in the backend `env`
  block of `e2e/playwright.config.ts`. The stub issuer accepts any client ID.
  No GitHub secret needed. Restart the 5-run count from the first run with
  this fix.
- Fallbacks, only if a run still fails after this fix (get evidence first):
  1. `EMAIL_HOST: 127.0.0.1` in `ci.yml`.
  2. Control test order (Playwright `projects` with `dependencies`). Ask the
     user before this step.

**Step A4 — Docs.** Update the "Phase 6 / revisit" comments that referred to
the skip (spec files, and any mention in `.dev-context/oauth-login-strategy.md`)
to state the result and the run IDs used as evidence.

---

## Slice B — Real Google redirect check in the staging smoke

**What the check proves:** Google accepts our client ID and our registered
redirect URI. This is the config that only Google owns and that the stub
tests cannot cover. It does not prove a full login.

**Step B1 — Spike (manual, read-only, no code).**
Use the Playwright MCP browser against `https://staging.ladu.com.ar`:
- Open `/api/auth/google/start`. Record the final URL and page content that
  Google shows for the **valid** case (expected: the Google sign-in page).
- Open the same authorize URL with a changed `redirect_uri` (and one with a
  wrong `client_id`). Record what Google shows for the **error** case
  (expected: a URL under `/signin/oauth/error` and text such as
  `redirect_uri_mismatch` / `invalid_client`).
- Confirm that headless Chromium gets the normal sign-in page, not a bot
  challenge. Show the results to the user before Step B2.

**B1 results (2026-09-24, staging, Playwright MCP browser):**

| Request | Final URL | Meaning |
|---|---|---|
| `/api/auth/google/start` (real flow) | `accounts.google.com/v3/signin/identifier?...`, title "Sign in - Google Accounts" | Accepted |
| Same authorize URL, wrong `redirect_uri` | `accounts.google.com/signin/oauth/error?authError=...` | `authError` decodes to `redirect_uri_mismatch` |
| Same authorize URL, wrong `client_id` | `accounts.google.com/signin/oauth/error?authError=...` | `authError` decodes to `invalid_client` |

The page text was German (browser locale), so B2 asserts on the URL path, not
on text. The headless-from-a-CI-IP question was not answered by the spike; it
was answered by the first real `smoke` run (below).

**Step B2 — Add one test to `e2e/tests/deployed-smoke.spec.ts`.**
Add a third test to the existing `test.describe.serial` block:
1. `request.get(`${baseURL}/api/auth/google/start`, { maxRedirects: 0 })`
   → expect status 302 and a `set-cookie` for the state cookie.
2. Parse the `location` header and assert:
   - host `accounts.google.com`;
   - `client_id` equals the new required env var `GOOGLE_CLIENT_ID`;
   - `redirect_uri` equals `${baseURL}/api/auth/google/callback`
     (built by `buildCallbackUri`, `backend/controllers/oauthController.ts:53`);
   - `response_type=code`, `scope=openid email profile`
     (`backend/lib/oauth/providers/google.ts:45`), `code_challenge_method=S256`,
     and `state`/`nonce` present.
3. `page.goto(location)` and assert the markers found in B1: the final URL is
   not under `/signin/oauth/error`, and the page does not contain
   `invalid_client` or `redirect_uri_mismatch`.
- Reuse the file's existing `requireEnv()` helper for `GOOGLE_CLIENT_ID`.
- Update the file's top comment (required env vars list).

**Step B3 — Wire the env var into `.github/workflows/deploy.yml`.**
In the `smoke` job's "Run smoke test" step (~line 164), add
`GOOGLE_CLIENT_ID: ${{ secrets.GOOGLE_CLIENT_ID }}`. The `staging`
Environment already has this secret (used at line 128). **No new secret.**
Also update `e2e/playwright.deploy.config.ts`'s comment if it lists the env vars.

**Step B4 — Run locally against staging first.**
`BASE_URL=https://staging.ladu.com.ar SMOKE_TEST_EMAIL=… SMOKE_TEST_PASSWORD=… EXPECTED_SHA=<current staging sha> GOOGLE_CLIENT_ID=… npm run test:e2e:smoke`
(user supplies the values). Also run once with a wrong `GOOGLE_CLIENT_ID` to
see the test fail for the right reason.

**Step B5 — Production, one time, manual. DONE (2026-09-24).**
After the first deploy with this change, open
`https://app.ladu.com.ar/api/auth/google/start` in a browser and confirm the
Google sign-in page appears. Record the date in the docs.
Result: the first `smoke` run (deploy run 36036365497, commit `bd26642`)
showed `3 passed (9.6s)` — 2 old tests plus the new one; GitHub's `github`
reporter prints counts, not names of passing tests, so the new test's name was
not in the log (fixed afterwards: `playwright.deploy.config.ts` now also uses
the `list` reporter in CI). The user then checked production by hand and saw the Google
sign-in page.

**Step B6 — Docs.**
- `.dev-context/oauth-login-strategy.md` §Phase 6 (~lines 418–422): change the
  "e2e" and "Gate" bullets to the redirect-check approach; state why full
  login automation was not done (Google blocks automated sign-ins; the
  disposable-account option stays open for later). Mark Phase 6 done.
- `.dev-context/infrastructure-guide/06-secrets-and-access.md`: note that the
  `smoke` job now also reads `GOOGLE_CLIENT_ID` from the `staging` Environment.
- If the check fails, add a short entry to
  `.dev-context/infrastructure-guide/05-troubleshooting-playbook.md`
  (what `redirect_uri_mismatch` / `invalid_client` mean and where to fix them
  in Google Cloud Console).
- Update memory: `project_deployment_strategy_progress.md` if relevant.

---

## Verification

- **Slice A:** 5 consecutive CI e2e runs, all green, 0 flaky oauth tests.
  Locally: `npm run test:e2e` still green (do not pipe through `tail`/`head`).
- **Slice B:** `npm run test:e2e:smoke` green against staging locally; red
  with a wrong client ID; then green in the real `deploy.yml` `smoke` job
  after merge, with production deploy proceeding after it.
- `npm run lint` / `npm run typecheck` for the `e2e` workspace if it has them.
