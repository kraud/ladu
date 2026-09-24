# Secrets and access

A map of every credential in this system: what it is, where it lives, and
how to change it. General rule followed throughout the build: **credential
material is never typed into a tool call or committed to git** — it's
entered directly by a human into the GitHub UI, `ansible-vault edit`, or the
relevant service's own dashboard.

## SSH access to the VPS

Two separate keypairs, deliberately not shared:

| Key | Used by | Purpose | Notes |
|---|---|---|---|
| `~/.ssh/ladu_deploy` | You, by hand | Full server administration (Ansible runs, manual `psql`, manual `deploy.sh`) | The "admin" key. |
| `~/.ssh/ladu_ci_deploy` | GitHub Actions only | SSH in and run `deploy.sh` — nothing else | Narrower purpose on purpose: if this key ever leaked, the blast radius is "can deploy," not "can reconfigure the server." Its private half is the `VPS_DEPLOY_SSH_KEY` GitHub repository secret. |

Both public keys are installed on the `deploy` user's `authorized_keys` by
the Ansible `base` role — adding one never removes the other.

Root login and password authentication are both disabled on the VPS
(`sshd_config`) — the `deploy` user with one of the two keys above is the
only way in.

## Ansible Vault

Server-side secrets that Ansible needs to *provision* the VPS (as opposed to
runtime app secrets, which GitHub Environments own — see below) live
encrypted in `deploy/ansible/group_vars/all/vault.yml`, prefixed `vault_*` by
convention. This includes: the Postgres superuser password, each
environment's database user password, the Cloudflare DNS token Caddy uses
for its DNS-01 challenge, the Backblaze B2 key pair, and the Healthchecks.io
ping URL.

```bash
cd deploy/ansible
ansible-vault view group_vars/all/vault.yml    # read
ansible-vault edit group_vars/all/vault.yml    # edit in place
```

Requires the vault password (kept in `.vault_pass`, itself gitignored —
never commit it).

**If you rotate a database password here**, you must also update the
matching `DATABASE_URL` in the affected GitHub Environment secret (see
below) — the value is stored in two places on purpose (Ansible needs it to
*create* the user; the app needs it to *connect*), and they have to match.

## GitHub repository secrets

Shared by both the `staging` and `production` jobs in `deploy.yml` — these
are about *reaching the VPS*, not about which environment:

| Secret | What |
|---|---|
| `VPS_HOST` | The VPS's IP address |
| `VPS_DEPLOY_SSH_KEY` | Private half of `~/.ssh/ladu_ci_deploy` |
| `VPS_HOST_KEY` | The VPS's SSH host public key, pinned once via `ssh-keyscan` so the CI job doesn't trust-on-first-connect |
| `SENTRY_DSN_FRONTEND` | The frontend Sentry project's DSN — a repository secret rather than per-environment, because the image is built once for both environments (see [`01-architecture-overview.md`](01-architecture-overview.md)) and that build step has no Environment context to read a scoped secret from |

## GitHub Environment secrets (`staging` and `production`)

Each environment has its own **mirrored** set of app-level secrets — same
variable names, different (environment-appropriate) values:

| Secret | What |
|---|---|
| `DATABASE_URL` | Full connection string for that environment's database |
| `JWT_SECRET` | Separate, independently-generated value per environment |
| `BASE_URL` | `https://staging.ladu.com.ar` or `https://app.ladu.com.ar` |
| `URL_EESTI_LANG_API` | The Estonian dictionary API URL (same value both environments) |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USER`, `EMAIL_PASS` | Resend SMTP config — `EMAIL_PASS` is a Resend API key, currently the *same* key shared across both environments |
| `EMAIL_FROM` | `staging@ladu.com.ar` or `noreply@ladu.com.ar` |
| `SENTRY_DSN` | The **backend** Sentry project's DSN (same value both environments — `environment`/`release` tags do the separation, not separate DSNs) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | The Google OAuth client for "Continue with Google". Written into each environment's deploy `.env`. Without both, the backend reports Google as not configured and the button does not render. The `smoke` job also reads `GOOGLE_CLIENT_ID` from the `staging` Environment (see below) — no separate secret for it |

`staging` additionally has:

| Secret | What |
|---|---|
| `SMOKE_TEST_EMAIL` | The persistent smoke-test account's email (`smoke-test@ladu.test`) |
| `SMOKE_TEST_PASSWORD` | Its password — **currently still the throwaway value set during initial one-off setup, not yet rotated** |

### Google check in the smoke job

The `smoke` job passes `GOOGLE_CLIENT_ID` (from the `staging` Environment's
existing secret above) to `deployed-smoke.spec.ts`, which checks that the
staging backend sends Google exactly that client ID and that Google accepts
it. The client ID is public — it appears in every redirect to Google — but
it is still read from the secret so the test compares against the configured
value, not a copy in the repo. If the secret is missing, the whole smoke job
fails (all its env vars are required at load time), not only the Google
check. Nothing new to rotate: the check uses no Google account and no
client secret.

### The smoke-test account {#smoke-test-account}

`smoke-test@ladu.test` on staging is used by the automated `smoke` job on
every deploy. It's low-risk (staging only, no real user data, synthetic
`@ladu.test` address) but its password was set expediently during one-off
manual setup and was never rotated to something intentional. To rotate it:

1. Change the account's password through its own normal update flow (not a
   raw DB edit) — either on the running site or via the API directly.
2. Update the `SMOKE_TEST_PASSWORD` GitHub Environment secret (`staging`) to
   match.

## HCP Terraform

Holds exactly one sensitive value for this project: the Cloudflare API
token Terraform itself uses, stored as a workspace variable (never as a
local env var, never in a GitHub secret) — this is the one credential in the
whole system that was created manually in Cloudflare's dashboard rather than
managed by Terraform, since Terraform obviously can't hand itself its own
starting credential.

## Sudo on the VPS

The `deploy` user has **passwordless sudo** (configured by the `base`
Ansible role). This is a deliberate simplification, not an oversight — it's
the same user that already has SSH access and Docker-group membership (which
itself is root-equivalent for anything Docker can do), so passwordless sudo
adds no new privilege in practice, just convenience.

## Quick reference: "where do I change X?"

| To change... | Go to |
|---|---|
| A database password | Ansible Vault, **then** the matching GitHub Environment secret |
| Where deploys reach the VPS (IP, SSH key) | GitHub repository secrets |
| An app-level env var value (email, JWT secret, API URLs) | The relevant GitHub Environment's secrets |
| A DNS record, TLS setting, or email-verification record | `deploy/terraform/*.tf`, then `terraform apply` |
| Server-level config (firewall rules, installed packages, backup schedule) | The relevant Ansible role, then `ansible-playbook site.yml` |
