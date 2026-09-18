provider "cloudflare" {
  # Reads the API token from the CLOUDFLARE_API_TOKEN environment variable.
  # That variable is set on the HCP Terraform workspace, never in code.
}

# Zone-wide TLS settings (§1 of the deployment strategy). Each setting is a
# singleton that already exists with some value in Cloudflare — Terraform
# takes over its value going forward, no import needed.

resource "cloudflare_zone_setting" "ssl_mode" {
  zone_id    = var.cloudflare_zone_id
  setting_id = "ssl"
  value      = "strict"
}

resource "cloudflare_zone_setting" "always_use_https" {
  zone_id    = var.cloudflare_zone_id
  setting_id = "always_use_https"
  value      = "on"
}

resource "cloudflare_zone_setting" "min_tls_version" {
  zone_id    = var.cloudflare_zone_id
  setting_id = "min_tls_version"
  value      = "1.2"
}
