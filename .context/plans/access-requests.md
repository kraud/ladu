# Plan: Access requests ("Request access" on the login and register pages)

Status: **planned on 2026-10-19. Slice 1 (backend) and Slice 2 (learner app) built on 2026-10-19** (see "what was built"). Slices 3 and 4 not built. D1, D2 and D3 confirmed with the user on 2026-10-19 (the recommended option for each). D4, D5 and D6 follow the request or are still open: see "Decisions to confirm".

## Context

The access gates (`.context/plans/access-gates.md`) let the owner set registration and login to `open`, `closed` or `limited`. A visitor who meets a limited or closed gate has no way to ask for access. Today the owner must hear about that person by some other route.

This plan adds a **request-access** flow:

1. The visitor opens `/request`, types an email, and says if they already have an account.
2. The server saves the request on a **request list** and sends an email to the Ladu team.
3. The owner approves the request in the admin panel. The email moves to the real list (invite list or allowed accounts).

## What this is (plain-language overview)

Two lists already exist:

- The **invite list** (`registration_invites`): emails that may register while registration is `limited`.
- The **allowed accounts** (`login_allowed_users`): accounts that may sign in while login is `limited`. It holds user ids, not emails.

A **request** is a new, separate thing: a person asked, and nobody has said yes. We add one table for it, `access_requests`. Each row has a **kind**: `registration` or `login`. The checkbox "I have an account" sets the kind. No checkbox = `registration`. Checkbox = `login`.

Approval is a separate step from the emails that already exist:

- Registration: approving adds the email to the invite list. The invite email is still sent by the existing button on the invite list. This plan does not change it.
- Login: approving adds the account to the allowed accounts. A **new** button on that list sends an email that says "you can sign in now". It works like the invite-email button.

## Decisions (from the request of 2026-10-19)

| # | Decision |
|---|---|
| R1. Where | New public page `/request`. A "Request access" button shows under the banner on `/register` and `/login`, only when that gate is `limited` or `closed`. |
| R2. Kind | The checkbox "I have an account" sets the kind (`login` or `registration`). The button on `/login` opens `/request?account=true` (box ticked). The button on `/register` opens `/request` (box not ticked). The visitor can change it. |
| R3. Form | Title and short explanation, the checkbox, an email field, the "Request access" button. The button is off until the email has a valid format. The captcha widget shows when the captcha switch is on. |
| R4. Captcha | Same check as registration: `assertCaptcha` with a new action `access_request`. It follows the admin switch (`captcha.md` C2). |
| R5. Admin email | One email to the Ladu team for each **new** request. The address comes from the env variable `ACCESS_REQUEST_EMAIL` (`contact@ladu.com.ar` in staging and production). |
| R6. Approve | A button on each row of the request tables, with a confirm dialog. Registration requests: in the Registration tab, under the invite list. Login requests: in the Login tab, under the allowed accounts. |
| R7. Invite email | Unchanged. The existing "send" button on the invite list stays the only way to send an invite. |
| R8. Login-allowed email | A new "send email" button on each row of the allowed accounts. It tells the account owner that sign-in is open for them. It is sent in the account's saved language (`users.ui_language`, English when empty). |

## Design

### Data (migration `0033_access_requests.sql`)

- Table `access_requests`: `id` (uuid), `email` (lowercase), `kind` (`registration` | `login`, check constraint), `created_at`.
- Unique on (`email`, `kind`): a repeat request does not add a row.
- No staff column. The request comes from a visitor, not from staff.
- `backend/src/db/schema.ts` gets the table. `tests/db.js` must truncate it.

### Public route: `POST /api/access/request`

Body: `{ email, hasAccount, captchaToken? }`. No login. Put it in `backend/routes/accessRoutes.js` and `backend/controllers/accessController.ts`.

Order of checks (like `captcha.md` C9):

1. Input: `email` is text and has a valid format (same pattern as the invite code, at most 255 characters); `hasAccount` is a boolean. Else 400.
2. `assertCaptcha(req, 'access_request', { onUnreachable: 'refuse' })`. Refuse when Cloudflare is down: this route sends email, so a bot must not pass.
3. Read the gate for the kind. If it is `open`: 409 `access_not_needed`. This is public knowledge (the banner shows the state), so it leaks nothing.
4. **Silent skips.** The answer is the same 202 `{ received: true }` in every case below, so the route never tells whether an email has an account or is on a list:
   - `registration` kind and the email has an account;
   - `registration` kind and the email is already on the invite list;
   - `login` kind and the email has no account, or the account is deleted or banned;
   - `login` kind and the account is already on the allowed list;
   - the request already exists;
   - the pending list is full (cap 1000 rows for each kind; a Sentry warning, no row).
5. Otherwise: insert the row, write one audit row `access.request_create` (`staffId` null, email and kind in metadata, like `access.invite_used`), commit, then send the admin email. A failed send is logged and does not change the answer (same pattern as `sendInvite`).

Why silent: the three existing gates already take care to never confirm that an email exists. This route keeps the rule.

### Admin email (to the Ladu team)

- New template `backend/utils/resources/accessRequest.js`, type `accessRequest` in `sendEmail.js`. English only (staff mail). It says: the email, the kind ("wants to register" / "wants to sign in"), and which admin tab to open (Access, then Registration or Login). It has **no link**: the admin panel is on its own hostname, and the backend does not know it. The email text goes through `escapeHtml`.
- If `ACCESS_REQUEST_EMAIL` is empty: the request is still saved and a warning is logged once per start. Nothing fails.
- Add the variable to `deploy/env/app.env.example` and to the staging and production `.env` blocks in `.github/workflows/deploy.yml`.

### Admin API (all need `access.manage`)

- `GET /api/admin/access` gains `requests: { registration: [...], login: [...] }` and `counts.requestsRegistration`, `counts.requestsLogin`. Each row: `id`, `email`, `createdAt`. A `login` row also has `account: { userId, name, status } | null` (joined by lowercase email), so the page can tell "no account found".
- `POST /api/admin/access/requests/:id/approve` (`{ reason? }`), one transaction, row locked:
  - `registration`: insert the email in `registration_invites` (`ON CONFLICT DO NOTHING`), delete the request. 409 `has_account` when the email now has an account.
  - `login`: find the account by lowercase email. 409 when there is none, or it is deleted. Insert in `login_allowed_users` (`ON CONFLICT DO NOTHING`), delete the request.
  - 404 for an unknown id. Audit: `access.request_approve` (metadata: email and kind). For `login`, also the same per-user row that `access.login_allow` writes, so it shows in the user's history.
  - Approving works when the gate is `closed` too. The email goes on the list, and takes effect when the owner sets the gate to `limited`. The admin page says so.
- `DELETE /api/admin/access/requests/:id` (remove without approving). Audit `access.request_remove`. This is not in the original request. Without it, a refused request stays forever (see D3).
- `POST /api/admin/access/login-allowed/:userId/send` (`{ reason? }`): 404 for an account that is not on the allowed list or is deleted or banned; else send the email `loginAllowed` and write `access.login_allowed_send` (about the user; metadata: email). Same shape as `sendInvite`. The row stays on the list and can be sent again.
- Clean-up: when someone registers, the existing invite clean-up (`registerUser`, `signupComplete`) also deletes the `registration` request for that email. When the account is added to the allowed list by any other path (`allowLogin`), the `login` request for that email goes too. So a request never stays after access was given.

### Learner app (`frontend/`)

- New route `/request` in `_public` (`frontend/src/app/router.tsx`). Search param `account` (boolean) pre-ticks the box.
- New page `frontend/src/features/auth/pages/RequestAccessPage.tsx` and form `components/RequestAccessForm.tsx` (React Hook Form + zod, like the other auth forms). A schema `requestAccessSchema` in `schemas.ts`: email format. The button is `disabled` until the email is valid (and the captcha has a token, when it is on).
- Use `useCaptcha('access_request')` like `RegisterForm`. Add the action to the captcha types. On any error: `captcha.reset`.
- After a success the page shows a short "Request received" message instead of the form. The same message shows in every silent-skip case (the server answers the same).
- If the gate for the chosen kind is `open` (the visitor changed the box, or the owner opened the gate): show "Access is open for this" with a link to `/register` or `/login`. The page reads the state with `useAccess`. The server answer `access_not_needed` shows the same message.
- Buttons: `RegisterPage.tsx` and `LoginPage.tsx` show "Request access" under `AccessBanner`, when `mode !== 'open'`. The button is **outside** the disabled `<fieldset>`, so it still works when the gate is `closed`.
- Error mapping: `access_not_needed` in `features/auth/errors.ts`.
- Strings: a `request` block in `frontend/public/locales/{en,es,de,ee}/loginRegister.json` (title, explanation, the checkbox, email label, button, success, open-already, error). The ES, DE and EE texts are drafts for a native speaker. Texts follow the rule: short, plain, no promise of a reply time.
- Tests (Vitest): the button shows only for `limited` and `closed`; the pre-tick; the button is off for a bad email; the request sends `hasAccount` and the token; the success state; `access_not_needed`.

### Admin app (`admin/`)

- `admin/src/features/access/`: types for the `requests` fields; hooks `useApproveRequest`, `useRemoveRequest`, `useSendLoginAllowed`.
- Registration tab: a "Requests" card **under** the invite list. Columns: email, requested (date), and two buttons: **Approve** and **Remove**. Both open a confirm dialog (`FormDialog`, with the optional reason). The dialog for Approve says what will happen ("Add x to the invite list. This does not send an email."). A count in the card title. An empty state.
- Login tab: the same card **under** the allowed accounts. A row shows the account name and status, or "No account found" (Approve is off, with a hint). The dialog for Approve says "Allow x to sign in. This does not send an email."
- Login tab, allowed accounts table: a new **Send email** button on each row (the invite list has one for registration; use the same style). A confirm dialog shows the address.
- When the gate is `closed`, a short note on each card: "Approved emails take effect when the gate is limited."
- Tests (Vitest): the two cards, approve and remove with the dialog, the "no account" row, the send button. Update `admin/src/test/msw/handlers.ts`.

### e2e

- New spec `e2e/tests/access-request-gate.spec.ts` (a `-gate` spec: it changes global state, so it runs alone and chained, see `playwright.config.ts`). Steps:
  1. Registration `limited`: `/register` shows the button; `/request` with a valid email; the row shows in the admin Registration tab; approve with the dialog; the email is on the invite list (and the request is gone); a real sign-up with that email works.
  2. Login `limited`: a real account; `/login` shows the button (pre-ticked box); request; approve; the account signs in; the "Send email" button answers success.
  3. Direct API calls: bad email 400; gate `open` 409 `access_not_needed`; same answer for a repeat request.
  4. Both gates back to `open` at the end.
- Helpers in `e2e/fixtures/db.ts` (read and clear `access_requests`). `global-setup.ts` clears the table.
- The spec keeps the captcha off. Captcha on `/request` is covered by Jest and Vitest, and one case in `captcha-gate.spec.ts` (the form shows the widget).

### Backend tests (Jest, one file for each, each uses `require('./request')`)

- `accessRequest.test.js`: valid request (row, audit row, admin email sent once); repeat request (no second email); each silent skip gives the same 202 and no row; `open` gate 409; bad input 400; captcha on (`failed` 400, `unreachable` 503, ok); the pending cap; no `ACCESS_REQUEST_EMAIL` = row saved, no mail, no error; the email text escapes HTML.
- `adminAccessRequests.test.js`: permission (`access.manage` only); list with `account`; approve for each kind (list row, request deleted, audit rows); approve 409 and 404; approve is atomic; remove; login-allowed send (404 and 200, audit, mail in the user's language); the clean-up in `registerUser` and `allowLogin`.
- Mutation-check the key rules (the silent skips, the transaction in approve), like the earlier gate PRs.

## Slices

Each slice ends with something runnable, and starts with a plain-language overview before files change.

1. **Backend**: migration, schema, public route, admin email template and env variable, admin API (approve, remove, send), clean-up hooks, Jest.
2. **Learner app**: `/request` page, buttons on `/login` and `/register`, strings in 4 languages, Vitest.
3. **Admin app**: the two request cards, the send button, Vitest.
4. **e2e and docs**: the Playwright spec, the operator guide (`ACCESS_REQUEST_EMAIL` and where the requests show), this plan's notes, a pointer in `access-gates.md`.

### Slice 1 — what was built

- Migration `0033_access_requests.sql` and the table `access_requests` in `schema.ts` (unique on email + kind; check on kind). `tests/db.js` truncates it.
- `backend/lib/accessRequests.ts`: `MAX_PENDING_REQUESTS` (1000), `AccessRequestError` (an `HttpError` with `apiCode`), and `clearAccessRequests`. `consumeInvite` (`lib/accessGate.ts`) calls it, so a sign-up by form or by Google removes the `registration` request. `allowLogin` removes the `login` request.
- Public route `POST /api/access/request` (`controllers/accessController.ts`, `routes/accessRoutes.js`): the order in "Public route" above. New captcha action `access_request` in `lib/captcha.ts`. The admin email is sent after the commit; no `ACCESS_REQUEST_EMAIL` = row saved, one log warning per start.
- Admin API (`controllers/admin/accessController.ts`, `routes/admin/accessRoutes.js`): `requests` and the two new counts in `GET /api/admin/access`; `POST /requests/:id/approve`; `DELETE /requests/:id`; `POST /login-allowed/:userId/send`. Audit rows: `access.request_create`, `access.request_approve` (plus `access.login_allow` for a login request), `access.request_remove`, `access.login_allowed_send`.
- Email: `utils/resources/accessRequest.js` (team, English), `utils/resources/loginAllowed.js` (account, 4 languages; the strings are in `emailStrings.js`, **ES/DE/EE are drafts for a native speaker**), both wired in `utils/sendEmail.js`.
- Deploy: `ACCESS_REQUEST_EMAIL` in `deploy/env/app.env.example` and in both `.env` blocks of `.github/workflows/deploy.yml`. **The GitHub Environment secret `ACCESS_REQUEST_EMAIL` must be created for staging and production** (value: the team address). A missing secret gives an empty value = no team email.
- Tests: `accessRequest.test.js` (29) and `adminAccessRequests.test.js` (20). Mutation-checked: without the "useless request" check the 5 silent-skip tests fail; without the request delete in approve, 3 tests fail.

### Slice 2 — what was built

- Route `/request` (`app/router.tsx`, public layout). Search `?account=true` ticks the box; the search type is `{ account?: boolean }`.
- `features/auth/pages/RequestAccessPage.tsx` and `components/RequestAccessForm.tsx` (React Hook Form + yup, `buildRequestAccessSchema` in `schemas.ts`). The button is off until the email is valid, and until the captcha has a token. After a send, the page shows one "Request received" message.
- The form reads both gates. When the gate of the ticked kind is open, it shows "This is open now" with a link (sign in or create an account) and keeps the button off. The server's 409 `access_not_needed` shows the same text as a toast, and makes the app read the gate state again.
- `features/access/components/RequestAccessLink.tsx`: the button under the banner on `LoginPage` and `RegisterPage`, outside the disabled fieldset, nothing when the gate is open. On `/login` it links to `/request?account=true`.
- `features/access/`: `requestAccess` (api), `useRequestAccess` (hook), `RequestAccessBody` (type); `access_not_needed` is in `GATE_CODES` and in `features/auth/errors.ts`. New captcha action `access_request` in `features/captcha/turnstile.ts`.
- Strings: a `request` block in the four `loginRegister.json` files (**ES, DE and EE are drafts for a native speaker**).
- Tests: `features/access/access-request.test.tsx` (14). Full frontend suite green (139 files, 1898 tests); eslint clean.
- Not done here: the page has no own e2e yet (Slice 4).

## Decisions to confirm

| # | Question | Recommendation |
|---|---|---|
| D1 | Should the request route need the captcha even when the admin captcha switch is off? | No: keep the switch as the one control (R4). The silent skips, the cap and "one email for each new request" limit the damage. |
| D2 | A `login` request for an email with no account: save it or skip it silently? | Skip silently. The owner cannot grant it (the allowed list needs an account), and a saved row would make admins check the same dead request. |
| D3 | Add a "Remove" button (refuse a request) next to "Approve"? | Yes (small, and the list needs a way to shrink). |
| D4 | Where does the address `contact@ladu.com.ar` live? | In `ACCESS_REQUEST_EMAIL` (GitHub Environment secret, then `.env`), not in the code: the repository is public. |
| D5 | Should a `closed` gate also accept requests? | Yes (as asked). The approved email waits on the list until the gate is `limited`. |
| D6 | Privacy page: requests hold emails of people who are not users yet. | Check `landing/privacy.html` wording with the user (like the invite list). Rows are deleted at approval, at removal and at registration. |

## Risks and how the plan answers them

- **Email flood to the team.** One email for each new (email, kind) pair only; the cap of 1000 pending rows; the captcha when the switch is on. A per-IP limit is out of scope (the app has none today, see `captcha.md` "Out of scope").
- **Leaking which emails exist or are listed.** The silent skips. One answer for every case, except the open-gate 409 (public information).
- **Approving the wrong account.** The `login` row shows the matching account name and status; the dialog repeats the email.
- **A closed gate and approval.** The page says that approved emails take effect when the gate is `limited`.
- **HTML in the email field.** The server validates the format, the template escapes the text, the admin page shows it as text.

## Out of scope

- A reply email to the requester when the owner refuses.
- A bulk approve.
- A per-IP rate limit on `POST /api/access/request`.

## Review log

| # | Severity | Finding | Resolution |
|---|---|---|---|
