module.exports = {
    testEnvironment: 'node',
    roots: ['<rootDir>/tests'],
    setupFiles: ['<rootDir>/tests/setup.js'],

    // The suite uses ONE shared PostgreSQL test database, and clearDB() truncates
    // all tables between tests. Parallel workers would truncate tables while
    // other workers are mid-request (non-deterministic "jwt malformed"/401
    // failures). Run single-threaded: the database is the serialization point.
    maxWorkers: 1,

    // Match both existing JS tests and future TS tests
    testMatch: [
        '**/__tests__/**/*.{js,ts}',
        '**/?(*.)+(spec|test).{js,ts}',
    ],

    // Transform TypeScript files via ts-jest so backend TS source files
    // (controllers, db, schema, etc.) can be required from JS test files
    // without a separate compile step.
    transform: {
        '^.+\\.tsx?$': [
            'ts-jest',
            {
                // Point ts-jest at the backend tsconfig
                tsconfig: '<rootDir>/tsconfig.json',
                // Disable type-checking during tests for faster runs;
                // type errors are caught by the TS compiler during development.
                diagnostics: false,
            },
        ],
        // `jose` (oauth-login-strategy.md) ships ESM-only — no CJS build at
        // all, unlike drizzle-orm/@sentry below, which at least publish one
        // Jest's resolver just doesn't reach by default. Real Node (the dev/
        // prod server, via tsx/cjs's require(esm) support) loads it fine;
        // Jest's own module system doesn't understand `import` syntax without
        // an explicit transform. ts-jest can down-level it the same way it
        // does our own TS, with `allowJs` layered on the same tsconfig
        // (module: CommonJS) so the output matches what the rest of the
        // suite already expects.
        '/node_modules/jose/.*\\.js$': [
            'ts-jest',
            {
                tsconfig: { allowJs: true },
                diagnostics: false,
            },
        ],
    },
    // Escape jose from the default "ignore everything in node_modules" rule
    // so the transform above actually runs on it.
    transformIgnorePatterns: ['/node_modules/(?!jose/)'],

    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

    // drizzle-orm uses the "exports" field in its package.json with conditional
    // subpath resolution. Jest 27 does not fully respect the "require" condition
    // in the exports map, so subpath imports like 'drizzle-orm/pg-core' resolve
    // to the ESM (.js) file instead of the CJS (.cjs) file. These explicit
    // mappings ensure Jest loads the correct CJS version.
    // NB: npm workspaces hoist node_modules to the repo root, so the path is
    // one level above the backend workspace (where this config lives).
    moduleNameMapper: {
        '^drizzle-orm/pg-core$': '<rootDir>/../node_modules/drizzle-orm/pg-core/index.cjs',
        '^drizzle-orm/node-postgres$': '<rootDir>/../node_modules/drizzle-orm/node-postgres/index.cjs',
        '^drizzle-orm/node-postgres/migrator$': '<rootDir>/../node_modules/drizzle-orm/node-postgres/migrator.cjs',
    },

    // @sentry/node's tracing integrations eagerly require several
    // @sentry/server-utils subpaths (orchestrion, orchestrion/register, ...)
    // at module load time, and each one hits the same Jest exports-
    // resolution bug described above for drizzle-orm -- plain
    // `node -e "require.resolve(...)"` resolves every one of them fine;
    // Jest's resolver doesn't. A static moduleNameMapper entry per subpath
    // is a losing game (any @sentry/node version bump can add more), so
    // this delegates just that one package to Node's own resolution
    // algorithm (proven correct above) instead of Jest's.
    resolver: '<rootDir>/tests/sentryServerUtilsResolver.js',
};
