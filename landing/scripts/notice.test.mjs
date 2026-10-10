import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const landingDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => readFileSync(path.join(landingDir, name), 'utf8');

/** The `{ ... }` text of one language inside STRINGS in app.js. */
const stringsOf = (source, code) => {
    const start = source.indexOf(`        ${code}: {`);
    assert.notEqual(start, -1, `no strings for ${code}`);
    return source.slice(start, source.indexOf('\n        },', start));
};

describe('storage notice texts', () => {
    const app = read('app.js');

    for (const code of ['en', 'es', 'de', 'ee']) {
        it(`${code} has the label, the text and the button`, () => {
            const block = stringsOf(app, code);
            for (const key of ['noticeLabel', 'noticeText', 'noticeOk']) {
                assert.match(block, new RegExp(`\\b${key}:`), `${code} lacks ${key}`);
            }
        });
    }
});

describe('storage notice scripts', () => {
    for (const page of ['index', 'privacy', 'terms', 'credits', 'impressum']) {
        it(`${page}.html loads region.js before app.js`, () => {
            const html = read(`${page}.html`);
            const region = html.indexOf('<script src="/region.js"></script>');
            const app = html.indexOf('<script src="/app.js"></script>');
            assert.notEqual(region, -1, 'region.js is not loaded');
            assert.ok(region < app, 'region.js must come before app.js');
        });
    }

    it('the Docker image copies region.js', () => {
        assert.match(read('Dockerfile'), /\bregion\.js\b/);
    });
});
