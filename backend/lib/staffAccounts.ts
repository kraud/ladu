const bcrypt = require('bcryptjs');
const { db }: typeof import('../src/db') = require('../src/db');
const { staffAccounts }: typeof import('../src/db/schema') = require('../src/db/schema');
const { isRole }: typeof import('./adminPermissions') = require('./adminPermissions');

// Longer than the learner minimum: staff can ban and delete accounts.
const MIN_STAFF_PASSWORD_LENGTH = 12;
// bcrypt only reads the first 72 bytes. A longer password would be cut without a
// word, so it is refused instead.
const MAX_STAFF_PASSWORD_BYTES = 72;

// Same cost as the learner passwords.
const BCRYPT_ROUNDS = 10;

/** Throws a message that is safe to show if the password is not allowed. */
const validateStaffPassword = (password: unknown): string => {
    if (typeof password !== 'string') throw new Error('Password is required');
    if (password.length < MIN_STAFF_PASSWORD_LENGTH) {
        throw new Error(`Password must be at least ${MIN_STAFF_PASSWORD_LENGTH} characters`);
    }
    if (Buffer.byteLength(password, 'utf8') > MAX_STAFF_PASSWORD_BYTES) {
        throw new Error(`Password must be at most ${MAX_STAFF_PASSWORD_BYTES} bytes`);
    }
    return password;
};

const hashStaffPassword = (password: string) => bcrypt.hash(password, BCRYPT_ROUNDS);

/**
 * Inserts a staff account. Used by scripts/create-staff.js (the first owner,
 * who chose their own password in the terminal) and by the staff page (a
 * temporary password: `mustChangePassword`). Throws a plain Error with a
 * message safe to print; a duplicate email surfaces the Postgres unique
 * violation.
 */
const createStaff = async (
    input: {
        email: string;
        name: string;
        password: string;
        role: string;
        mustChangePassword?: boolean;
    },
    // The staff page passes its transaction, so the account and its audit row
    // are saved together.
    executor: Pick<typeof db, 'insert'> = db,
) => {
    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid email');
    if (!name) throw new Error('Name is required');
    if (!isRole(input.role)) throw new Error('Invalid role');
    validateStaffPassword(input.password);

    const passwordHash = await hashStaffPassword(input.password);
    const [staff] = await executor
        .insert(staffAccounts)
        .values({ email, name, passwordHash, role: input.role, mustChangePassword: input.mustChangePassword ?? false })
        .returning({ id: staffAccounts.id, email: staffAccounts.email, name: staffAccounts.name, role: staffAccounts.role });
    return staff;
};

export = { createStaff, validateStaffPassword, hashStaffPassword, MIN_STAFF_PASSWORD_LENGTH, MAX_STAFF_PASSWORD_BYTES };
