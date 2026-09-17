// Applies pending Drizzle migrations against DATABASE_URL, then exits.
//
// Used before the backend process starts — by the e2e webServer
// (e2e/playwright.config.ts) and, in production, as a separate deploy step
// run before the container swap (see .dev-context/deployment-strategy.md §3):
//   docker compose run --rm backend node scripts/migrate.js

const path = require('path');

// In production, env vars are injected directly (Docker Compose env file);
// there is no repo-root .env to load.
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), override: true });
}

const colors = require('colors');
const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const { migrate } = require('drizzle-orm/node-postgres/migrator');

const connectionString = process.env.DATABASE_URL;
const migrationsFolder = path.resolve(__dirname, '../src/db/migrations');

if (!connectionString) {
    console.error('DATABASE_URL environment variable is not set.'.red.bold);
    process.exit(1);
}

const run = async () => {
    const pool = new Pool({ connectionString });

    try {
        await pool.query('SELECT 1');
        await migrate(drizzle(pool), { migrationsFolder });
        console.log('Migrations applied'.cyan.underline);
    } finally {
        await pool.end();
    }
};

run().catch((err) => {
    console.error('Migration failed:'.red.bold, err.message || err);
    process.exit(1);
});
