const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const { db }: typeof import('../../src/db') = require('../../src/db');
const { staffAccounts, auditLog }: typeof import('../../src/db/schema') = require('../../src/db/schema');
const { eq }: typeof import('drizzle-orm') = require('drizzle-orm');
const { generateStaffToken }: typeof import('../../middleware/staffAuth') = require('../../middleware/staffAuth');
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
    const token = generateStaffToken(staff.id, res);

    await db.update(staffAccounts).set({ lastLoginAt: new Date() }).where(eq(staffAccounts.id, staff.id));
    await db.insert(auditLog).values({
        staffId: staff.id,
        action: 'staff.login',
        targetType: 'staff',
        targetId: staff.id,
        metadata: { country: countryFromRequest(req) },
    });

    res.json({ id: staff.id, email: staff.email, name: staff.name, role: staff.role, token });
});

/** `GET /api/admin/auth/me` — used by the admin UI to check a saved session. */
const me = (req: any, res: any) => {
    res.json(req.staff);
};

export = { login, me };
