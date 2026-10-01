const bcrypt = require('bcryptjs');
const { db }: typeof import('../src/db') = require('../src/db');
const { staffAccounts }: typeof import('../src/db/schema') = require('../src/db/schema');
const { isRole }: typeof import('./adminPermissions') = require('./adminPermissions');

// Longer than the learner minimum: staff can ban and delete accounts.
const MIN_STAFF_PASSWORD_LENGTH = 12;

// Same cost as the learner passwords.
const BCRYPT_ROUNDS = 10;

/**
 * Inserts a staff account. Used by scripts/create-staff.js today, and by the
 * staff-management page later (slice 8). Throws a plain Error with a message
 * safe to print; a duplicate email surfaces the Postgres unique violation.
 */
const createStaff = async (input: { email: string; name: string; password: string; role: string }) => {
    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid email');
    if (!name) throw new Error('Name is required');
    if (!isRole(input.role)) throw new Error('Invalid role');
    if (input.password.length < MIN_STAFF_PASSWORD_LENGTH) {
        throw new Error(`Password must be at least ${MIN_STAFF_PASSWORD_LENGTH} characters`);
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const [staff] = await db
        .insert(staffAccounts)
        .values({ email, name, passwordHash, role: input.role })
        .returning({ id: staffAccounts.id, email: staffAccounts.email, name: staffAccounts.name, role: staffAccounts.role });
    return staff;
};

export = { createStaff, MIN_STAFF_PASSWORD_LENGTH };
