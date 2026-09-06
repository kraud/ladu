const { Pool } = require('pg');
const schema = require('./schema');
const dotenv = require('dotenv');
const path = require('path');

const { drizzle }: typeof import('drizzle-orm/node-postgres') = require('drizzle-orm/node-postgres');

// Load .env from the project root (two levels up from backend/src/db/)
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Determine which database URL to use based on the environment.
// In test mode (NODE_ENV=test) we always use the dedicated test database
// so tests never touch development or production data.
const connectionString =
    process.env.NODE_ENV === 'test'
        ? process.env.TEST_DATABASE_URL
        : process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error(
        `Database connection string is not set. ` +
        `Make sure ${process.env.NODE_ENV === 'test' ? 'TEST_DATABASE_URL' : 'DATABASE_URL'} is defined in your .env file ` +
        `and the Docker container is running (docker compose up -d).`
    );
}

// Create a connection pool. Pooling is essential for production workloads and
// also makes tests more efficient by reusing connections across test cases.
const pool = new Pool({ connectionString });

// Create the Drizzle ORM instance, passing the schema for the relational query API.
const db = drizzle(pool, { schema });

module.exports = { pool, db };
