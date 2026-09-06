import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from the root .env file.
// Using path.resolve ensures this works whether invoked from
// the repo root (via npm run db:studio) or from the backend/ directory.
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectionString =
    process.env.NODE_ENV === 'test'
        ? process.env.TEST_DATABASE_URL
        : process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error(
        `${process.env.NODE_ENV === 'test' ? 'TEST_DATABASE_URL' : 'DATABASE_URL'} environment variable is not set. ` +
        'Make sure the .env file exists and the Docker container is running.'
    );
}

export default defineConfig({
    // Absolute path to the Drizzle schema file
    schema: path.resolve(__dirname, './src/db/schema.ts'),

    // Absolute path to the directory where generated SQL migration files will be stored
    out: path.resolve(__dirname, './src/db/migrations'),

    // Use the PostgreSQL dialect
    dialect: 'postgresql',

    dbCredentials: {
        // Uses TEST_DATABASE_URL when NODE_ENV=test, otherwise DATABASE_URL.
        url: connectionString,
    },

    // Enable verbose logging during migrations for easier debugging
    verbose: true,
});
