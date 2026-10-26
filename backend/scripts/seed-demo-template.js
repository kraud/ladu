// Seeds the demo template (.context/plans/demo-access.md, Slice 2): the user row that every demo
// start copies, built from scripts/demo-template/data.json. Without it, POST /api/demo answers
// 503 demo_unavailable.
//
// Safe to run again: an existing template is kept. `--reset` deletes it and builds it again from
// the data file (do this after a change to data.json). Running demos are copies: not touched.
//
//   local:      npm run demo:template -w backend            (add -- --reset to rebuild)
//   container:  docker exec backend-prod node scripts/seed-demo-template.js [--reset]

// Polyfill SlowBuffer for Node.js 24+ compatibility (same as api/index.js).
const buffer = require('buffer');
if (!buffer.SlowBuffer) {
    buffer.SlowBuffer = buffer.Buffer;
}

require('tsx/cjs');

const path = require('path');
// In production, env vars come from the container; there is no .env to load.
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), override: !process.env.LADU_KEEP_PROCESS_ENV });
}

const { pool } = require('../src/db');
const { seedDemoTemplate } = require('../lib/demoTemplate');

const reset = process.argv.includes('--reset');

seedDemoTemplate({ reset })
    .then(({ created, words, tags }) => {
        console.log(
            created
                ? `${new Date().toISOString()} demo template ${reset ? 'rebuilt' : 'created'}: ${words} word(s), ${tags} tag(s)`
                : `${new Date().toISOString()} demo template already there (${words} word(s), ${tags} tag(s)); --reset rebuilds it`,
        );
    })
    .catch((err) => {
        console.error(`${new Date().toISOString()} demo template failed:`, err.message || err);
        if (err.cause) console.error('Caused by:', err.cause.message || err.cause);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
