// Nightly maintenance (admin-dashboard.md §3): hard-deletes accounts that were
// soft-deleted more than 30 days ago, and deletes login history older than 90
// days. Each purged account writes one `user.purge` audit row (actor: system).
//
// A host cron job runs it, installed by the Ansible `purge` role:
//   docker exec backend-prod node scripts/purge.js
// It is not scheduled inside the backend on purpose (no scheduler to keep alive,
// and no double run if the backend is ever scaled to two containers).

// Polyfill SlowBuffer for Node.js 24+ compatibility (same as api/index.js).
const buffer = require('buffer');
if (!buffer.SlowBuffer) {
    buffer.SlowBuffer = buffer.Buffer;
}

require('tsx/cjs');

const path = require('path');
// In production, env vars come from the container; there is no .env to load.
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), override: true });
}

const { pool } = require('../src/db');
const { runPurge } = require('../lib/userPurge');

runPurge()
    .then(({ purgedUsers, deletedLoginEvents }) => {
        console.log(`${new Date().toISOString()} purge ok: ${purgedUsers} account(s), ${deletedLoginEvents} login event(s)`);
    })
    .catch((err) => {
        console.error(`${new Date().toISOString()} purge failed:`, err.message || err);
        if (err.cause) console.error('Caused by:', err.cause.message || err.cause);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
