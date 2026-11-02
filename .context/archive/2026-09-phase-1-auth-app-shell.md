# Phase 1: auth and app shell (plan, 2026-09-08)

**Status:** done 2026-09-10. PR #1 (`auth-and-app-shell`, `0cf091f`). Final state: backend 144, frontend 98, e2e 7. The live spec is `.context/features/auth-and-shell.md`.

**Decisions kept:** P1-1 to P1-9 in the spec (unverified users are blocked; shadcn bridged onto the Ladu tokens; no password hash or `passwordTokens` in responses; four locales together; the home page is only the welcome banner; no `useQuery` in this phase; registration language step; public language selector; profile editing on `/user`). Code cites "decisions 5 to 7" (WelcomeBanner): they are P1-5 to P1-7.

**Plan versus built:**
- Dashboard and metrics left the phase on 2026-09-10 and became Phase 3.5 (`features/dashboard.md`).
- Five shadcn primitives (`dialog`, `alert-dialog`, `checkbox`, `radio-group`, `textarea`) waited for Phase 2.
- Three additions the blueprint did not have: the registration language step, the public UI-language selector, and the `/user` profile edit.
- `VerifyEmailBanner` was dropped (P1-1).

**Kill-switch result:** 5 slices in 3 sessions, on scope. Verdict: continue the rewrite.

**Traps:** see the spec, section 3 (shadcn init, `@theme` and `color-mix()`, `noUnusedLocals`, i18next Suspense, `ee` is not an ISO code).

**Slice order (for old citations):** 0 plan, 1 design system, 2 app plumbing, 3 auth pages, 4 app shell and home, 5 backend hygiene and gate.

**Old text:** `git log -- .context/plans/phase-1-auth-app-shell.md`
