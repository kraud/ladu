terraform {
  cloud {
    organization = "Ladu"

    workspaces {
      name = "ladu-dns"
    }
  }

  required_version = ">= 1.9.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }
}
