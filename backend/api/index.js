// Polyfill SlowBuffer for Node.js 24+ compatibility
const buffer = require('buffer');
if (!buffer.SlowBuffer) {
    buffer.SlowBuffer = buffer.Buffer;
}

// Register tsx (TypeScript runtime) so .ts files can be required.
// We register the CJS hook so that routes loading controllers via
// require('../controllers/fooController.ts') work transparently.
require('tsx/cjs');

const colors = require('colors');
const path = require('path');
// Load the repo-root .env regardless of the cwd this process was launched from.
// In production, env vars are injected directly (Docker Compose env file);
// there is no repo-root .env to load.
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), override: true });
}

// Must run before `require('../app')` — Sentry's Express integration only
// auto-instruments express/http if it's already initialized when those
// modules are first required. Gated on SENTRY_DSN actually being set,
// rather than calling init() with dsn: undefined and trusting that to be
// inert — init() patches Node's http/https modules for its default
// integrations regardless of whether a DSN is configured, which is exactly
// the kind of global side effect the test suite (SENTRY_DSN unset) doesn't
// want. Sentry.captureException() elsewhere (setupExpressErrorHandler in
// app.js) is a documented no-op when the SDK was never initialized, so
// skipping init() entirely here is safe.
const Sentry = require('@sentry/node');
if (process.env.SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.ENVIRONMENT || 'development',
        release: process.env.GIT_SHA,
    });
}

const app = require('../app');
const port = process.env.PORT || 5001;

// ─────────────────────────────────────────────────────────────────────────────
// PostgreSQL connection (replaces legacy MongoDB connectDB)
// ─────────────────────────────────────────────────────────────────────────────
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('DATABASE_URL environment variable is not set.'.red.bold);
    process.exit(1);
}

const startServer = async () => {
    const pool = new Pool({ connectionString });

    // Verify the database is reachable. Migrations are applied separately,
    // before this process starts — see backend/scripts/migrate.js.
    await pool.query('SELECT 1');

    console.log(`PostgreSQL connected`.cyan.underline);

    // Share the pool with the rest of the app.
    // Controllers import `db` / `pool` from ../src/db which creates its own
    // pool; both point at the same database so the two pools are independent
    // but that is acceptable for development. In production a single shared
    // pool can be injected via app.locals.
    app.locals.pgPool = pool;

    app.listen(port, () => {
        console.log(`Server started on port ${port}`);
    });
};

startServer().catch((err) => {
    console.error('Failed to start server:'.red.bold, err.message || err);
    process.exit(1);
});
