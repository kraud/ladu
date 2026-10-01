/**
 * The generic links shown on the health page when the server sends no private
 * ones: when `ADMIN_LINKS` is not set, when it is invalid, or when the health
 * API itself does not answer. They are only the public front pages of each
 * service, because this repository is public.
 *
 * The real addresses (your Sentry project, your Healthchecks project, your
 * Netcup page...) are not here. They live in the `ADMIN_LINKS` GitHub
 * Environment secret, are written into the backend's `.env` on deploy
 * (backend/lib/adminLinks.ts), and arrive in the `GET /api/admin/health`
 * response.
 */
export interface ExternalLink {
    label: string;
    description: string;
    href: string;
}

export const FALLBACK_LINKS: ExternalLink[] = [
    { label: 'Sentry', description: 'Errors from the backend and the app', href: 'https://sentry.io/' },
    { label: 'UptimeRobot', description: 'Is each site up? Alerts by email', href: 'https://dashboard.uptimerobot.com/' },
    { label: 'Healthchecks.io', description: 'Did the weekly restore test run?', href: 'https://healthchecks.io/' },
    { label: 'Cloudflare', description: 'DNS, traffic and TLS', href: 'https://dash.cloudflare.com/' },
    { label: 'Netcup server panel', description: 'CPU, RAM and disk of the VPS', href: 'https://www.servercontrolpanel.de/' },
    { label: 'GitHub Actions', description: 'Builds and deploys', href: 'https://github.com/kraud/ladu/actions' },
    { label: 'Public health: production', description: 'What the live backend reports', href: 'https://app.ladu.com.ar/api/health' },
    { label: 'Public health: staging', description: 'What the staging backend reports', href: 'https://staging.ladu.com.ar/api/health' },
];
