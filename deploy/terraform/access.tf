# Cloudflare Access in front of the admin dashboard (.context/plans/admin-dashboard.md, slice 7).
#
# What Access is: a login page that Cloudflare shows BEFORE a request reaches the
# VPS. Every request to admin. and admin-staging. already passes through
# Cloudflare (the DNS records in dns.tf are proxied). With Access on, a visitor
# first gets Cloudflare's own page, enters an allowed email address, and types
# the one-time code sent to that address. Only then does the request continue to
# Caddy. Someone who does not know an allowed address cannot even load the page.
#
# It is the FIRST of two locks. The second is the staff login in our own code
# (POST /api/admin/auth/login). Neither replaces the other.
#
# Free plan: Zero Trust is free for up to 50 users. Prerequisites that are NOT
# managed here (they cannot be, or they are one-time account setup):
#   - Zero Trust is enabled on the Cloudflare account, with a team name chosen.
#   - "One-time PIN" is an enabled login method (it is the default).
#   - The Terraform API token (the one in the HCP workspace) has the permission
#     "Access: Apps and Policies: Edit" on the account. Without it, `terraform
#     apply` fails on the two resources below with an authorization error.

resource "cloudflare_zero_trust_access_policy" "admin_staff" {
  account_id = var.cloudflare_account_id
  name       = "Ladu admin: allowed staff"
  decision   = "allow"

  include = [
    for email in var.admin_access_emails : {
      email = { email = email }
    }
  ]
}

# One application per hostname: they get separate entries in Cloudflare's logs,
# and staging can be changed without touching production. Both use the same
# policy.
resource "cloudflare_zero_trust_access_application" "admin_prod" {
  account_id = var.cloudflare_account_id
  name       = "Ladu Admin (production)"
  domain     = "admin.${var.domain}"
  type       = "self_hosted"

  # The same length as the staff token (8 hours), so the two sessions end together.
  session_duration = "8h"

  policies = [
    {
      id         = cloudflare_zero_trust_access_policy.admin_staff.id
      precedence = 1
    }
  ]

  # Access must exist before the hostname can be reached, never after.
  depends_on = [cloudflare_dns_record.admin_a, cloudflare_dns_record.admin_aaaa]
}

resource "cloudflare_zero_trust_access_application" "admin_staging" {
  account_id = var.cloudflare_account_id
  name       = "Ladu Admin (staging)"
  domain     = "admin-staging.${var.domain}"
  type       = "self_hosted"

  session_duration = "8h"

  policies = [
    {
      id         = cloudflare_zero_trust_access_policy.admin_staff.id
      precedence = 1
    }
  ]

  depends_on = [cloudflare_dns_record.admin_staging_a, cloudflare_dns_record.admin_staging_aaaa]
}

# --- Staging learner app (added 2026-10-27) ---
#
# staging. was public until now: anyone could register, sign in, and use the
# real app (and its real Resend email) before we could look at it. The same
# two locks that protect the admin dashboards now protect staging:
#
#   1. Cloudflare Access (this file) in front of the whole hostname.
#   2. The app's own access gates (registration closed, login limited) — kept
#      as defence in depth, because Access is checked at Cloudflare's edge and
#      the firewall only trusts Cloudflare's IP ranges (see the documented
#      "direct-to-origin through another Cloudflare account" limit on the admin
#      dashboards, which applies here too).
#
# The CI smoke test (deploy.yml's `smoke` job) is a machine, not a person, so
# it cannot do the email one-time-code flow. It authenticates with a service
# token instead (decision `non_identity`, below): Playwright sends
# `CF-Access-Client-Id`/`CF-Access-Client-Secret` on every request, and Access
# lets those through without a login page. The token is `forever` (no expiry),
# so a deploy does not silently start failing on a calendar date; rotating it
# is a manual step (see infrastructure-guide/06-secrets-and-access.md).
resource "cloudflare_zero_trust_access_service_token" "staging_smoke" {
  account_id = var.cloudflare_account_id
  name       = "ladu-staging-smoke"
  duration   = "forever"
}

resource "cloudflare_zero_trust_access_policy" "staging_smoke" {
  account_id = var.cloudflare_account_id
  name       = "Ladu staging: CI smoke service token"
  decision   = "non_identity"

  include = [
    {
      service_token = {
        token_id = cloudflare_zero_trust_access_service_token.staging_smoke.id
      }
    }
  ]
}

locals {
  # Empty staging list = same people as the admin dashboards.
  staging_access_emails = length(var.staging_access_emails) > 0 ? var.staging_access_emails : var.admin_access_emails
}

resource "cloudflare_zero_trust_access_policy" "staging_staff" {
  account_id = var.cloudflare_account_id
  name       = "Ladu staging: allowed staff"
  decision   = "allow"

  include = [
    for email in local.staging_access_emails : {
      email = { email = email }
    }
  ]
}

resource "cloudflare_zero_trust_access_application" "staging" {
  account_id = var.cloudflare_account_id
  name       = "Ladu staging"
  domain     = "staging.${var.domain}"
  type       = "self_hosted"

  session_duration = "8h"

  policies = [
    {
      id         = cloudflare_zero_trust_access_policy.staging_smoke.id
      precedence = 1
    },
    {
      id         = cloudflare_zero_trust_access_policy.staging_staff.id
      precedence = 2
    }
  ]

  depends_on = [cloudflare_dns_record.staging_a, cloudflare_dns_record.staging_aaaa]
}

# /api/health must stay reachable WITHOUT a login: deploy.sh polls it after a
# container swap (deploy/scripts/deploy.sh), and it only ever returns status +
# the commit SHA, which are public today. A hostname-wide Access app answers
# 302 with no SHA, so the poll would time out and every deploy would roll back.
# This path-scoped app wins over the hostname app above (Cloudflare matches the
# most specific application), so /api/health skips the login.
resource "cloudflare_zero_trust_access_policy" "staging_health_bypass" {
  account_id = var.cloudflare_account_id
  name       = "Ladu staging: /api/health public"
  decision   = "bypass"

  include = [
    { everyone = {} }
  ]
}

resource "cloudflare_zero_trust_access_application" "staging_health" {
  account_id = var.cloudflare_account_id
  name       = "Ladu staging health"
  domain     = "staging.${var.domain}/api/health"
  type       = "self_hosted"

  policies = [
    {
      id         = cloudflare_zero_trust_access_policy.staging_health_bypass.id
      precedence = 1
    }
  ]

  depends_on = [cloudflare_dns_record.staging_a, cloudflare_dns_record.staging_aaaa]
}

# The service token's two halves, for the GitHub `staging` Environment secrets
# CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET. Read them after an apply:
#   terraform output -raw staging_smoke_client_id
#   terraform output -raw staging_smoke_client_secret
output "staging_smoke_client_id" {
  description = "Cloudflare Access service token client ID for the staging CI smoke test."
  value       = cloudflare_zero_trust_access_service_token.staging_smoke.client_id
}

output "staging_smoke_client_secret" {
  description = "Cloudflare Access service token client secret for the staging CI smoke test."
  value       = cloudflare_zero_trust_access_service_token.staging_smoke.client_secret
  sensitive   = true
}
