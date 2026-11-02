# Access gates: who can register and who can sign in

## Summary

The owner can open, close or limit two doors of Ladu: who can register, and who can sign in. The owner does this in the admin panel, with no deploy. A closed or limited door shows a banner to learners. A panic button signs every learner out at once. A visitor who meets a closed or limited door can ask for access, and the owner approves the request.

Live spec. It replaces a finished plan (archive record: `.context/archive/2026-10-access-gates.md`). Built and merged on 2026-10-01 in two PRs, #63 (`admin-registration-gate`) and #64 (`admin-login-gate`), plus #65 (`admin-login-gate-e2e-docs`). Default for both gates is `open`, so a deploy changes nothing until the owner flips a switch.

The request-access flow (section 6) is part of this feature. The captcha (`features/captcha.md`) protects the same public routes.

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

## 6. Request access

Built 2026-10-19 (four slices), merged in PR #95. It replaces a finished plan (archive record: `.context/archive/2026-10-access-requests.md`). A visitor who meets a `limited` or `closed` gate can ask for access. A request goes on its own list, and the owner approves it into the invite list or the allowed accounts. Gate spec: `e2e/tests/access-request-gate.spec.ts`. Migration `0033_access_requests.sql`.

| ID | Decision |
|---|---|
| R1 | A public page `/request`. A "Request access" button shows under the banner on `/register` and `/login` only when that gate is `limited` or `closed`. The button is outside the disabled `<fieldset>`, so it works when the gate is closed. |
| R2 | The checkbox "I have an account" sets the kind (`login` or `registration`). `/request?account=true` opens with the box ticked (the `/login` button). The visitor can change it. |
| R3 | The button is off until the email format is valid (and the captcha has a token, when it is on). |
| R4 | The captcha action is `access_request`. This route **refuses** when Cloudflare is down (503 `captcha_unavailable`), because it sends email (`features/captcha.md` C6). |
| R5 | One email to the team for each **new** request, to `ACCESS_REQUEST_EMAIL` (GitHub Environment secret, then `.env`). English only, with no link (the backend does not know the admin hostname). If the variable is empty, the request is saved, nothing is sent, and one warning is logged per start. |
| R6 | Approve and Remove buttons on each row of the request cards: registration requests in the Registration tab under the invite list, login requests in the Login tab under the allowed accounts. Each opens a confirm dialog with an optional reason. |
| R7 | The invite email is unchanged: the existing "send" button on the invite list stays the only way to send an invite. |
| R8 | A new "Send email" button on each allowed account tells the owner of the account that sign-in is open for them. It is sent in the account's `ui_language` (English when empty). |

- **Data:** `access_requests` (`id`, lowercase `email`, `kind` `registration|login` with a check, `created_at`), unique on `(email, kind)`. No staff column. `tests/db.js` truncates it.
- **Route** `POST /api/access/request` `{ email, hasAccount, captchaToken? }`, no login. Order: input check (400); captcha; read the gate for the kind (**409 `access_not_needed`** when it is `open`, which is public knowledge); then the **silent skips**; otherwise insert the row, write the audit row `access.request_create` (`staffId` null), commit, send the team email (a failed send is logged and does not change the answer).
- **Silent skips** answer the same `202 { received: true }`, so the route never says whether an email has an account or is on a list: registration kind and the email has an account or is already invited; login kind and no account, or a deleted or banned one, or already allowed; the request already exists; the pending list is full (cap 1,000 rows per kind, with a Sentry warning).
- **Admin API** (`access.manage`): `GET /api/admin/access` gains `requests: { registration, login }` and counts (a login row also has `account: { userId, name, status } | null`); `POST /api/admin/access/requests/:id/approve` (one transaction, row locked; registration adds the invite, 409 `has_account`; login adds the allowed account, 409 when none or deleted; works when the gate is `closed`, and takes effect when it becomes `limited`); `DELETE /api/admin/access/requests/:id` (remove without approving); `POST /api/admin/access/login-allowed/:userId/send` (404 when not on the list or deleted or banned). Audit: `access.request_create`, `access.request_approve`, `access.request_remove`, `access.login_allowed_send`.
- **Clean-up:** when someone registers (`registerUser`, `signupComplete`), the `registration` request for that email is deleted. When an account is allowed by any path (`allowLogin`), the `login` request goes too. A request never stays after access was given.
- **Learner app:** the page shows "Request received" in every silent-skip case (the server answers the same). If the gate for the chosen kind is `open`, it shows "Access is open for this" with a link to `/register` or `/login`. The error code `access_not_needed` is mapped in `features/auth/errors.ts`.
- **Admin app:** on a `closed` gate each card says "Approved emails take effect when the gate is limited." A login row with no account shows "No account found" and Approve is off.
- **Traps:** the gate spec changes global state, so it runs alone and chained. The spec keeps the captcha off; the widget on `/request` is covered by Jest, Vitest and one case in `captcha-gate.spec.ts`. Each Jest file uses `require('./request')`.

## 7. Open items

None. The four open items of the request-access flow were closed on 2026-11-02 (confirmed by the user): the `ACCESS_REQUEST_EMAIL` secret, the ES, DE and EE review of the request texts, the privacy wording for requests, and the staging try. Two review items were closed on 2026-11-02 (confirmed by the user): the privacy wording for invites (invites hold emails of people who are not users yet; the allowed list holds ids of existing users, which is nothing new), and the review of the ES, DE and EE banner and error texts.
