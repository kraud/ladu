/**
 * Test database helper — PostgreSQL version
 *
 * Replaces the old mongodb-memory-server-based db.js.
 *
 * This module is imported by every integration test file and provides three
 * lifecycle helpers that Jest calls in beforeAll / beforeEach / afterAll:
 *
 *   connectDB()  — verifies that the test database is reachable and that all
 *                  migrations have been applied.
 *   clearDB()    — deletes all rows from every table between tests so each
 *                  test starts from a clean slate (equivalent to the old
 *                  collection.deleteMany({})).
 *   closeDB()    — closes the connection pool after all tests in the file
 *                  have run.
 *
 * The test database (keelapp_test) is kept completely separate from the dev
 * database (keelapp_dev). It is created by init-test-db.sh, and pending
 * Drizzle migrations are applied automatically in connectDB().
 */

const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const { migrate } = require('drizzle-orm/node-postgres/migrator');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Resolve the test database URL — must be set in .env
const connectionString = process.env.TEST_DATABASE_URL;
const migrationsFolder = path.resolve(__dirname, '../src/db/migrations');

if (!connectionString) {
    throw new Error(
        'TEST_DATABASE_URL is not set. Make sure .env contains TEST_DATABASE_URL ' +
        'and the Docker container is running (docker compose up -d).'
    );
}

// Shared pool instance used by all lifecycle functions within a test run
let pool;

/**
 * Applies pending migrations to the test database before tests run.
 * The advisory lock prevents parallel Jest workers from trying to migrate the
 * same database at the same time.
 */
const applyMigrations = async () => {
    const client = await pool.connect();
    let lockAcquired = false;

    try {
        await client.query("SELECT pg_advisory_lock(hashtext('keelapp_test_migrations')::bigint)");
        lockAcquired = true;
        await migrate(drizzle(client), { migrationsFolder });
    } finally {
        if (lockAcquired) {
            await client.query("SELECT pg_advisory_unlock(hashtext('keelapp_test_migrations')::bigint)");
        }
        client.release();
    }
};

/**
 * connectDB
 * Called in `beforeAll()` in each test file.
 * Verifies the test database connection and applies pending migrations.
 */
const connectDB = async () => {
    pool = new Pool({ connectionString });

    // Verify connectivity with a lightweight query
    await pool.query('SELECT 1');

    await applyMigrations();

    // Confirm the schema has been migrated (users table must exist)
    const tableCheck = await pool.query(`
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'users'
        ) AS "exists"
    `);

    if (!tableCheck.rows[0].exists) {
        throw new Error(
            'Database schema is not initialized. Check the Drizzle migrations in backend/src/db/migrations.'
        );
    }
};

/**
 * clearDB
 * Called in `beforeEach()` in each test file.
 * Truncates all application tables in the correct order (respecting FK constraints
 * by using CASCADE). This is equivalent to the old Mongoose collection.deleteMany().
 */
const clearDB = async () => {
    if (!pool) return;

    // Truncate in a single statement using CASCADE to handle foreign key order.
    // RESTART IDENTITY resets sequences (not used here since we use UUIDs,
    // but good practice for future serial columns if any are added).
    await pool.query(`
        TRUNCATE TABLE
            exercise_performance_cases,
            exercise_performances,
            friendship_partnerships,
            friendships,
            notifications,
            tag_words,
            user_following_tags,
            translation_cases,
            translations,
            tokens,
            words,
            tags,
            users
        RESTART IDENTITY CASCADE
    `);
};

/**
 * closeDB
 * Called in `afterAll()` in each test file.
 * Drains and closes the connection pool to prevent Jest from hanging.
 */
const closeDB = async () => {
    if (pool) {
        await pool.end();
        pool = null;
    }
};

module.exports = { connectDB, clearDB, closeDB };
