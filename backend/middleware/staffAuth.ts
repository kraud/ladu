const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const { db }: typeof import('../src/db') = require('../src/db');
const { staffAccounts }: typeof import('../src/db/schema') = require('../src/db/schema');
const { eq }: typeof import('drizzle-orm') = require('drizzle-orm');
const { hasPermission }: typeof import('../lib/adminPermissions') = require('../lib/adminPermissions');
import type { Permission } from '../lib/adminPermissions';

// A short session, unlike the 30-day learner token (admin-dashboard.md §2).
const STAFF_TOKEN_TTL = '8h';
const STAFF_AUDIENCE = 'admin';

// Read lazily, not at start-up: the secret only exists in the deploy
// environments from slice 7, and the server must still boot without it.
// The error handler reads `res.statusCode`, so the 503 is set on `res`.
const staffSecret = (res: any): string => {
    const secret = process.env.ADMIN_JWT_SECRET;
    if (!secret) {
        res.status(503);
        throw new Error('Admin API is not configured');
    }
    return secret;
};

// `tv` is `staff_accounts.token_version`: requireStaff refuses a token whose
// version is older than the row's (a password change, a reset or a disable).
export const generateStaffToken = (staffId: string, tokenVersion: number, res: any): string =>
    jwt.sign({ id: staffId, tv: tokenVersion }, staffSecret(res), { expiresIn: STAFF_TOKEN_TTL, audience: STAFF_AUDIENCE });

// Columns put on `req.staff`. The password hash is never loaded.
const staffColumns = {
    id: staffAccounts.id,
    email: staffAccounts.email,
    name: staffAccounts.name,
    role: staffAccounts.role,
    disabledAt: staffAccounts.disabledAt,
    mustChangePassword: staffAccounts.mustChangePassword,
    tokenVersion: staffAccounts.tokenVersion,
};

export const PASSWORD_CHANGE_REQUIRED = 'password_change_required';

export interface RequireStaffOptions {
    /**
     * Let a person who still has a temporary password through. Only `me` and
     * `change-password` set this; every other route refuses them (403).
     */
    allowMustChangePassword?: boolean;
}

/**
 * Guards an admin route. Pass a permission to also require it; omit it for a
 * route any signed-in staff member may call (`/auth/me`).
 *
 * A learner token is signed with JWT_SECRET and has no audience, so it fails
 * here twice: wrong secret, wrong `aud`. The staff row is loaded on every
 * request, so disabling an account or changing its role takes effect at once.
 */
export const requireStaff = (permission?: Permission, options: RequireStaffOptions = {}) =>
    asyncHandler(async (req: any, res: any, next: any) => {
        const header = req.headers.authorization;
        if (!header || !header.startsWith('Bearer ')) {
            res.status(401);
            throw new Error('Not authorized (missing token)');
        }

        const secret = staffSecret(res);
        let decoded: { id?: string; tv?: number };
        try {
            decoded = jwt.verify(header.split(' ')[1], secret, {
                algorithms: ['HS256'],
                audience: STAFF_AUDIENCE,
            });
        } catch {
            res.status(401);
            throw new Error('Not authorized');
        }

        const [staff] = decoded.id
            ? await db.select(staffColumns).from(staffAccounts).where(eq(staffAccounts.id, decoded.id)).limit(1)
            : [];
        // A token from before `tv` existed counts as version 0.
        if (!staff || staff.disabledAt || (decoded.tv ?? 0) !== staff.tokenVersion) {
            res.status(401);
            throw new Error('Not authorized');
        }

        // The temporary-password rule comes before the permission rule, so the UI
        // always learns about it first, whatever the person tried to open.
        if (staff.mustChangePassword && !options.allowMustChangePassword) {
            res.status(403);
            throw Object.assign(new Error('You must change your temporary password first'), {
                apiCode: PASSWORD_CHANGE_REQUIRED,
            });
        }

        if (permission && !hasPermission(staff.role, permission)) {
            res.status(403);
            throw new Error('Forbidden');
        }

        const { disabledAt, tokenVersion, ...publicStaff } = staff;
        req.staff = publicStaff;
        next();
    });

