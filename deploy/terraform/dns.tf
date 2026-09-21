# DNS records for the zone. Most of these were created outside Terraform
# (originally via Vercel's domain-connect flow) and adopted with `import`
# blocks. Vercel is no longer used for anything: the apex, www, and
# app./staging. all point at the VPS, and the old Vercel wildcard and
# domain-connect records were removed (see the apex/www section below).

# --- Apex + www (landing) ---
# Both point at the VPS, where edge Caddy serves the landing container on the
# apex and redirects www to the apex (deploy/caddy/Caddyfile).
#
# These were the Vercel A records. The `moved` blocks keep the resource that
# already exists in Cloudflare (so it is updated in place, with no gap in
# DNS) and just give it an honest name. The second Vercel A record for each
# name is simply dropped, and Terraform destroys it.

moved {
  from = cloudflare_dns_record.apex_a_1
  to   = cloudflare_dns_record.apex_a
}

resource "cloudflare_dns_record" "apex_a" {
  zone_id = var.cloudflare_zone_id
  name    = var.domain
  type    = "A"
  content = var.vps_ipv4
  ttl     = 1
  proxied = true
}

resource "cloudflare_dns_record" "apex_aaaa" {
  zone_id = var.cloudflare_zone_id
  name    = var.domain
  type    = "AAAA"
  content = var.vps_ipv6
  ttl     = 1
  proxied = true
}

moved {
  from = cloudflare_dns_record.www_a_1
  to   = cloudflare_dns_record.www_a
}

resource "cloudflare_dns_record" "www_a" {
  zone_id = var.cloudflare_zone_id
  name    = "www.${var.domain}"
  type    = "A"
  content = var.vps_ipv4
  ttl     = 1
  proxied = true
}

resource "cloudflare_dns_record" "www_aaaa" {
  zone_id = var.cloudflare_zone_id
  name    = "www.${var.domain}"
  type    = "AAAA"
  content = var.vps_ipv6
  ttl     = 1
  proxied = true
}

# --- No wildcard ---
# The old *.ladu.com.ar wildcard (Vercel) is deliberately not recreated.
# Every hostname in use has its own record, so an unknown subdomain now
# fails to resolve instead of landing on a server that has no site for it.
# Add a dedicated record (in this file) for any new subdomain.

# --- CAA: which certificate authorities may issue for this domain ---
# letsencrypt.org is already allowed, which is what Caddy will use later
# in Phase C for app./staging. certificates via DNS-01 — no change needed
# here for that to work.

resource "cloudflare_dns_record" "caa_sectigo" {
  zone_id = var.cloudflare_zone_id
  name    = var.domain
  type    = "CAA"
  ttl     = 1
  data = {
    flags = 0
    tag   = "issue"
    value = "sectigo.com"
  }
}

import {
  to = cloudflare_dns_record.caa_sectigo
  id = "${var.cloudflare_zone_id}/ca710bd636e27c65ea16e233daa244d5"
}

resource "cloudflare_dns_record" "caa_google" {
  zone_id = var.cloudflare_zone_id
  name    = var.domain
  type    = "CAA"
  ttl     = 1
  data = {
    flags = 0
    tag   = "issue"
    value = "pki.goog"
  }
}

import {
  to = cloudflare_dns_record.caa_google
  id = "${var.cloudflare_zone_id}/993cd8d9c485916d2eeb368daf9b7a1b"
}

resource "cloudflare_dns_record" "caa_letsencrypt" {
  zone_id = var.cloudflare_zone_id
  name    = var.domain
  type    = "CAA"
  ttl     = 1
  data = {
    flags = 0
    tag   = "issue"
    value = "letsencrypt.org"
  }
}

import {
  to = cloudflare_dns_record.caa_letsencrypt
  id = "${var.cloudflare_zone_id}/7575c517b9bd74574f8a20fe7cbd7521"
}

# --- VPS (app./staging.) ---
# The two environments served by the VPS. Each has its own A and AAAA record.

resource "cloudflare_dns_record" "app_a" {
  zone_id = var.cloudflare_zone_id
  name    = "app.${var.domain}"
  type    = "A"
  content = var.vps_ipv4
  ttl     = 1
  proxied = true
}

resource "cloudflare_dns_record" "app_aaaa" {
  zone_id = var.cloudflare_zone_id
  name    = "app.${var.domain}"
  type    = "AAAA"
  content = var.vps_ipv6
  ttl     = 1
  proxied = true
}

resource "cloudflare_dns_record" "staging_a" {
  zone_id = var.cloudflare_zone_id
  name    = "staging.${var.domain}"
  type    = "A"
  content = var.vps_ipv4
  ttl     = 1
  proxied = true
}

resource "cloudflare_dns_record" "staging_aaaa" {
  zone_id = var.cloudflare_zone_id
  name    = "staging.${var.domain}"
  type    = "AAAA"
  content = var.vps_ipv6
  ttl     = 1
  proxied = true
}
