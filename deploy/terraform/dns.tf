# Records that already exist in Cloudflare, created outside Terraform
# (via Vercel's domain-connect flow). This file only codifies the current
# state — it makes no changes. New records (app/staging, email, etc.) are
# added in later files once these are safely under Terraform management.

# --- Vercel wildcard (*.ladu.com.ar) ---
# Currently what makes app./staging. resolve, until slice 2 gives them
# their own dedicated records.

resource "cloudflare_dns_record" "wildcard_a_1" {
  zone_id = var.cloudflare_zone_id
  name    = "*.${var.domain}"
  type    = "A"
  content = "216.198.79.1"
  ttl     = 1
  proxied = true
}

import {
  to = cloudflare_dns_record.wildcard_a_1
  id = "${var.cloudflare_zone_id}/b5bb457732dd597820bd826e4a16b7f4"
}

resource "cloudflare_dns_record" "wildcard_a_2" {
  zone_id = var.cloudflare_zone_id
  name    = "*.${var.domain}"
  type    = "A"
  content = "64.29.17.1"
  ttl     = 1
  proxied = true
}

import {
  to = cloudflare_dns_record.wildcard_a_2
  id = "${var.cloudflare_zone_id}/214491ef4c8e0efba95955ba588ae52e"
}

# --- Vercel apex (ladu.com.ar) ---

resource "cloudflare_dns_record" "apex_a_1" {
  zone_id = var.cloudflare_zone_id
  name    = var.domain
  type    = "A"
  content = "64.29.17.1"
  ttl     = 1
  proxied = true
}

import {
  to = cloudflare_dns_record.apex_a_1
  id = "${var.cloudflare_zone_id}/21f0c8b46a96ea1dc03ee681b6b35307"
}

resource "cloudflare_dns_record" "apex_a_2" {
  zone_id = var.cloudflare_zone_id
  name    = var.domain
  type    = "A"
  content = "216.198.79.1"
  ttl     = 1
  proxied = true
}

import {
  to = cloudflare_dns_record.apex_a_2
  id = "${var.cloudflare_zone_id}/4e22448b488b6542adb3d622c52d8059"
}

# --- Vercel www ---

resource "cloudflare_dns_record" "www_a_1" {
  zone_id = var.cloudflare_zone_id
  name    = "www.${var.domain}"
  type    = "A"
  content = "64.29.17.65"
  ttl     = 1
  proxied = true
}

import {
  to = cloudflare_dns_record.www_a_1
  id = "${var.cloudflare_zone_id}/202db2938fb931044eab9c4366f4d777"
}

resource "cloudflare_dns_record" "www_a_2" {
  zone_id = var.cloudflare_zone_id
  name    = "www.${var.domain}"
  type    = "A"
  content = "216.198.79.1"
  ttl     = 1
  proxied = true
}

import {
  to = cloudflare_dns_record.www_a_2
  id = "${var.cloudflare_zone_id}/4b2611553e86c4fe06d6612fea89dc8e"
}

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

# --- Vercel domain-connect marker ---

resource "cloudflare_dns_record" "domainconnect_cname" {
  zone_id = var.cloudflare_zone_id
  name    = "_domainconnect.${var.domain}"
  type    = "CNAME"
  content = "_domainconnect.vercel-dns.com"
  ttl     = 1
  proxied = true
}

import {
  to = cloudflare_dns_record.domainconnect_cname
  id = "${var.cloudflare_zone_id}/7346d1230fea8f8a749a48c3150c4bd4"
}
