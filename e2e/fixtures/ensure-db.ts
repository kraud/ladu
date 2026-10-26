/**
 * Creates the e2e database when it is missing. Runs first in the backend `webServer` command
 * (`playwright.config.ts`), before the migrations. When the database is there (CI creates it with the
 * Postgres service), nothing changes.
 */
import pg from 'pg';
import { e2eDatabaseName, e2eDatabaseUrl } from './env';

async function main(): Promise<void> {
    const url = e2eDatabaseUrl();
    const name = e2eDatabaseName(url);
    // An identifier cannot be a query parameter, so check it before it goes into CREATE DATABASE.
    if (!/^[a-z0-9_]+$/.test(name)) throw new Error(`Unsafe database name "${name}".`);

    // The maintenance database `postgres` exists on every server.
    const admin = new URL(url);
    admin.pathname = '/postgres';
    const client = new pg.Client({ connectionString: admin.toString() });
    await client.connect();
    try {
        const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
        if (rowCount === 0) {
            await client.query(`CREATE DATABASE "${name}"`);
            console.log(`[e2e] created the database ${name}`);
        }
    } finally {
        await client.end();
    }
}

main().catch((error) => {
    console.error('[e2e] could not prepare the e2e database:', (error as Error).message);
    process.exit(1);
});
