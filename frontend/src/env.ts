/**
 * Single module owning all environment access.
 * Vite exposes env vars via `import.meta.env` with a `VITE_` prefix.
 */
export const environmentName = import.meta.env.VITE_ENVIRONMENT_NAME as string | undefined;
export const iteration = import.meta.env.VITE_ITERATION as string | undefined;
export const baseUrl = import.meta.env.BASE_URL;

// Baked in at image build time (frontend/Dockerfile) — one image serves
// both staging and production, so gitSha reflects whichever commit produced
// this specific image, and sentryDsn is the same value in both (a plain
// GitHub repository secret, not per-Environment — see deployment-strategy.md
// Phase E, E-d).
export const gitSha = import.meta.env.VITE_GIT_SHA as string | undefined;
export const sentryDsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
