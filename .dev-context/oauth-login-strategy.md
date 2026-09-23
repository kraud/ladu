# OAuth Login Strategy — Ladu v2

> Status: **In progress.** Phase 0 done 2026-09-23 — stub harness green,
> Google Cloud OAuth client registered. Microsoft was dropped the same day:
> Azure sign-in returned `AADSTS16000` on every account tried, so it never
> got past registration (see Decisions).
> Goal: add "Sign in with Google" as an extra way in, alongside the existing
> email+password flow — without disturbing it and without abandoning the
> hand-rolled JWT design.
> Cost: **€0/mo.** Google is free to register and use at this scope; nothing
> here touches the deployment plan's ≤ €7/mo budget.

---

## Open questions — resolved

The brief asked these to be resolved with the user, not guessed. Answers and
the reasoning behind them, so the "why" survives alongside the "what":

- **Account linking.** If an OAuth sign-in's email matches an existing
  password account, Ladu **requires the password once to link** — it never
  auto-links and never dead-ends the user. Reaffirmed 2026-09-23 after
  Microsoft was dropped (see below): Google's ID token does carry a reliable
  `email_verified` claim, which would make auto-link on Google alone a
  defensible option, but password-confirmed linking doesn't depend on
  trusting a third party's verification claim indefinitely, was already the
  design, and costs the user one extra step exactly once. Blocking outright
  would be a dead end with no way forward.
- **Multiple sign-in methods per account.** Yes, from day one. Modelled as a
  separate `oauth_identities` table (one row per linked provider) rather than
  columns on `users`, specifically so the linking answer above is
  implementable and so a user can hold both password and Google sign-in
  simultaneously. A one-method-per-account column design would need a painful
  migration the moment a second method was wanted, which is immediately —
  Phase 5 below ships account-page linking in the same effort budget. The
  table's `provider` column stays generic rather than Google-specific —
  negligible cost today, and it's what would let a future provider be added
  later without another migration, should one ever be wanted.
- **Token-verification library.** **`jose`** for Google's ID tokens. One
  small, modern JWKS + JWT verification library, closest to this repo's
  existing hand-rolled `jsonwebtoken` style, and it is the only new runtime
  dependency this plan adds. Rejected: `google-auth-library` + `jwks-rsa`/
  `jsonwebtoken` (two dependencies, two verification idioms for what is
  structurally the same job `jose` does alone). `jose` was originally picked
  partly because it covered Microsoft's tokens with the same idiom too —
  that reason dropped away with Microsoft (see [Rejected options](#rejected-options))
  but the choice still stands on its own for Google.

---

## 1. Decisions

| Topic | Decision |
|---|---|
| Providers | **Google** only. Microsoft was planned too but dropped — see Rejected options. |
| Apple | Rejected — requires a paid ($99/yr) Apple Developer Program membership, which the user has ruled out. |
| Flow | OAuth 2.0 / OIDC **authorization code + PKCE**, verified server-side. No Passport.js, no server-side sessions — stays consistent with the existing hand-rolled JWT design. |
| Redirect shape | **Backend-handled redirect**: browser → `/api/auth/:provider/start` → provider → `/api/auth/:provider/callback` → backend mints the app JWT → redirects to the frontend. The client secret never reaches the browser. Routes stay parameterized by `:provider` even with just Google today, matching the identities table's generic `provider` column — so adding another provider later needs no route redesign. |
| Account linking | OAuth email matches an existing password account → **require the password once** to link. Never auto-link, never dead-end (see "Open questions" above). |
| Multiple methods | **Yes, from day one** — a separate `oauth_identities` table, one row per `(user, provider)`. |
| Token verification | **`jose`** for Google's ID tokens — one dependency, closest to the current minimal-dependency style. |
| Username on OAuth signup | Google doesn't supply one. Asked on the signup-completion screen, **prefilled from the email's local part and editable** — `users.username` is `NOT NULL UNIQUE` and the app treats it as a real, user-chosen handle elsewhere (Account page, `@username` display). |
| Email confirmation | **Skipped** for OAuth signups — Google already verifies the address, so new OAuth accounts are created with `verified: true` immediately. Language selection (≥ 2 supported languages) is **not** skipped; it still runs as its own signup step. |
| Connected methods UI | Not a separate settings screen. A read-only "Sign-in methods" row sits under the email row in the Account profile view; connect/disconnect controls appear only in the profile's existing edit mode. |
| Token transport to the browser | URL **fragment** (`/auth/callback#token=…`), not a query string — fragments never reach the server's access logs or `Referer` headers. |
| State/PKCE storage | A short-lived, purpose-typed JWT (`typ: 'oauth_state'`) in an `HttpOnly; Secure; SameSite=Lax` cookie, keeping the whole design stateless (no server-side session store). |

### Rejected options

| Option | Reason |
|---|---|
| Apple ("Sign in with Apple") | Requires the $99/yr Apple Developer Program. Ruled out by the user. |
| Microsoft ("Sign in with Microsoft") | Azure sign-in returned `AADSTS16000` on every account tried (multiple personal outlook.com accounts, incognito windows, fully cleared sessions) — an unresolved Azure-side issue, not a plan defect. Dropped 2026-09-23 rather than sink more time into a second free provider. |
| Passport.js | Session-oriented by default; the app has no session store today and this plan doesn't want to introduce one just to gain a strategy-plugin system this plan doesn't need. |
| NextAuth.js / Auth.js | Built around Next.js's server conventions; this is a plain Express + Vite/React stack. Wrong shape for the framework. |
| Auth0 / Clerk / a hosted identity provider | Usage-priced beyond free tiers and an external dependency for something the app can do itself in ~5 days; breaks both the €0 cost target and the point of building it by hand. |
| `google-auth-library` + `jwks-rsa`/`jsonwebtoken` | Two dependencies, two different verification idioms, for what is the same job `jose` does alone (verify a JWT against a JWKS). |
| Frontend holds provider client IDs (`VITE_GOOGLE_CLIENT_ID`, etc.) | `frontend/Dockerfile` bakes one image that serves both staging and production (no build-time API URL, per its own header comment). A build-time client ID would force separate images per environment, breaking that design. The backend-redirect flow sidesteps this entirely — the frontend needs no client ID at all. |
| Auto-link accounts on email match | Reaffirmed 2026-09-23 even with Microsoft gone: password-confirmed linking doesn't depend on trusting a third party's verification claim indefinitely. Originally driven by Microsoft's missing `email_verified` claim specifically. See "Open questions" above. |
| One sign-in method per account (columns on `users`) | Works until a second method is wanted, which is immediately (Phase 5 ships linking). A dedicated identities table costs little now and avoids a later data migration. |

---

## 2. Architecture

### Flow

```
Browser                    Backend                      Google
   │                          │                                │
   │  GET /api/auth/:p/start  │                                │
   ├─────────────────────────▶│  generate PKCE verifier+chall, │
   │                          │  nonce, state JWT (10 min)      │
   │                          │  → set __Host-ladu_oauth cookie │
   │  302 → provider consent  │                                │
   │◀─────────────────────────┤  302 to provider /authorize    │
   │                          │                                │
   ├───────────────────────────────────────────────────────────▶│
   │                    user authenticates + consents           │
   │◀───────────────────────────────────────────────────────────┤
   │  302 → /api/auth/:p/callback?code=…&state=…                 │
   ├─────────────────────────▶│                                │
   │                          │  verify state cookie matches    │
   │                          │  exchange code → tokens (fetch) │
   │                          │  verify ID token (jose + JWKS)  │
   │                          │                                │
   │                          │  ── one of three outcomes ──    │
   │                          │  (a) sub already linked → login │
   │                          │  (b) email is new       → signup ticket │
   │                          │  (c) email exists, pw account → link ticket │
   │  302 → /auth/callback#…  │                                │
   │◀─────────────────────────┤                                │
```

(a) redirects straight to `/auth/callback#token=<jwt>` — the same shape
`useLogin` already produces. (b) and (c) redirect to
`/auth/callback#ticket=<jwt>&mode=signup|link` instead; the frontend then
runs the signup-completion screen (Phase 3) or the link-confirmation screen
(Phase 4). A ticket is a short-lived (10 min), purpose-typed JWT — never a
session token, and never accepted where one is expected.

### Endpoints (new file: `backend/controllers/oauthController.ts`)

| Endpoint | Purpose |
|---|---|
| `GET /api/auth/providers` | Returns which providers are configured (`{ google: true }`), driven by which env vars are set. The frontend uses this to decide which buttons to render — it never holds a client ID itself. |
| `GET /api/auth/:provider/start` | Builds the PKCE challenge + nonce + state JWT, sets the state cookie, 302s to the provider's `/authorize`. |
| `GET /api/auth/:provider/callback` | Validates state, exchanges the code, verifies the ID token, resolves outcome (a)/(b)/(c) above, 302s to the frontend with a fragment. |
| `POST /api/auth/signup/complete` | Body `{ ticket, username, languages, uiLanguage }`. Validates the ticket, runs `normalizeLanguageSelection` (reused from `userController.ts`), creates the user with `verified: true` and no password, returns `serializeLoginUser`. |
| `POST /api/auth/link` | Body `{ ticket, password }`. Validates the ticket, `bcrypt.compare`s against the existing account's password hash, inserts the `oauth_identities` row, returns `serializeLoginUser`. Wrong password does not consume the ticket. |
| `POST /api/auth/:provider/link` (protected) | Same `start` flow, but for an already-logged-in user linking a second provider from the Account page — the state JWT carries the acting `userId` instead of expecting a fresh signup. |
| `DELETE /api/auth/identities/:id` (protected) | Unlinks an identity. Refuses (400) if it's the user's only sign-in method (no password and no other identity left). |
| `GET /api/auth/identities` (protected) | Lists the caller's linked providers, for the Account page's "Sign-in methods" row. |

Mounted at `/api/auth`, new route file `backend/routes/oauthRoutes.js`, added
to `app.js` alongside the existing `app.use('/api/users', ...)`.

### State, not sessions

The state JWT (`typ: 'oauth_state'`, 10-minute expiry) carries the PKCE code
verifier, nonce, provider, and the post-login redirect target. It lives in an
`__Host-ladu_oauth` cookie (`HttpOnly; Secure; SameSite=Lax; Path=/`); only
its `jti` is sent to the provider as the OAuth `state` parameter. This keeps
the verifier and nonce off the wire entirely and binds the callback to the
browser that started it, with no server-side session store — written with
Express's built-in `res.cookie`/`req.headers.cookie` parsing, so no
`cookie-parser` dependency is needed for a single cookie.

**Rule, stated explicitly because it's easy to get wrong under this design:**
state JWTs, signup tickets, and link tickets each carry their own `typ`
claim and are validated against it. None of them is ever accepted where the
30-day session JWT (`generateToken`) is expected, and vice versa.

### Provider quirks (real correctness traps, not stylistic notes)

- **Google**: the ID token includes `email_verified`. Require it `=== true`
  before treating the email as authoritative for linking.

### Env vars

| Var | Purpose |
|---|---|
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth app credentials. |
| `OAUTH_REDIRECT_BASE` | Base URL for building callback URIs; defaults to `BASE_URL` if unset. |

New backend env vars touch the same four places every existing one does:
local root `.env`, `deploy/env/app.env.example`, the GitHub `staging`/
`production` Environment secrets, and both `ci.yml` and `deploy.yml`'s `env:`
blocks.

---

## 3. Schema

New migration `0004` (generated with `npm run db:generate`, applied with
`npm run db:migrate`):

```sql
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;

CREATE TABLE "oauth_identities" (
    "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id"           uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "provider"          varchar(32) NOT NULL,   -- 'google' (kept generic; extensible later)
    "provider_user_id"  varchar(255) NOT NULL,  -- the ID token's `sub`
    "email_at_link"     varchar(255) NOT NULL,  -- audit trail; never used for lookup
    "created_at"        timestamp DEFAULT now() NOT NULL,
    "updated_at"        timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "oauth_identities_provider_sub_unique" UNIQUE ("provider", "provider_user_id")
);
CREATE INDEX "oauth_identities_user_id_idx" ON "oauth_identities" ("user_id");
```

Matching `pgTable('oauth_identities', ...)` in `backend/src/db/schema.ts`,
plus an `oauthIdentities` relation added to `usersRelations`. **Identity
lookup is always by `(provider, provider_user_id)`, never by email** — a
provider's email can change; its `sub` cannot.

Do not forget: `backend/tests/db.js`'s `clearDB()` has a hardcoded TRUNCATE
table list — `oauth_identities` must be added there, exactly as
`password_reset_tokens` was when migration `0003` introduced it, or rows
leak between Jest test files.

---

## 4. Phases

Total effort: about 4.5 days. Each phase ships as its own vertical slice with
a Playwright e2e spec as its gate, per `CLAUDE.md`'s working rules — no
one-shotting the whole feature.

### Phase 0 — Provider registration + local OIDC stub harness (½ day + provider review wait)

- Register a Google Cloud OAuth 2.0 client, with redirect URIs for
  `localhost:5001`, staging, and production. An Azure App registration for
  Microsoft was attempted too, but every account tried (multiple personal
  outlook.com accounts, incognito windows, fully cleared sessions) hit
  `AADSTS16000` at sign-in — an unresolved Azure-side issue. Dropped
  2026-09-23; Microsoft is out of this plan (see Decisions).
- Env wiring: `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, in local `.env` and
  `deploy/env/app.env.example`.
- **The piece that makes every later phase testable without a live Google
  account**: a tiny stub OIDC issuer at `e2e/fixtures/oidc-stub/`
  — a Node HTTP server exposing `/.well-known/openid-configuration`,
  `/authorize` (auto-approves, no real consent screen), `/token`, and
  `/jwks`, signing ID tokens with a locally generated RSA key via `jose`.
  Wired in as a third `webServer` entry in `e2e/playwright.config.ts`. The
  backend accepts an `OAUTH_ISSUER_<PROVIDER>` override **only when
  `NODE_ENV !== 'production'`**, pointing discovery at the stub instead of
  the real provider.
- This is a deliberate decision, not a shortcut: there is no honest way to
  drive a real third-party consent screen from CI, and a stub that
  implements the actual OIDC discovery/token/JWKS contract exercises the
  real client code path (discovery, JWKS caching, code exchange, ID-token
  verification) rather than mocking it away.
- **e2e** (`oauth-0-harness.spec.ts`): the stub's discovery document and
  JWKS endpoint are reachable, and the backend starts successfully with
  `OAUTH_ISSUER_GOOGLE` pointed at it.
- **Gate:** stub issuer up, backend boots against it, no real Google account
  required to run the suite. **✅ done 2026-09-23** — 5/5 new tests green,
  full `test:e2e` suite (17/17) unaffected; Google Cloud OAuth client
  registered with all three redirect URIs.

### Phase 1 — Schema and password-less login guard (½ day)

- Ships migration `0004`, the `oauth_identities` table in `schema.ts`, and
  the TRUNCATE-list addition in `tests/db.js`.
- Guards `loginUser` (`userController.ts:252-280`): today
  `bcrypt.compare(password || '', user.password)` would throw or misbehave
  against a `null` hash once `password` is nullable. Add an explicit check —
  a password-less account attempting password login gets a fixed message
  ("Sign in with Google"), mapped through `features/auth/errors.ts`'s
  existing message-to-i18n-key table.
- This confirms the account exists to an unauthenticated caller, which the
  app already does today in `registerUser` ("Email already in use") and
  `requestPasswordReset` (silently succeeds either way — actually doesn't
  leak, worth double-checking parity here). The UX win of telling a
  password-less user which button to click instead is worth that.
- **e2e** (`oauth-1-schema-guard.spec.ts`): a DB-seeded password-less user
  cannot log in through the password form and sees the provider-specific
  message; an ordinary password account is unaffected.
- **Gate:** migration applies cleanly to a populated dev DB; existing
  `auth.test.js` suite still green; new guard test passes.

### Phase 2 — Sign in with Google, existing identity only (1 day)

- Provider-agnostic core, `backend/lib/oauth/`: discovery + JWKS fetch and
  cache, PKCE helpers, state-JWT issue/verify, code exchange over global
  `fetch` (Node ≥24, no new HTTP client dependency), ID-token verification
  with `jose`. A `providers/google.ts` adapter supplies the provider-specific
  bits (issuer, scopes, claim mapping).
- `generateToken` and `serializeLoginUser` are exported from
  `userController.ts` (currently module-private) and reused by
  `oauthController.ts` rather than duplicated.
- Frontend: a `useProviders` query hook (`features/auth/hooks.ts`) backing
  an `OAuthButtons` component — rendered as a sibling above `LoginForm` and
  `RegisterForm` inside `AuthLayout`'s children (`LoginPage.tsx:24`,
  `RegisterPage.tsx:18-20`), so it sits outside the RHF `<form>` and needs
  no `type="button"` gymnastics. Uses `Button variant="outline"`; a new
  `Separator` primitive ("or continue with") since none exists in
  `components/ui/` today. A new `/auth/callback` route under the pathless
  `_public` layout in `router.tsx` reads the URL fragment and, for the
  straight-login outcome, calls `setSession` exactly as `useLogin` does.
  MSW handlers added to `frontend/src/test/msw/authHandlers.ts`. New locale
  keys added to `loginRegister.json` in all four languages (en/es/de/ee).
  Inline SVG brand mark for Google (Phosphor Icons has no brand logos).
- Scope limit for this phase: only an **already-linked** identity can log
  in. New-email and existing-email-match outcomes return a clear "not yet
  supported" error — Phases 3 and 4 build those.
- **e2e** (`oauth-2-google-login.spec.ts`): with an `oauth_identities` row
  pre-seeded via `e2e/fixtures/db.ts`, clicking "Continue with Google" walks
  through the stub issuer and lands signed in on Home.
- **Gate:** Google login works end-to-end against the stub for a pre-linked
  identity; existing email+password e2e specs unaffected.

### Phase 3 — OAuth signup completion (1 day)

- Callback outcome (b): a `sub` with no matching email issues a 10-minute
  `oauth_signup` ticket instead of logging in. `/auth/callback` routes this
  to a signup-completion screen: username input (prefilled from the email's
  local part, editable, same uniqueness check as `registerUser`), and the
  existing `LanguageTiles` two-or-more picker (reusing
  `normalizeLanguageSelection` server-side — the same rule as regular
  registration, not relaxed).
- `POST /api/auth/signup/complete` creates the user with `password: null`,
  `verified: true`, and **no confirmation email sent** — this is the one
  place the standard registration flow's email step is deliberately
  skipped, because Google already verified the address.
- **e2e** (`oauth-3-google-signup.spec.ts`): a brand-new Google identity via
  the stub completes the language step and lands signed in on Home; the DB
  row shows `verified = true`, `password IS NULL`, and exactly one
  `oauth_identities` row; no mail was sent (reusing the existing
  `jest.mock('../utils/sendEmail', ...)` pattern, asserted at the e2e layer
  via absence of a verification-token row).
- **Gate:** new-user OAuth signup works end-to-end, is immediately verified,
  and never touches the mail sender.

### Phase 4 — Linking to an existing password account (½–1 day)

- Callback outcome (c): a `sub` with an email matching an existing password
  account (via `findUserByEmailInsensitive`, the same case-insensitive
  lookup `registerUser`/`loginUser` already use) issues a 10-minute
  `oauth_link` ticket. `/auth/callback` routes this to a password-confirm
  screen.
- `POST /api/auth/link` verifies the password with `bcrypt.compare`, inserts
  the `oauth_identities` row, and returns `serializeLoginUser`. A wrong
  password is rejected without consuming the ticket, so the user can retry.
- **e2e** (`oauth-4-linking.spec.ts`): an existing password-registered user
  clicks "Continue with Google" on an email that matches their account,
  confirms with their password once, and on a later visit signs in with one
  click, no password; a wrong password on the confirm screen is rejected and
  retryable.
- **Gate:** linking requires and correctly checks the password; a linked
  account subsequently logs in via either method.

### Phase 5 — Connected methods in the Account profile (½ day)

- `GET /api/auth/identities` (protected) feeds a "Sign-in methods" row
  placed directly under the email `InfoRow` in `ProfileView`
  (`AccountPage.tsx:81-87`) — read-only chips ("Password", "Google").
- In `ProfileForm`, immediately below the existing disabled email block
  (`ProfileForm.tsx:102-116`), Connect/Disconnect controls — shown **only in
  the profile's existing edit mode**, per how the rest of the profile
  already works (no separate settings page). Connect re-runs the
  `/api/auth/:provider/link` protected-start flow; Disconnect calls
  `DELETE /api/auth/identities/:id`.
- Unlink is refused (400, surfaced as a toast) when it would remove the
  user's last sign-in method — a password-less user cannot unlink their only
  provider and lock themselves out.
- **e2e** (`oauth-5-connected-methods.spec.ts`): a password-registered user
  links Google from the profile edit view, sees it listed, then unlinks it;
  a user with only one method attempting to unlink it is blocked with a
  clear message.
- **Gate:** connect/disconnect works from the Account page; the last-method
  guard holds.

### Phase 6 — Ship: staging/production secrets, consent screen, deployed smoke (½ day)

- Real Google client ID and secret into both GitHub Environment secret sets
  and `deploy/env/app.env.example` — redirect URIs were already registered
  for `staging.ladu.com.ar` and `app.ladu.com.ar` back in Phase 0.
- Google's OAuth consent screen published for the `openid email profile`
  scopes this plan uses — no further Google review is expected at that scope,
  but the doc flags the possibility in case scopes ever grow.
- Confirm the staging smoke account (`smoke-test@ladu.test`) is unaffected —
  it stays password-based; OAuth is additive.
- **e2e**: extends `deployed-smoke.spec.ts` with a real Google sign-in
  against staging, then production, using a disposable test account (not
  the CI stub — this phase's whole point is proving the real integration).
- **Gate:** a real Google sign-in succeeds on staging, then on production,
  with no manual step beyond the one-time consent-screen approval.

---

## 5. Testing

Layered the same way the rest of the repo already is:

- **Backend (Jest)** — `backend/tests/oauth.test.js`. Follows the existing
  `auth.test.js` conventions: `jest.mock('../utils/sendEmail', ...)` declared
  *above* `require('../app')` (the file isn't transformed, so `jest.mock`
  hoisting doesn't apply — same trap `auth.test.js:1-11` already documents),
  single-threaded against the shared test DB, `clearDB()` between tests. ID
  tokens for unit tests are either signed locally with `jose` against a
  throwaway key, or run against the Phase 0 stub issuer.
- **Frontend (Vitest + MSW)** — new handlers in
  `frontend/src/test/msw/authHandlers.ts` for `/api/auth/providers`,
  `/api/auth/:provider/start`, `/api/auth/signup/complete`,
  `/api/auth/link`, `/api/auth/identities`. MSW's global
  `onUnhandledRequest: 'error'` setting (`src/test/setup.ts:34`) means any
  OAuth call left unmocked fails the suite outright — a forcing function to
  keep the handler list current, not an obstacle to work around.
- **e2e (Playwright)** — one spec per phase against the stub issuer, per the
  table above, following the `oauth-N-*.spec.ts` naming (kept distinct from
  the main build plan's own `phase-N-*.spec.ts` files) and the
  `e2e/fixtures/db.ts` pattern (`deleteUsersByEmail`, `@ladu.test` synthetic
  addresses) for setup/teardown. `npm run test:e2e` remains the required
  gate.
- **One pre-existing selector to audit once "Sign in with Google" ships**:
  several specs use `getByRole('button', { name: 'Sign in' })` for the
  password-login submit button. RTL/Playwright's accessible-name match is
  exact by default, so an added "Continue with Google" button won't collide
  — but this should be confirmed, not assumed, the first time the button
  exists.

---

## 6. Cost

| Item | Cost |
|---|---|
| Google Cloud OAuth 2.0 client (project required, no billing account needed for `openid email profile`) | €0 |
| **Total** | **€0/mo** |

Google isn't usage-billed at the scopes this plan uses. Confirm scope list
stays at `openid email profile` — broader scopes can trigger paid tiers or a
formal verification review.

---

## 7. Skills this plan shows (CV)

1. OAuth 2.0 / OIDC: authorization code flow with PKCE, state and nonce for
   CSRF/replay protection, ID-token verification against a provider's live
   JWKS
2. Identity modelling: linking multiple sign-in methods to one account
   without opening an account-takeover path (password-confirmed linking,
   provider-`sub`-keyed lookup instead of email-keyed)
3. Integrating a third-party identity provider into an existing hand-rolled
   auth layer (JWT, bcrypt) without introducing a session store or rewriting
   what already works
4. Deterministic testing of third-party auth: a stub OIDC issuer implementing
   the real discovery/token/JWKS contract, wired into CI instead of mocking
   the client library away
5. Secret and redirect-URI management across three environments (local,
   staging, production) for an external identity provider

---

## 8. Sources

- Google Identity — OpenID Connect: developers.google.com/identity/openid-connect/openid-connect (checked 2026-09-23)
- `jose` (JWT/JWK/JWKS library) docs: github.com/panva/jose (checked 2026-09-23)
