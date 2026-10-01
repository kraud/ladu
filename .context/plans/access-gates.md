# Plan: Access gates (control who can register and who can sign in)

Status: planned on 2026-10-01. **PR 1 (`admin-registration-gate`) is built and merged to `main`. PR 2 (`admin-login-gate`) is in progress: step 1 (migration `0017_access_gates_login.sql`, table `login_allowed_users`, user ids with `ON DELETE CASCADE`) is done. Step 2 (the backend login gate) is done: `getLoginBlock` and `enforceLoginGate` in `lib/accessGate.ts`, run after the password and ban checks in `loginUser`, `link`, the Google callback (redirect `#error=login_closed` or `#error=login_not_allowed`), `signupComplete` and `verifyUser`. Two answers have no token and no error: `verifyUser` answers 200 `{ message, verified: true, loginBlocked }` (the email is verified and the link is used up), and `signupComplete` answers 201 `{ loginBlocked, message }` (the account exists). The learner app must handle `loginBlocked` (step 4). Tests: `backend/tests/accessGateLogin.test.js`. Confirmed with the user: the panic-button phrase is `SIGN OUT EVERYONE`, and the users list gets a "Login allowed" filter.** PR 1 build notes: step 1 (migration `0016_access_gates_registration.sql`, which also seeds the settings row; `tests/db.js` re-seeds it after each truncate) is done. Step 2 (the backend gate) is done: `lib/accessGate.ts`, the gate in `registerUser` and `signupComplete` (user, invite and token in one transaction), and the public `GET /api/access`. Tests: `backend/tests/accessGateRegistration.test.js`. Step 3 (the admin API) is done: permission `access.manage` (owner only), `controllers/admin/accessController.ts` (`GET /api/admin/access`, `PUT .../registration`, `POST .../invites`, `DELETE .../invites/:id`), shared helpers in `lib/adminRequest.ts`, tests in `backend/tests/adminAccess.test.js`. Step 4 (the learner app) is done: `frontend/src/features/access/` (`useAccess`, `AccessBanner`), the register page states (closed turns the form and the Google button off through a disabled `<fieldset>`), `errors.ts` reads the `code` first, the `access` block in the 4 `loginRegister.json` files, tests in `access.test.tsx`. The ES, DE and EE texts are drafts: a native speaker must check them. Step 5 (the admin page) is done: `admin/src/features/access/` (page `/access`, owner only, header link "Access"), a three-way control with a confirm dialog and an optional reason, the extra line (300 characters), the invite list (bulk paste, result summary with reasons, remove). The list shows even when the state is not limited, with a note that it stays. Tests: `AccessPage.test.tsx`. `FormDialog` in `StaffDialogs.tsx` is now exported and reused. Step 6 is done: Playwright spec `e2e/tests/admin-11-registration-gate.spec.ts` (7 tests: owner only, limited with the empty-list warning and the learner banner, bulk invites and a real sign-up that uses one up, remove, closed, staff never blocked, open again), the `gates` Playwright project (specs named `*-gate.spec.ts` run after every other spec, because the gate is global state; a failure in the main project skips them), e2e DB helpers, and the operator guide entry "Nobody can register" in `05-troubleshooting-playbook.md` (with the one-line SQL way back). Open for the user: the privacy wording (see below).The bulk add skips invalid, repeated, already listed and already registered emails and says why; it takes at most 500 emails. A change that changes nothing writes no audit row. `.context/plans/admin-user-emails.md` is merged to `main` (PR #62), so this is next. Two PRs:

1. `admin-registration-gate` (the settings, the banner machinery, and the registration gate)
2. `admin-login-gate` (the login gate, the allowed-accounts list, the bulk selection, and the "sign everyone out" panic button)

## How to start (read this first in a new session)

1. Read `CLAUDE.md` and `.context/README.md`. Follow the working rules: one small slice, an overview in plain language **before** any file changes, ask before assuming, docs and tests with the code, a green Playwright run at the end. The user runs `git commit` and creates branches; you only draft messages and names.
2. Read `.context/plans/admin-dashboard.md` (status notes at the top). The admin app is `admin/`; its API is `backend/controllers/admin/` and `backend/routes/admin/`. The learner app is `frontend/`.
3. These two PRs change how **learners** register and sign in. A bug can lock everyone out. Test every path with all three states, and tell the user to try each PR on **staging** before production.
4. Confirm the branch for the PR you start (`git branch --show-current`). Never edit on `main`.

## Goal

The owner can switch **registration** and **login** each between three states, from the admin panel, with no deploy:

| State | Registration | Login |
|---|---|---|
| `open` (default) | Anybody can register (today's behavior). | Anybody can sign in (today's behavior). |
| `closed` | Nobody can register. A small banner says so on the register page. | Nobody can sign in. A banner says so on the login page. For emergencies and unstable periods. |
| `limited` | Only emails on a list the owner manages. The email leaves the list when that person registers. Any other email fails with a clear message. | Only accounts on a list the owner manages (added by email, or ticked in the users table, also in bulk). |

Plus a **panic button**: sign every learner out at once. With login `limited`, only allowed accounts can then sign back in.

## Decisions (made with the user on 2026-10-01)

| Topic | Decision |
|---|---|
| Split | Two PRs (above). Registration first: it only stops new accounts, and it builds the parts that login reuses. |
| Default | Both gates `open`. A deploy changes nothing until the owner flips a switch. |
| People who are already signed in | The login gate blocks **new** sign-ins only. Open sessions (a learner token lasts 30 days) keep working. |
| Panic button | A separate action that ends all learner sessions at once, so it works together with `limited` login. It is in PR 2. |
| Banner text | A fixed message for each state, translated into the 4 languages (EN, ES, DE, EE). Plus an **optional extra line** that the owner types for each gate (for example "Back at 14:00 UTC"). The extra line is **not translated**: it is plain text, shown under the translated message. |
| Who may manage it | The owner role only (a new permission `access.manage`; `owner` has every permission already). |
| Staff | Never blocked by a gate. Staff accounts are separate (`staff_accounts`), so the owner can always open a gate again. |

## Design

### Data (migration, adds tables only)

- `access_settings`: **one row** (`id` fixed to 1, with a check). Columns: `registration_mode`, `registration_note`, `login_mode`, `login_note`, `updated_at`, `updated_by_staff_id`. A check allows only `open`, `closed`, `limited`. The migration inserts the row with both modes `open` and empty notes. A note has at most 300 characters.
- `registration_invites` (PR 1): `id`, `email` (stored lowercase, **unique**), `created_at`, `created_by_staff_id`.
- `login_allowed_users` (PR 2): `user_id` (primary key, foreign key to `users` with `ON DELETE CASCADE`), `added_at`, `added_by_staff_id`. It holds **user ids**, not emails, so it survives an email change. Adding by email looks the account up (and refuses an unknown email).
- Read the settings row on each request that needs it (one primary-key read). No cache: a change must take effect at once, and the cost is tiny.

### Public status endpoint (PR 1)

`GET /api/access` (no login): `{ registration: { mode, note }, login: { mode, note } }`. It never returns a list. The learner app shows banners from it. If it fails, the learner app **acts as if open** (the server enforces the gate anyway; a banner is a courtesy).

### Errors use a machine-readable code

`backend/middleware/errorMiddleware.js` can send `{ message, code }` when the thrown error has `apiCode` (added in admin slice 8; see `PASSWORD_CHANGE_REQUIRED` in `backend/middleware/staffAuth.ts` for the pattern). The learner app today maps errors by matching the message text (`frontend/src/features/auth/errors.ts`). For the gates, use codes (HTTP 403):

- `registration_closed`: registration is closed.
- `registration_not_invited`: registration is limited and this email is not on the list. **One message for every unlisted email**; it must not reveal which emails are on the list.
- `login_closed`
- `login_not_allowed`: login is limited and this account is not on the list.

Update `errors.ts` to look at `code` first, then fall back to the message. For the Google callback, which redirects with `#error=<code>` (see `OAUTH_ERROR` in `backend/controllers/oauthController.ts` and `OAUTH_ERROR_CODE_TO_KEY` in `errors.ts`), add the same codes.

### PR 1: the registration gate

**Backend**
- A helper, for example `backend/lib/accessGate.ts`, that reads the settings row.
- `registerUser` (`backend/controllers/userController.ts`): check the gate **before** the "Email already in use" check, so a closed or limited gate does not leak which emails exist. For `limited`, the user insert, the token insert and the **deletion of the invite** (`DELETE ... WHERE email = lower($1) RETURNING`) run in **one transaction** (wrap them in `db.transaction`, as admin actions do). Two parallel sign-ups with the same invite then cannot both pass. If no invite row is deleted, roll back with `registration_not_invited`. In `open` mode, also delete a matching invite if there is one (cleanup).
- The Google sign-up (`signupComplete` in `oauthController.ts`) is gated the same way, with the email that Google confirmed (`payload.email`). The callback that only **issues a signup ticket** may stay ungated, but the account is created only in `signupComplete`, so gate there.
- Admin API (`access.manage`, owner): `GET /api/admin/access` (settings, the invites, counts), `PUT /api/admin/access/registration` (`{ mode, note, reason? }`), `POST /api/admin/access/invites` (`{ emails: string[] }`, bulk; trims, lowercases, validates, ignores duplicates, reports what was added and what was skipped), `DELETE /api/admin/access/invites/:id`.
- Every change writes an audit row in the same transaction: `access.registration_mode` (metadata: old and new mode, note changed), `access.invite_add`, `access.invite_remove`. Invite consumption by a registration also writes one (`access.invite_used`, `staffId` null, email in metadata), so the audit page shows it.
- New permission `access.manage` in `backend/lib/adminPermissions.ts` (owner only, like `users.purge`). Update the role-map test and `admin/src/test/msw/handlers.ts`.

**Learner app** (`frontend/`)
- A hook for `GET /api/access` (React Query, short `staleTime`, refetch on focus) and a small `AccessBanner` component. Put them in a new feature folder, for example `frontend/src/features/access/`.
- `RegisterPage.tsx`: for `closed`, show the banner (plus the owner's extra line), and disable the form and the Google button. For `limited`, show a gentler note. The server still enforces.
- New translated strings in `frontend/public/locales/{en,es,de,ee}/loginRegister.json` (a new `access` block) for the banner texts and the two registration error codes. Draft English text, to be translated:
  - closed: "Sign-ups are closed for now. Please check back later."
  - limited: "Sign-ups are open by invitation only right now."
  - not invited: "Sign-ups are by invitation only right now. This email is not on the list."
- Tests: Vitest for the banner and the states; MSW handlers for `/api/access`; the existing auth tests must stay green.

**Admin app** (`admin/`)
- A new page `/access` (header link "Access", shown with `access.manage`; route guard like `/staff`).
- Registration section: a three-way control (closed, open, limited) with a short explanation of each, the extra-line field (300 characters), a **Save** with a confirm, and, for `limited`, the **invites table**: a text area to paste many emails (one for each line, or comma separated), a result summary (added, skipped, why), the list with a remove button for each row, and a count. A warning when the state is `limited` and the list is empty ("nobody can register").
- Tests (Vitest), and a Playwright spec `admin-11-registration-gate.spec.ts`: the owner sets `limited`, adds an email; a real `POST /api/users` with another email fails with the code; with the listed email it succeeds and the invite is gone; `closed` blocks both; `open` allows. Check the database for the invite.

### PR 2: the login gate and the panic button

**Backend**
- Add the login check **after the password check** (and after the ban check), so it never confirms that an email exists: a wrong password still answers "Invalid credentials". Put it in these places, all of which end in a session token:
  - `loginUser` (`userController.ts`);
  - the Google callback for an already-linked identity (`oauthController.ts`, the "outcome (a)" branch, which redirects with `#error=<code>`);
  - `signupComplete` and `link` (both return `serializeLoginUser`);
  - `verifyUser` (it returns a token). If the gate blocks, still mark the email verified, but return **no token**, and answer so the app can say "Your email is verified. Sign-in is limited right now."
- Interaction to test: registration `open` plus login `limited`. A new account is created, but it is not on the list, so it cannot sign in (`signupComplete` creates it, then answers `login_not_allowed` instead of a token). Say this in the admin page text.
- Admin API (`access.manage`): `PUT /api/admin/access/login` (`{ mode, note, reason? }`), `POST /api/admin/access/login-allowed` (`{ userIds?: string[], emails?: string[] }`, bulk; reports unknown emails and ids), `DELETE /api/admin/access/login-allowed/:userId`, and the **panic button** `POST /api/admin/access/sign-out-everyone` (`{ confirm: "SIGN OUT EVERYONE", reason }`).
- **Panic button = `UPDATE users SET token_version = token_version + 1`** for all users, in one statement. `protect` already compares the token's `tv` with `users.token_version` on every request (`backend/middleware/authMiddleware.ts`), so every learner gets a 401 at the next request and the app returns to the login page. No new per-request check. Staff tokens are separate and unaffected. The answer returns how many users were affected. Audit: `access.sign_out_everyone` (with the count).
- Audit for the other changes: `access.login_mode`, `access.login_allow`, `access.login_disallow`.
- Keep a way to go back that does not need the admin panel (write it in the operator guide): `UPDATE access_settings SET login_mode = 'open', registration_mode = 'open';` on the server.

**Learner app**
- `LoginPage.tsx` and the Google callback/error pages: banners for `closed` and `limited` (with the extra line); for `closed`, disable the form and the Google button. Strings in the 4 locale files. Map the codes `login_closed` and `login_not_allowed` to translated messages (for the case where the banner was not shown or the state changed during the visit).

**Admin app**
- The `/access` page gets a Login section: the three-way control, the extra line, and the **allowed accounts**: a table (name, email, status) with a remove button for each row, an "add by email" box (bulk paste), and a warning when `limited` and the list is empty ("nobody can sign in").
- **Bulk selection in the users list** (`admin/src/features/users/pages/UsersPage.tsx`): a checkbox on each row and a "select all on this page" box (only with `access.manage`), and a bar "N selected: Allow to sign in / Remove from allowed". The list response gains `loginAllowed` (a boolean for each row) so the table can show it, and a filter "Login allowed". The user detail page shows the same fact with a button.
- The **panic button**: a clearly separate, red section at the bottom of `/access`, a dialog that asks for a reason and for the typed phrase `SIGN OUT EVERYONE`, and a result message ("N users were signed out").
- Tests: Vitest; Playwright `admin-12-login-gate.spec.ts` with a **real learner session**, in the style of `e2e/tests/admin-5-actions.spec.ts`: `closed` refuses the password login (403, code), `limited` allows only the listed account (the other gets `login_not_allowed` **only after a correct password**), the panic button makes an old token fail with 401 and a new login work for an allowed account, and `open` restores everything.

## Backend test checklist (both PRs)

Test every path with each state: `open`, `closed`, `limited` (listed and not listed). For registration: the form, Google sign-up, a case-different email (`A@x.com` against `a@x.com`), two parallel sign-ups with one invite (exactly one wins), a closed gate does not reveal which emails exist, a changed state takes effect on the next request, the invite is removed in the same transaction (roll back leaves it), bulk input with bad lines, and audit rows. For login: every path in the list above, the order (password first, then ban, then gate), staff are never blocked, a deleted account stays "Invalid credentials", the panic button (all learner tokens fail, staff tokens work, an allowed account can sign in again), and a user added to the list while the gate is `limited` can sign in at once. Mutation-check the key rule of each PR (break it on purpose, and watch the right test fail), as in slices 5 and 9.

## Files that change (summary)

- Backend: `backend/src/db/schema.ts` and migrations; `backend/lib/accessGate.ts` (new); `backend/lib/adminPermissions.ts`; `backend/controllers/userController.ts` and `oauthController.ts`; `backend/controllers/admin/accessController.ts` and `backend/routes/admin/accessRoutes.js` (new); a public route for `GET /api/access`; tests.
- Learner app: `frontend/src/features/access/` (new), `LoginPage.tsx`, `RegisterPage.tsx`, `features/auth/errors.ts`, the 4 `loginRegister.json` files, tests.
- Admin app: `admin/src/features/access/` (new), `UsersPage.tsx`, `UserDetailPage.tsx`, router, header, tests.
- e2e: two new specs, plus helpers in `e2e/fixtures/db.ts`.
- Docs: this plan's status notes, `.context/plans/admin-dashboard.md` (a pointer), the operator guide (`06-secrets-and-access.md` or `05-troubleshooting-playbook.md`: "How to open the gates again", "Emergency: sign everyone out"), and **`landing/privacy.html` only if** something new is stored about users (it is not: invites hold emails of people who are not users yet, so check the wording with the user).

## Risks and how the plan answers them

- **Locking everyone out.** Default `open`; the owner can always reopen from the admin panel (staff are never blocked); a documented SQL line as a last resort; a warning in the page when `limited` has an empty list; test on staging first.
- **Leaking which emails exist or are invited.** One message for every unlisted email; the gate check runs before the "email already in use" check for registration, and after the password check for login.
- **A race on an invite.** One transaction (delete the invite and insert the user).
- **The banner and the server disagreeing.** The server always enforces. The banner comes from the same row, and the learner app acts as `open` if the status call fails.
- **Free text in a banner.** Plain text only (rendered as text, never as markup), at most 300 characters, no links.
- **Existing sessions.** Not touched by the gates, by decision. Only the panic button ends them.

## Open details to confirm in the overview of each PR

Confirmed on 2026-10-01 for PR 1: leftover invites stay when registration is `open`; the invites list shows who added each email and when (joined with `staff_accounts` for the name); the owner has the ES, DE and EE banner drafts checked by a native speaker.

- PR 1: should an `open` registration with leftover invites keep them (recommended: yes, silently), and should the invites list show who added each email and when (recommended: yes)?
- PR 2: the exact wording of the typed phrase for the panic button (recommended `SIGN OUT EVERYONE`), and whether the users list should offer a "Login allowed" filter in the first version (recommended: yes, it is small).
- Both: the wording of the banners in Spanish, German and Estonian. Draft them, and ask the user to have them checked by someone who speaks the language (do not assume a translation is right).
