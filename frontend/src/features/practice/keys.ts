/**
 * Query keys of the practice feature. Saved configurations and saved sessions are
 * the cached server state; the running session is a client-owned snapshot (`sessionStore.ts`).
 */
export const practiceKeys = {
    /** Invalidation root of the saved-configuration list. */
    configs: ['practice', 'configs'] as const,
    /** Invalidation root of the saved-session list. */
    sessions: ['practice', 'sessions'] as const,
};
