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

// Demo access (.context/plans/demo-access.md D14): the landing page links to the app's /demo page.
describe('"Try the demo" link', () => {
    const html = read('index.html');

    it('goes to /demo in the app, through the link helper (data-app), with a working static href', () => {
        const link = html.match(/<a [^>]*data-app="\/demo"[^>]*>/);
        assert.ok(link, 'no data-app="/demo" link');
        assert.match(link[0], /href="https:\/\/app\.ladu\.com\.ar\/demo"/);
    });

    it('has a translated label in every language', () => {
        assert.match(html, /data-i18n="tryDemo"/);
        const app = read('app.js');
        for (const code of ['en', 'es', 'de', 'ee']) {
            assert.match(stringsOf(app, code), /\btryDemo: '[^']+'/, `${code} lacks tryDemo`);
        }
    });
});
