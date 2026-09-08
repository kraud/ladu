/**
 * Build-time feature flags — the new-repo equivalent of the old app's
 * `checkEnvironmentAndIterationToDisplay(iteration)` gate.
 *
 * `frontend/src/env.ts` reads `VITE_*` while the root `.env` still carries
 * CRA-era `REACT_APP_*`, so today every flag resolves to its default below.
 * That is intended for Phase 1 — the flags exist so the header can gate
 * search / notifications now and a real env var can flip them later without
 * touching component code.
 */

function readFlag(name: string, fallback: boolean): boolean {
    const raw = import.meta.env[name as keyof ImportMetaEnv];
    if (raw === undefined || raw === '') return fallback;
    return String(raw).toLowerCase() === 'true';
}

export const featureFlags = {
    /** Header global search — no data source until Phase 3. */
    globalSearch: readFlag('VITE_FEATURE_GLOBAL_SEARCH', false),
    /** Notification bell + polling — no data source until Phase 6. */
    notifications: readFlag('VITE_FEATURE_NOTIFICATIONS', false),
    /** Tag features (Phase 4). */
    tags: readFlag('VITE_FEATURE_TAGS', true),
    /** Friend features (Phase 6). */
    friends: readFlag('VITE_FEATURE_FRIENDS', true),
} as const;

export type FeatureFlag = keyof typeof featureFlags;
