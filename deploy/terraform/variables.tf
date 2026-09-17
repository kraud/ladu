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
