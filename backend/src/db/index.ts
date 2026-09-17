const { Pool } = require('pg');
const schema = require('./schema');
const dotenv = require('dotenv');
const path = require('path');

const { drizzle }: typeof import('drizzle-orm/node-postgres') = require('drizzle-orm/node-postgres');

// Capture the runtime-provided NODE_ENV *before* loading .env: the Jest setup
// sets NODE_ENV=test, and `override: true` below would otherwise let a NODE_ENV
// line in .env clobber it, pointing tests at the dev database.
const isTestEnv = process.env.NODE_ENV === 'test';

// Load .env from the project root (two levels up from backend/src/db/).
// `override: true` so a stale DATABASE_URL inherited from a parent process
// cannot redirect the backend to the wrong database.
dotenv.config({ path: path.resolve(__dirname, '../../../.env'), override: true });

// Determine which database URL to use based on the environment.
// In test mode (NODE_ENV=test) we always use the dedicated test database
// so tests never touch development or production data.
const connectionString = isTestEnv
    ? process.env.TEST_DATABASE_URL
    : process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error(
        `Database connection string is not set. ` +
        `Make sure ${isTestEnv ? 'TEST_DATABASE_URL' : 'DATABASE_URL'} is defined in your .env file ` +
        `and the Docker container is running (docker compose up -d).`
    );
}

// Create a connection pool. Pooling is essential for production workloads and
// also makes tests more efficient by reusing connections across test cases.
const pool = new Pool({ connectionString });

// Create the Drizzle ORM instance, passing the schema for the relational query API.
const db = drizzle(pool, { schema });

export = { pool, db };
