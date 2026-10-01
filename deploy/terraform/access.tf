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
