provider "cloudflare" {
  # Reads the API token from the CLOUDFLARE_API_TOKEN environment variable.
  # That variable is set on the HCP Terraform workspace, never in code.
}
