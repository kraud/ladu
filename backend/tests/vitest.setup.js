// Vitest-only setup (runs before tests/setup.js).
//
// The test files load the app with plain require(), which runs in Node and
// cannot read the TypeScript sources. tsx/cjs teaches require() to do it (the
// production server uses the same hook). Jest does not need this because
// ts-jest does the job, and Jest 27 cannot resolve 'tsx/cjs' anyway.
//
// TEMPORARY FILE: when Jest is removed, move these lines into setup.js.
require('tsx/cjs');
require('./setup');
