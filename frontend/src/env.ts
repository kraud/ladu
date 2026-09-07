/**
 * Single module owning all environment access.
 * Vite exposes env vars via `import.meta.env` with a `VITE_` prefix.
 */
export const environmentName = import.meta.env.VITE_ENVIRONMENT_NAME as string | undefined;
export const iteration = import.meta.env.VITE_ITERATION as string | undefined;
export const vercelBackendUrl = import.meta.env.VITE_VERCEL_BE_URL as string | undefined;
export const baseUrl = import.meta.env.BASE_URL;
