# Email deliverability records for Resend (replaces Gmail/nodemailer SMTP).
# SPF, DKIM and the bounce MX are added once Resend generates their
# domain-specific values (Resend dashboard > Domains > Add Domain).

resource "cloudflare_dns_record" "dmarc" {
  zone_id = var.cloudflare_zone_id
  name    = "_dmarc.${var.domain}"
  type    = "TXT"
  content = "v=DMARC1; p=none;"
  ttl     = 1
}
