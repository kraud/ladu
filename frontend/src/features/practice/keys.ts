/**
 * Query keys of the practice feature. Only saved configurations are cached
 * server state; the running session is a client-owned snapshot (`sessionStore.ts`).
 */
export const practiceKeys = {
    /** Invalidation root of the saved-configuration list. */
    configs: ['practice', 'configs'] as const,
};
