/**
 * The tools that have the rest of the picture: CPU, RAM and disk graphs, error
 * reports, uptime history. These are the public front pages of each service,
 * because the account and project names are not in the repo. Replace a link
 * with the direct address of your project or monitor whenever you like.
 */
export interface ExternalLink {
    label: string;
    description: string;
    href: string;
}

export const EXTERNAL_LINKS: ExternalLink[] = [
    { label: 'Sentry', description: 'Errors from the backend and the app', href: 'https://sentry.io/' },
    { label: 'UptimeRobot', description: 'Is each site up? Alerts by email', href: 'https://dashboard.uptimerobot.com/' },
    { label: 'Healthchecks.io', description: 'Did the weekly restore test run?', href: 'https://healthchecks.io/' },
    { label: 'Cloudflare', description: 'DNS, traffic and TLS', href: 'https://dash.cloudflare.com/' },
    { label: 'Netcup server panel', description: 'CPU, RAM and disk of the VPS', href: 'https://www.servercontrolpanel.de/' },
    { label: 'GitHub Actions', description: 'Builds and deploys', href: 'https://github.com/kraud/ladu/actions' },
    { label: 'Public health: production', description: 'What the live backend reports', href: 'https://app.ladu.com.ar/api/health' },
    { label: 'Public health: staging', description: 'What the staging backend reports', href: 'https://staging.ladu.com.ar/api/health' },
];
