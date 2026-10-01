variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID for the ladu.com.ar zone"
  type        = string
  default     = "3a11977743eb673219a2787e0083883e"
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID that owns the ladu.com.ar zone"
  type        = string
  default     = "9372bb80d0be541b7a1ea4b2a65f0cad"
}

variable "domain" {
  description = "Root domain managed by this zone"
  type        = string
  default     = "ladu.com.ar"
}

variable "vps_ipv4" {
  description = "Public IPv4 address of the Netcup VPS hosting app./staging."
  type        = string
  default     = "152.53.146.206"
}

variable "vps_ipv6" {
  description = "Public IPv6 address of the Netcup VPS hosting app./staging."
  type        = string
  default     = "2a0a:4cc0:c1:20b4:c8fb:e6ff:fe5e:f195"
}

variable "admin_access_emails" {
  description = <<-EOT
    Email addresses allowed through Cloudflare Access to admin. and
    admin-staging. (access.tf). No default on purpose: set it as a Terraform
    variable on the HCP Terraform workspace, so the addresses are not in the
    repository. Example value: ["you@example.com"]
  EOT
  type        = list(string)

  validation {
    condition     = length(var.admin_access_emails) > 0
    error_message = "Give at least one email address, or nobody can open the admin dashboard."
  }
}
