# Scoped Cloudflare API token for Caddy's DNS-01 ACME challenge (edge role,
# Phase C Ansible). Narrower than the Terraform token: DNS edit on this one
# zone only, nothing else. The Terraform token itself is not managed here —
# it was created manually and lives only as an HCP Terraform workspace
# variable, since Terraform can't hand itself its own bootstrap credential.

data "cloudflare_api_token_permission_groups_list" "dns_write" {
  name  = "DNS Write"
  scope = "com.cloudflare.api.account.zone"
}

resource "cloudflare_api_token" "caddy_dns01" {
  name = "ladu-caddy-dns01"

  policies = [
    {
      effect = "allow"
      permission_groups = [
        {
          id = data.cloudflare_api_token_permission_groups_list.dns_write.result[0].id
        }
      ]
      resources = jsonencode({
        "com.cloudflare.api.account.zone.${var.cloudflare_zone_id}" = "*"
      })
    }
  ]
}

output "caddy_dns01_token" {
  description = "Cloudflare API token for Caddy's DNS-01 challenge. Retrieve with: terraform output -raw caddy_dns01_token. Goes into Ansible Vault in a later slice."
  value       = cloudflare_api_token.caddy_dns01.value
  sensitive   = true
}
