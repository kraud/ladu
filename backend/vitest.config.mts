import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // describe / it / expect / vi / beforeAll ... are global, like Jest.
        // tests/request.js also needs the global afterAll.
        globals: true,
        environment: 'node',
        include: ['tests/**/*.test.{js,ts}'],

        // Loads tsx/cjs (so plain require() can load the TypeScript sources),
        // sets the test env vars and defines global.signin.
        setupFiles: ['tests/setup.js'],

        // The suite uses ONE shared PostgreSQL test database, and clearDB()
        // truncates all tables between tests. Parallel files would truncate
        // tables while other files are mid-request. One file at a time: the
        // database is the serialization point.
        fileParallelism: false,

        // clearDB() truncates ~25 tables per test. On a slow CI runner that can
        // pass the 5 s default, and the timed-out hook leaves its query running.
        testTimeout: 30000,
        hookTimeout: 30000,

        coverage: {
            provider: 'v8',
            include: ['controllers/**', 'lib/**', 'middleware/**', 'routes/**', 'services/**', 'utils/**', 'src/**'],
        },
    },
});
