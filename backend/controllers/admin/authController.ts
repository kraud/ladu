const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const { db }: typeof import('../../src/db') = require('../../src/db');
const { staffAccounts, auditLog }: typeof import('../../src/db/schema') = require('../../src/db/schema');
const { eq, sql }: typeof import('drizzle-orm') = require('drizzle-orm');
const { generateStaffToken }: typeof import('../../middleware/staffAuth') = require('../../middleware/staffAuth');
const { validateStaffPassword, hashStaffPassword }: typeof import('../../lib/staffAccounts') = require('../../lib/staffAccounts');
const { permissionsFor }: typeof import('../../lib/adminPermissions') = require('../../lib/adminPermissions');
const { countryFromRequest }: typeof import('../../lib/accountAccess') = require('../../lib/accountAccess');

// A valid hash of a random string. An unknown email is compared against it, so
// the response time does not show whether the email belongs to a staff member.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

/** `POST /api/admin/auth/login` */
const login = asyncHandler(async (req: any, res: any) => {
    const { email, password } = req.body ?? {};

    const [staff] =
        typeof email === 'string'
            ? await db
                  .select()
                  .from(staffAccounts)
                  .where(eq(staffAccounts.email, email.trim().toLowerCase()))
                  .limit(1)
            : [];

    const passwordOk = await bcrypt.compare(
        typeof password === 'string' ? password : '',
        staff ? staff.passwordHash : DUMMY_HASH,
    );

    // One message for an unknown email, a wrong password and a disabled account.
    if (!staff || !passwordOk || staff.disabledAt) {
        res.status(400);
        throw new Error('Invalid credentials');
    }

    // Signed before any write, so a missing secret (503) leaves no login trace.
    const token = generateStaffToken(staff.id, staff.tokenVersion, res);

    await db.update(staffAccounts).set({ lastLoginAt: new Date() }).where(eq(staffAccounts.id, staff.id));
    await db.insert(auditLog).values({
        staffId: staff.id,
        action: 'staff.login',
        targetType: 'staff',
        targetId: staff.id,
        metadata: { country: countryFromRequest(req) },
    });

    res.json({
        id: staff.id,
        email: staff.email,
        name: staff.name,
        role: staff.role,
        permissions: permissionsFor(staff.role),
        mustChangePassword: staff.mustChangePassword,
        // "staging"/"prod" from the container, or "local" in development. The admin UI
        // uses it to mark which environment it is signed in to (the header icon).
        environment: process.env.ENVIRONMENT ?? 'local',
        token,
    });
});

/**
 * `GET /api/admin/auth/me` — used by the admin UI to check a saved session.
 * `permissions` lets the UI show only the buttons a person may use; the server
 * still checks every request.
 */
const me = (req: any, res: any) => {
    res.json({ ...req.staff, permissions: permissionsFor(req.staff.role), environment: process.env.ENVIRONMENT ?? 'local' });
};

/**
 * `POST /api/admin/auth/change-password`: a staff member sets their own password.
 * It is also the way out of a temporary password. Every older token stops
 * working (`token_version` goes up), and the answer carries a new token, so
 * the person stays signed in on this device and nowhere else.
 */
const changePassword = asyncHandler(async (req: any, res: any) => {
    const { currentPassword, newPassword } = req.body ?? {};

    let validated: string;
    try {
        validated = validateStaffPassword(newPassword);
    } catch (error: any) {
        res.status(400);
        throw error;
    }

    const [staff] = await db.select().from(staffAccounts).where(eq(staffAccounts.id, req.staff.id)).limit(1);
    if (!staff) {
        res.status(401);
        throw new Error('Not authorized');
    }

    // The current password is asked again, so a stolen open session cannot lock the owner out.
    const currentOk = await bcrypt.compare(typeof currentPassword === 'string' ? currentPassword : '', staff.passwordHash);
    if (!currentOk) {
        res.status(400);
        throw new Error('The current password is not correct');
    }
    if (validated === currentPassword) {
        res.status(400);
        throw new Error('The new password must be different from the current one');
    }

    const passwordHash = await hashStaffPassword(validated);
    const now = new Date();
    const updated = await db.transaction(async (tx) => {
        const [row] = await tx
            .update(staffAccounts)
            .set({
                passwordHash,
                mustChangePassword: false,
                passwordChangedAt: now,
                tokenVersion: sql`${staffAccounts.tokenVersion} + 1`,
                updatedAt: now,
            })
            .where(eq(staffAccounts.id, staff.id))
            .returning({ tokenVersion: staffAccounts.tokenVersion });
        await tx.insert(auditLog).values({
            staffId: staff.id,
            action: 'staff.password_change',
            targetType: 'staff',
            targetId: staff.id,
            // Never the password itself, only that it happened and why it was needed.
            metadata: { email: staff.email, wasTemporary: staff.mustChangePassword },
        });
        return row;
    });

    res.json({
        id: staff.id,
        email: staff.email,
        name: staff.name,
        role: staff.role,
        permissions: permissionsFor(staff.role),
        mustChangePassword: false,
        environment: process.env.ENVIRONMENT ?? 'local',
        token: generateStaffToken(staff.id, updated.tokenVersion, res),
    });
});

export = { login, me, changePassword };
