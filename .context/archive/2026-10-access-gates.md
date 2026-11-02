# Access gates (plan, 2026-10-01)

**Status:** done 2026-10-01 (6 steps in each of two PRs). Merged as #63 (`admin-registration-gate`), #64 (`admin-login-gate`) and #65 (`admin-login-gate-e2e-docs`). The live spec is `.context/features/access-control.md` (G-1 to G-10).

**Decisions kept:**
- G-1, G-2: two PRs; the login gate stops new sign-ins only. G-3: the panic button raises `users.token_version` for everyone.
- G-4 to G-6: fixed translated banners plus an untranslated extra line (300 characters); owner-only `access.manage`; staff never blocked.
- G-7: the allowed list holds user ids. G-8: leftover invites stay when registration is open. G-9: users list filter "Login allowed". G-10: no cache for the settings row.

**Plan versus built:**
- Added `POST /login-allowed/remove` (bulk), because the users list bar needs it.
- Added `POST /invites/:id/send` and the audit action `access.invite_send`.
- `verifyUser` and `signupComplete` answer with `loginBlocked` and no token when the gate refuses.
- The two cards on `/access` became two tabs driven by the URL (`?tab=login`) in the cosmetic slice after admin slice 9.
- The privacy page is unchanged: the allowed list holds ids of existing users.

**Traps:**
- The gate specs change global state, so each `*-gate.spec.ts` is its own Playwright project, chained after every other spec. A failure earlier skips them (14 tests did not run in one gate run; run them by hand with `--no-deps`).
- Registration `open` with login `limited` makes accounts that cannot sign in.
- The ES, DE and EE banner texts were drafts, and the privacy wording for invites was open. Both were reviewed and closed on 2026-11-02 (confirmed by the user).

**Old text:** `git log -- .context/plans/access-gates.md`
