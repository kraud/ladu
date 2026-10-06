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
for its DNS-01 challenge, the Backblaze B2 key pair, the Healthchecks.io
ping URL, and the GHCR pull token (`vault_ghcr_pull_token`, see below).

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

## GHCR pull token (private images)

`ladu-backend` and `ladu-admin` are **private** packages on GHCR. (`ladu-web`
and `ladu-landing` are public.) The VPS can pull a private image only after a
`docker login`, so Ansible logs in as the `deploy` user. The Docker config of
that user (`~deploy/.docker/config.json`) then serves `deploy.sh` and rollbacks.

| Item | Detail |
|---|---|
| What | A **classic** personal access token (GitHub does not support fine-grained tokens for packages) |
| Scope | Only `read:packages`. Nothing else. |
| Name | `ladu-vps-ghcr-pull` |
| Expiry | 1 year. Write the date in your calendar. When it runs out, deploys fail with "denied". |
| Stored in | Ansible Vault, as `vault_ghcr_pull_token`. The user name is `ghcr_username` in `group_vars/all/vars.yml`. |
| Used by | The `platform` role, task "Log in to GHCR so the VPS can pull the private images" |

A token with `read:packages` can read **every** package of your account. Keep it
in the vault only. Never commit it and never paste it into a chat or a tool call.

**To create or rotate it:**

1. GitHub, Settings, Developer settings, Personal access tokens, **Tokens (classic)**,
   Generate new token. Name `ladu-vps-ghcr-pull`, expiry 1 year, tick **only** `read:packages`.
2. Copy the token once. `cd deploy/ansible && ansible-vault edit group_vars/all/vault.yml`
   and set `vault_ghcr_pull_token: "<token>"`.
3. Run the playbook from `deploy/ansible/` so the VPS logs in again:
   `ansible-playbook site.yml`. It is safe to repeat. Add `--check` first for a dry run.
   Then test on the VPS as `deploy`: `docker pull ghcr.io/kraud/ladu-backend:<a recent sha>`.
4. Revoke the old token in GitHub.

**First time only (order matters):** do steps 1 to 3 while the packages are still
public, and test a pull on the VPS. Only then switch `ladu-backend` and `ladu-admin`
to private (package page, Package settings, Change visibility). If you switch first,
the next deploy fails.

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
| `ADMIN_JWT_SECRET` | Signs the admin dashboard's staff tokens. A different value from `JWT_SECRET`, and a different value per environment (generate with `openssl rand -hex 32`). If it is missing or empty, the backend still starts, and `POST /api/admin/auth/login` answers 503 |
| `ADMIN_LINKS` | Optional. The private tool links on the admin health page (your Sentry project, Healthchecks project, Netcup page...). The repo is public, so the real addresses live only here. One line of JSON; see "The admin health page links" below. If it is missing, the page shows generic links |
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

### The admin health page links (`ADMIN_LINKS`) {#admin-links}

The health page of the admin dashboard has a "More detail in other tools"
section. Its real addresses must not be in the public repository, so they
are a GitHub Environment secret, `ADMIN_LINKS`. The deploy writes it into each
environment's `.env`. The backend checks it (`backend/lib/adminLinks.ts`) and
sends it to the page. If the secret is missing, the page shows generic links
(the public front pages of each tool).

**To set or change the links:**

1. Write the list in a file **outside the repository**, for example
   `~/ladu-admin-links.json`. Use this shape (the `description` is optional):

   ```json
   [
     { "label": "Sentry (backend)", "description": "Errors from the API", "href": "https://..." },
     { "label": "Netcup", "description": "CPU, RAM and disk", "href": "https://..." }
   ]
   ```

2. Turn it into **one line** (an `.env` file has one line for each value):
   `jq -c . ~/ladu-admin-links.json | pbcopy`
   (Without `jq`: `python3 -c 'import json,sys;print(json.dumps(json.load(open(sys.argv[1])),separators=(",",":")))' ~/ladu-admin-links.json | pbcopy`)

3. Save it as the secret in **both** environments. The value can be the same:
   `jq -c . ~/ladu-admin-links.json | gh secret set ADMIN_LINKS --env staging --repo kraud/ladu`
   `jq -c . ~/ladu-admin-links.json | gh secret set ADMIN_LINKS --env production --repo kraud/ladu`
   (Or paste the line in GitHub, Settings, Environments, the environment, Add secret.)

4. Run the **Deploy** workflow again (Actions tab, Deploy, Run workflow, or merge
   anything to `main`). The secret reaches the server only on a deploy.

**Rules:**
- Every `href` must start with `https://`. One wrong entry makes the whole value
  invalid. Then the page shows the generic links and a yellow note, and the
  backend log has one line, `ADMIN_LINKS is set but not usable: ...` (it never
  prints the addresses).
- A `$` in an address is lost: Docker Compose reads it as a variable (tested:
  `a$b` becomes `a`). Write `%24` instead. `&`, `?`, `=`, `#` and `%` are fine.
- Up to 30 links. A label has at most 60 characters, a description 120.
- Never put a Healthchecks **ping** URL (`hc-ping.com/...`) here. Anyone with it
  can send a fake "OK". The project page (`healthchecks.io/projects/...`) is fine.

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

Holds one sensitive value for this project: the Cloudflare API
token Terraform itself uses, stored as a workspace variable (never as a
local env var, never in a GitHub secret) — this is the one credential in the
whole system that was created manually in Cloudflare's dashboard rather than
managed by Terraform, since Terraform obviously can't hand itself its own
starting credential. That token needs the permission **Access: Apps and
Policies: Edit** (on the account) for `access.tf`, besides the DNS permissions.

It also holds one plain (non-sensitive) workspace variable,
`admin_access_emails`: the list of email addresses that Cloudflare Access lets
through to the admin dashboard, for example `["you@example.com"]`. It has no
default on purpose, so the addresses are not in the repository.

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
| Who may open the admin dashboard (the Access login) | The `admin_access_emails` variable on the HCP Terraform workspace, then `terraform apply` |
| Who may use the admin dashboard once inside (staff accounts) | The staff page in the dashboard; the first `owner` is made with `scripts/create-staff.js` (see the troubleshooting playbook) |
| Server-level config (firewall rules, installed packages, backup schedule) | The relevant Ansible role, then `ansible-playbook site.yml` |
