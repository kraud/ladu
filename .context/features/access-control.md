# Access gates: who can register and who can sign in

Live spec. It replaces a finished plan (archive record: `.context/archive/2026-10-access-gates.md`). Built and merged on 2026-10-01 in two PRs, #63 (`admin-registration-gate`) and #64 (`admin-login-gate`), plus #65 (`admin-login-gate-e2e-docs`). Default for both gates is `open`, so a deploy changes nothing until the owner flips a switch.

Follow-up in flight: `.context/plans/access-requests.md` ("Request access" for visitors who meet a limited or closed gate). When it is done, fold it into this file. The captcha plan (`plans/captcha.md`) protects the same public routes.

Code map: `backend/lib/accessGate.ts` (`getLoginBlock`, `enforceLoginGate`, invite handling), `backend/controllers/admin/accessController.ts`, `backend/lib/adminRequest.ts` (shared helpers), public `GET /api/access`; learner app `frontend/src/features/access/` (`useAccess`, `AccessBanner`), `features/auth/errors.ts`; admin app `admin/src/features/access/` (page `/access`, owner only); migrations `0016`, `0017`.

## 1. The two gates

Each gate has three states, set by the owner in the admin panel with no deploy.

| State | Registration | Login |
|---|---|---|
| `open` | Anybody can register. | Anybody can sign in. |
| `closed` | Nobody can register. A banner says so. | Nobody can sign in. A banner says so. For emergencies. |
| `limited` | Only emails on the invite list. The email leaves the list when that person registers. | Only accounts on the allowed list. |

Plus a **panic button** that signs every learner out.

## 2. Decisions

| ID | Decision |
|---|---|
| G-1 | Two PRs: registration first (it only stops new accounts and builds the parts that login reuses), then login. |
| G-2 | The login gate blocks **new** sign-ins only. Open sessions (a learner token lasts 30 days) keep working. Only the panic button ends them. |
| G-3 | The panic button is `UPDATE users SET token_version = token_version + 1` for all users, in one statement. `protect` already compares the token's `tv` on every request. It needs the phrase `SIGN OUT EVERYONE` and a reason. Staff tokens are separate. |
| G-4 | Banner text is fixed per state and translated (EN, ES, DE, EE). The owner can add an optional extra line (300 characters, plain text, not translated, never markup, no links). |
| G-5 | Only the owner manages it: permission `access.manage`. |
| G-6 | Staff are never blocked (separate `staff_accounts`), so the owner can always reopen a gate. |
| G-7 | The allowed list holds **user ids**, not emails, so it survives an email change. Adding by email looks the account up and refuses an unknown email. |
| G-8 | Leftover invites stay when registration is `open`. The invites list shows who added each email and when. |
| G-9 | The users list has a "Login allowed" filter (needs `access.manage`; 403 otherwise). |
| G-10 | The settings row is read on each request that needs it (one primary-key read). No cache, so a change acts at once. |

## 3. Data

- `access_settings`: one row (`id` fixed to 1, with a check). `registration_mode`, `registration_note`, `login_mode`, `login_note`, `updated_at`, `updated_by_staff_id`. A check allows only `open`, `closed`, `limited`. The migration seeds the row; `backend/tests/db.js` re-seeds it after each truncate. `updatedAt` and `updatedBy` are the last change to either gate.
- `registration_invites`: `id`, `email` (lowercase, unique), `created_at`, `created_by_staff_id`.
- `login_allowed_users`: `user_id` (primary key, `ON DELETE CASCADE`), `added_at`, `added_by_staff_id`.

## 4. Behaviour and contracts

- **Errors** use a machine code, HTTP 403: `registration_closed`, `registration_not_invited`, `login_closed`, `login_not_allowed`. One message for every unlisted email, so the list never leaks. The learner app reads `code` first and falls back to the message text. The Google callback redirects with `#error=<code>`.
- **Public status:** `GET /api/access` returns `{ registration: { mode, note }, login: { mode, note } }` and never a list. If the call fails, the learner app acts as `open` (the server enforces anyway).
- **Registration gate:** runs in `registerUser` and in `signupComplete` (the Google sign-up, with the email Google confirmed), **before** the "email in use" check. In `limited`, the user insert, token insert and invite delete (`DELETE ... WHERE email = lower($1) RETURNING`) run in one transaction, so two parallel sign-ups with one invite cannot both pass. No row deleted: roll back with `registration_not_invited`. In `open`, a matching invite is deleted as cleanup.
- **Login gate:** runs **after** the password check and the ban check, so a wrong password still answers "Invalid credentials" and an email never leaks. Places: `loginUser`, `link`, the Google callback for an already-linked identity, `signupComplete`, `verifyUser`. Two answers carry no token and no error: `verifyUser` answers 200 `{ message, verified: true, loginBlocked }` (the email is verified, the link is used up), and `signupComplete` answers 201 `{ loginBlocked, message }` (the account exists). The learner app handles `loginBlocked`.
- **Interaction:** registration `open` with login `limited` creates accounts that cannot sign in. The admin page says this.
- **Admin API** (`access.manage`): `GET /api/admin/access` (settings, invites, `loginAllowed` with name, email, status, who added it, counts); `PUT .../registration` and `PUT .../login` (`{ mode, note, reason? }`; both share `setGate`); `POST .../invites` (`{ emails }`, bulk up to 500, trims, lowercases, skips and explains invalid, repeated, already listed and already registered); `DELETE .../invites/:id`; `POST .../invites/:id/send` (emails the address that it can register; 404 unknown invite, 409 the address has an account now; the invite stays); `POST .../login-allowed` (`{ userIds?, emails? }`, bulk up to 500, skips and explains invalid, repeated, unknown, deleted, already allowed); `POST .../login-allowed/remove` (bulk); `DELETE .../login-allowed/:userId`; `POST .../sign-out-everyone`.
- **Users API:** the list and detail have `loginAllowed` (null for a role without `access.manage`) and the filter `loginAllowed=true|false`.
- **Audit:** `access.registration_mode`, `access.login_mode` (metadata: old and new mode, note changed), `access.invite_add`, `access.invite_remove`, `access.invite_send` (handed to the mail provider, not "arrived"), `access.invite_used` (`staffId` null, email in metadata), `access.login_allow`, `access.login_disallow` (one row per account, about the user), `access.sign_out_everyone` (with the count). A change that changes nothing writes no row.
- **Learner app:** a closed gate disables the form and the Google button through a disabled `<fieldset>`; a limited gate adds a note. A refused sign-in reads the gate state again. `VerifyEmailPage` has a `blocked` state (email verified, no session, a way back to sign-in). A refused Google sign-up shows an info toast and goes to `/login`.
- **Admin app:** `/access` has two tabs driven by the URL (`?tab=login`): Registration (gate and invite list) and Login (gate, allowed accounts, red "Sign everyone out" section). Warnings: `limited` with an empty list; registration `open` while login is `limited`. The users list has, for the owner only, row checkboxes, a select-all for the page, a bar "N selected: Allow to sign in / Remove from allowed", a Login allowed column and filter. The user page has a Sign-in access section.
- **Way back without the panel:** `UPDATE access_settings SET login_mode = 'open', registration_mode = 'open';` (operator guide, "Nobody can register or sign in").

## 5. Traps

- A bug here can lock everyone out. Try each change on staging before production.
- The two gate cards share labels, so tests scope each query to a card.
- The users filter reads a typed `?loginAllowed=true` (the router makes it a boolean) as text.
- Playwright gate specs (`*-gate.spec.ts`) change global state: each is its own project, chained after every other spec. A failure earlier skips them. Run one by hand with `npx playwright test --no-deps --project=<name>`. `admin-12` expects the login allowed list to be empty.
- Key rules were mutation-checked (break the rule on purpose, watch the right test fail).

## 6. Open items

None. Two review items were closed on 2026-11-02 (confirmed by the user): the privacy wording for invites (invites hold emails of people who are not users yet; the allowed list holds ids of existing users, which is nothing new), and the review of the ES, DE and EE banner and error texts.
