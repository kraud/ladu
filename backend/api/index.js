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
const dotenv = require('dotenv').config();
const path = require('path');
const app = require('../app');
const port = process.env.PORT || 5001;

// ─────────────────────────────────────────────────────────────────────────────
// PostgreSQL connection & migration (replaces legacy MongoDB connectDB)
// ─────────────────────────────────────────────────────────────────────────────
const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const { migrate } = require('drizzle-orm/node-postgres/migrator');

const connectionString = process.env.DATABASE_URL;
const migrationsFolder = path.resolve(__dirname, '../src/db/migrations');

if (!connectionString) {
    console.error('DATABASE_URL environment variable is not set.'.red.bold);
    process.exit(1);
}

const startServer = async () => {
    const pool = new Pool({ connectionString });

    // Verify the database is reachable
    await pool.query('SELECT 1');

    // Apply any pending Drizzle migrations so the schema is always up to date.
    // This is the same pattern used in backend/tests/db.js.
    await migrate(drizzle(pool), { migrationsFolder });

    console.log(`PostgreSQL connected — migrations applied`.cyan.underline);

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
