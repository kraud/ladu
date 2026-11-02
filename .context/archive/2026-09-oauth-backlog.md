# OAuth backlog: stub e2e flakiness and the real Google smoke check (plan, 2026-09-24)

**Status:** both slices done 2026-09-24. Slice A is PR #49 (skips removed). Slice B is PR #50 (redirect check in the staging smoke, production confirmed by hand). The design is in `.context/features/oauth-login-strategy.md` (Phase 6); the operator steps are in `.context/guides/infrastructure-guide/05` and `06`.

**Decisions kept:**
- The real-Google check is a **redirect check only**. It uses no Google account and no full login automation.
- It runs in the existing staging smoke job and blocks the production deploy. Production is checked by hand once.
- The exit rule for the stub specs was 5 green CI e2e runs in a row.

**Plan versus built:**
- The suspected cause of the skipped `oauth-2` to `oauth-5` specs was an SMTP send to `localhost:1025`. The real cause was missing Google credentials in CI (the stub issuer needs them). The skips (`test.skip(() => !!process.env.CI)`) were removed.
- `backend/utils/sendEmail.js` caps SMTP timeouts at 5 s.

**Traps:**
- The OAuth e2e specs need the backend that Playwright starts. A dev backend on `:5001` makes them call the real Google (see the full e2e runs that failed exactly these specs).
- A failed "Google sign-in wiring" step in the smoke stops the production deploy: read the table of messages (`redirect_uri_mismatch`, `invalid_client`, and so on) in the troubleshooting playbook.

**Old text:** `git log -- .dev-context/oauth-backlog-plan.md`
