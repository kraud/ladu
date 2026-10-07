/**
 * The badge types staff can grant, with the name shown on screen. This mirrors
 * `BADGE_TYPES` in backend/lib/badges.ts. The server is the source of truth: it
 * answers 400 for a type it does not know, so a stale list here cannot do harm.
 * A new type is one more line here and one in the backend.
 */
export const BADGE_LABELS: Record<string, string> = {
    official: 'Official',
};

export const GRANTABLE_BADGE_TYPES = Object.keys(BADGE_LABELS);

/** A type this list does not know (a newer server) shows as its raw name. */
export const badgeLabel = (type: string): string => BADGE_LABELS[type] ?? type;
