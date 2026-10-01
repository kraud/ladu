/**
 * Staff roles and their permissions (admin-dashboard.md §2). Fixed in code, so
 * a role change is a code review, and there is no permission editor. Routes
 * only ask `hasPermission(role, 'users.ban')`, so this map can move to DB
 * tables later without touching a route.
 */
export const PERMISSIONS = [
  "users.read",
  "users.ban",
  "users.delete",
  // "Purge now": deletes an account for good, before the 30-day grace ends.
  // Owner only, because nothing can undo it.
  "users.purge",
  "health.read",
  "audit.read",
  "staff.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS = {
  owner: [...PERMISSIONS],
  admin: ["users.read", "users.ban", "users.delete", "health.read", "audit.read"],
  support: ["users.read", "users.ban", "health.read"],
  viewer: ["users.read", "health.read"],
} as const satisfies Record<string, readonly Permission[]>;

export type Role = keyof typeof ROLE_PERMISSIONS;

export const ROLES = Object.keys(ROLE_PERMISSIONS) as Role[];

export const isRole = (value: unknown): value is Role =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(ROLE_PERMISSIONS, value);

/** Every permission of a role; the admin UI uses this to show only the buttons a person may use. */
export const permissionsFor = (role: string): Permission[] =>
  isRole(role) ? [...ROLE_PERMISSIONS[role]] : [];

/** An unknown role (for example a row edited by hand) has no permissions. */
export const hasPermission = (role: string, permission: Permission): boolean =>
  isRole(role) && (ROLE_PERMISSIONS[role] as readonly Permission[]).includes(permission);
