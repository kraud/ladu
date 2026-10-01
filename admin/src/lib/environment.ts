/**
 * Which environment the admin app is signed in to, as the backend reports it in
 * the session (`StaffUser.environment`). The header shows a mark so staging and
 * production cannot be confused — a safety affordance for an ops tool.
 *
 * The deployed names come from `deploy/compose/app.yml` (deliberately "staging"
 * and "prod", not "production"). Anything else (local development, a missing or
 * unknown value) is left unmarked: no mark is safer than a wrong one.
 */
export type EnvironmentMark = 'staging' | 'production' | null;

export function environmentMark(environment: string): EnvironmentMark {
    if (environment === 'staging') return 'staging';
    if (environment === 'prod' || environment === 'production') return 'production';
    return null;
}
