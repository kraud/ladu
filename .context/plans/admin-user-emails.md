# Plan: Admin user emails ("Resend verification email" and "Send password reset")

Status: built on 2026-10-01, not deployed yet. Branch: `admin-user-emails`. All decisions in the table below were confirmed as written.

Build notes:
- Shared code: `backend/lib/accountEmails.ts`. The public handlers (`registerUser`, `requestPasswordReset`) use it too. Behavior is unchanged.
- The admin runner got two optional `ActionSpec` fields: `cooldownMinutes` and `auditMetadata`. `apply` can now return a function that the runner calls after the commit.
- Tests: `backend/tests/adminUserEmails.test.js`, `admin/src/features/users/UserActions.test.tsx`, `e2e/tests/admin-10-user-emails.spec.ts`. The cooldown test moves the audit rows into the past instead of using fake timers. The "no email on rollback" test forces a failure after the action ran.
- Docs: the playbook entry "A user did not get the verification or reset email".
- Follow-up, same branch: the public `requestPasswordReset` now answers 200 with the same message for an unknown, a throttled and a sent request. It allows one email per account every 5 minutes (the newest `password_reset_tokens.createdAt` of any origin starts the window, under a row lock). The learner app shows a matching toast in all four languages, and the "no user registered" error text is gone from the frontend.
- Next: `.context/plans/access-gates.md`.

This plan adds the last two actions that `.context/plans/admin-dashboard.md` §3 lists under "Actions" for a user, and that slice 5 left out. It is a small, separate PR. It comes **before** `.context/plans/access-gates.md`.

## How to start (read this first in a new session)

1. Read `CLAUDE.md` and `.context/README.md`. Follow the working rules there: one small slice, an overview in plain language **before** any file changes, ask before assuming, docs and tests with the code, a green Playwright run at the end. The user runs `git commit`; you only draft messages.
2. Read `.context/plans/admin-dashboard.md` (status notes at the top, slices 5 and 8 especially). The admin app is `admin/`; its API is `backend/controllers/admin/` and `backend/routes/admin/`.
3. Confirm the branch is `admin-user-emails` (`git branch --show-current`). Never edit on `main`.
4. Give the user the overview, and confirm the **Decisions to confirm** below. Then build.

## Context

A support person sometimes has to help a user who did not get the verification email, or who cannot reset a password. Today there is no way to do this in the admin panel. The public flows exist and work:

- **Verification email.** `registerUser` (`backend/controllers/userController.ts`) inserts a row in `tokens` (`userId` is **UNIQUE**: one outstanding token per user; the link never expires), then calls `sendMail({ email, url, name, type: "verifyEmail", language })`. The link is `${BASE_URL}/user/${user.id}/verify/${token}`. `verifyUser` marks the user verified, deletes the token and returns a login token.
- **Password reset email.** `requestPasswordReset` inserts a row in `password_reset_tokens` (**several** outstanding rows are allowed; a link lives 30 minutes; one use), then calls `sendMail({ ..., type: "resetPassword", language: user.uiLanguage })`. The link is `${BASE_URL}/resetPassword/${user.id}/${token}`. `updatePassword` consumes it and deletes the user's other outstanding rows.
- `sendMail` (`backend/utils/sendEmail.js`) never rejects: it catches its own send errors and only logs them. So **delivery cannot be known**. Controllers do not await it.

The admin app already has user actions (ban, unban, force logout, delete, restore, purge). They run in `backend/controllers/admin/userController.ts` through one `userAction(name)` runner with an `ACTIONS` map (lock the row, check the state, apply, write an audit row, all in one transaction). The UI is `admin/src/features/users/components/UserActions.tsx` (`CONFIG` and `BY_STATUS`). The two new actions fit this pattern, with one difference: an email must be sent **after the transaction commits**.

## Decisions to confirm with the user at the start

These are my recommendations. Confirm them in one question before coding. Change what the user changes.

| Topic | Recommendation |
|---|---|
| Permission | A new permission `users.email`, given to `support`, `admin` and `owner` (not `viewer`). Reusing `users.ban` would work, but the name would lie. |
| Cooldown | The same email type to the same user at most once every 5 minutes. The server checks the audit log (no new table). A second try gets 429 and a message that says when it can be done again. This also stops a double click. |
| Verification: who can get it | Only a user who is **not verified** and **not deleted**. A verified user needs none. |
| Verification: token | **Reuse** the existing `tokens` row (the link never expires, so every email stays valid). Create a row only if none exists. Never rotate it. |
| Reset: who can get it | Only a user who has a **password** (`users.password` is not null) and is **not deleted**. A Google-only user has no password: the button is hidden. (The public reset flow would let a Google-only user add a password; the admin action should not do that silently.) A banned user may get it. |
| Reset: token | A **new** `password_reset_tokens` row each time, like the public flow. Old outstanding links stay valid until used or expired. |
| Language | The user's `uiLanguage` (as the public flows do). |
| Reason | Optional for both. |
| What the staff member sees | "The email was handed to the mail service." The UI must **not** say "delivered": delivery is not known. |
| Audit | One row for each email: `user.resend_verification` and `user.send_password_reset`, with `metadata: { email, language }`. Never the token or the link. |

## Design

### Backend

1. **Share the email code.** Move the two "issue a token and send the email" blocks out of `userController.ts` into one module, for example `backend/lib/accountEmails.ts`, with `issueVerificationEmail(user, executor)` and `issuePasswordResetEmail(user, executor)`. The public handlers and the admin actions both call it. Keep the public behavior and messages exactly as they are (the existing tests in `tests/auth.test.js` and `tests/email-templates.test.js` must pass unchanged). The functions write the token row with the given executor (a transaction) and **return a function that sends the email**; the caller runs it after the commit.
2. **Two new actions** in the `ACTIONS` map of `backend/controllers/admin/userController.ts`: `resend-verification` and `send-password-reset`. Add to `ActionSpec` an optional `afterCommit` hook, which the runner calls after the transaction commits, so no email is sent for a change that rolled back.
   - `blockedBy` follows the table above (409 with a clear message: "This account is already verified", "This account is deleted", "This account has no password").
   - The cooldown check runs inside the transaction, after the `FOR UPDATE` lock, against `audit_log` (`action`, `target_id`, `created_at > now() - interval '5 minutes'`).
3. **Routes:** `POST /api/admin/users/:id/resend-verification` and `POST /api/admin/users/:id/send-password-reset`, both with `requireStaff('users.email')`.
4. **Permission map** (`backend/lib/adminPermissions.ts`): add `users.email` to `support`, `admin` and (via `PERMISSIONS`) `owner`. Update the test of the role map and the test fixtures in the admin app (`admin/src/test/msw/handlers.ts`, `PERMISSIONS_BY_ROLE`).
5. **User detail:** nothing new is needed; `status`, `verified` (the response has it) and `hasPassword` are already in `GET /api/admin/users/:id`.

### Admin app

- In `UserActions.tsx`: two new entries in `CONFIG` and in `BY_STATUS` (or a rule next to it), shown only when the account is eligible **and** the person has `users.email` (`useCan`). Each opens the same confirm dialog (optional reason). The notice after success says "The email was handed to the mail service. We cannot tell if it arrived."
- The server's 429 message is shown inside the dialog, like the other server refusals.

### Tests

- **Jest** (new file `tests/adminUserEmails.test.js`, with `jest.mock('../utils/sendEmail', ...)` like the other suites): permissions for all four roles and a learner token; eligibility (verified, deleted, no password, Google-only); the verification token row is reused and never duplicated; a new reset row is created each time and old ones stay; the email is sent exactly once, with the right type, link host, language and recipient; **no email when the transaction fails**; the cooldown (second call 429, a call after the window works; use fake time as in `tests/activityDays.test.js`); two parallel clicks send one email; the audit row has the email and no token or link anywhere (also search the response); an unknown id and a non-UUID give 404.
- **Existing suites** must stay green after the refactor: `auth.test.js`, `email-templates.test.js`, `oauth.test.js`.
- **Vitest:** buttons appear only for eligible accounts and permitted roles; the dialog; the 429 message; the notice wording.
- **Playwright** (`e2e/tests/admin-10-user-emails.spec.ts`): the e2e backend cannot reach a mail server, and `sendMail` swallows that. So the spec checks the **database** (a token row exists, an audit row exists) and the UI, not an inbox.

### Docs

- Plan file status notes (this file, then `.context/plans/admin-dashboard.md`).
- `.dev-context/infrastructure-guide/05-troubleshooting-playbook.md`: a short entry, "A user did not get the verification or reset email", that says to use the new actions and to look at the Resend dashboard for delivery, because the admin panel cannot know.

## Out of scope

- Knowing whether an email was delivered (needs Resend webhooks or the Resend API).
- A throttle on the **public** `requestPasswordReset` endpoint (it has none today, and it answers "no user registered with the email given", which tells an outsider which emails exist). Note it for the user as a separate item.
- Changing the email templates.

## Verification (end of the slice)

- `npm test -w backend` (the new suite and the three existing suites above), `npm test -w admin`, lint, typecheck and build for both.
- `npm run test:e2e -- admin-` is green. The OAuth specs fail when `npm run dev` already runs a backend on `:5001`: stop it first, or run only the admin specs.
- Look at the dialog in a browser (desktop and phone width).
- Deploy impact: **no migration, no new secret.** It deploys with a normal merge.
