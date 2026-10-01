// Creates a staff account for the admin dashboard (admin-dashboard.md §2).
// This is how the first `owner` is made: nobody can log in to the admin API
// until one staff account exists.
//
//   node scripts/create-staff.js <email> "<name>" [role]     (role defaults to owner)
//
// In production, run it inside the backend container, with a terminal (-it) so
// the password prompt is hidden and never lands in shell history:
//   docker compose exec -it backend-prod node scripts/create-staff.js you@example.com "Your Name"
// Without a terminal (a pipe), the password is read from the first line of stdin.

// Polyfill SlowBuffer for Node.js 24+ compatibility (same as api/index.js).
const buffer = require('buffer');
if (!buffer.SlowBuffer) {
    buffer.SlowBuffer = buffer.Buffer;
}

require('tsx/cjs');

const path = require('path');
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), override: true });
}

const readline = require('readline');

// Asks one question. On a terminal, typed characters are not echoed.
const ask = (question, { hidden = false } = {}) =>
    new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
        if (hidden && process.stdin.isTTY) {
            rl._writeToOutput = (text) => {
                // Print the prompt itself, but none of the typed characters.
                if (text.startsWith(question)) process.stdout.write(question);
            };
        }
        rl.question(question, (answer) => {
            rl.close();
            if (hidden && process.stdin.isTTY) process.stdout.write('\n');
            resolve(answer);
        });
    });

const run = async () => {
    const [email, name, role = 'owner'] = process.argv.slice(2);
    if (!email || !name) {
        console.error('Usage: node scripts/create-staff.js <email> "<name>" [owner|admin|support|viewer]');
        process.exit(1);
    }

    const { pool } = require('../src/db');
    const { createStaff } = require('../lib/staffAccounts');

    try {
        const password = await ask('Password (min 12 characters): ', { hidden: true });
        if (process.stdin.isTTY) {
            const again = await ask('Repeat password: ', { hidden: true });
            if (again !== password) throw new Error('Passwords do not match');
        }

        const staff = await createStaff({ email, name, password, role });
        console.log(`Created ${staff.role} account for ${staff.email} (id ${staff.id})`);
    } finally {
        await pool.end();
    }
};

run().catch((err) => {
    // A duplicate email is the only expected database error.
    const duplicate = (err.cause && err.cause.code) === '23505';
    console.error('Failed:', duplicate ? 'a staff account with this email already exists' : err.message || err);
    process.exit(1);
});
