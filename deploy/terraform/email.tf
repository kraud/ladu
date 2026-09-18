# Email deliverability records for Resend (replaces Gmail/nodemailer SMTP).
# Resend's current domain-verification flow uses a DKIM TXT record plus two
# CNAMEs that delegate sending/bounce handling to its infrastructure,
# rather than the older raw MX + SPF-TXT pattern.

resource "cloudflare_dns_record" "dmarc" {
  zone_id = var.cloudflare_zone_id
  name    = "_dmarc.${var.domain}"
  type    = "TXT"
  content = "v=DMARC1; p=none;"
  ttl     = 1
}

resource "cloudflare_dns_record" "resend_dkim" {
  zone_id = var.cloudflare_zone_id
  name    = "resend._domainkey.${var.domain}"
  type    = "TXT"
  content = "p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQD21pa9Xcz3a9KoDI/N53ahw+L0n0XnD6Oy98SZzsAFf4YxI4LDkx5pRklpmZ+mZn+Aq18ps7iVGjzZJSlQA4iA+RpXOhUYo15T9mX0Ja914UCAzT26GWJxTBMIpau8Ayc9D6Y72hneHKdne8Jaob3iVakjnCWowZMjhlCIKaDRuwIDAQAB"
  ttl     = 1
}

resource "cloudflare_dns_record" "resend_rsend_cname" {
  zone_id = var.cloudflare_zone_id
  name    = "rsend.${var.domain}"
  type    = "CNAME"
  content = "rsend-euw1.forge.rmta.net"
  ttl     = 1
  proxied = false
}

resource "cloudflare_dns_record" "resend_send_cname" {
  zone_id = var.cloudflare_zone_id
  name    = "send.${var.domain}"
  type    = "CNAME"
  content = "send.forge.rmta.net"
  ttl     = 1
  proxied = false
}
