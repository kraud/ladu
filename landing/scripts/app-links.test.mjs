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

/** Every `<a ...>` start tag with this data-app path. */
const linksTo = (html, appPath) => html.match(new RegExp(`<a [^>]*data-app="${appPath}"[^>]*>`, 'g')) ?? [];

// The links from the landing site into the app's sign-in and registration pages.
describe('links into the app', () => {
    it('"Log in" goes to /login on every page with a header', () => {
        for (const page of ['index.html', 'terms.html', 'privacy.html', 'credits.html', 'impressum.html']) {
            const html = read(page);
            assert.doesNotMatch(html, /data-app=""/, `${page} has a link to the app root`);
            const links = linksTo(html, '/login');
            assert.ok(links.length > 0, `${page} has no data-app="/login" link`);
            for (const link of links) assert.match(link, /href="https:\/\/app\.ladu\.com\.ar\/login"/);
        }
    });

    it('"Create account" goes to /register, with a working static href', () => {
        const html = read('index.html');
        const [link] = linksTo(html, '/register');
        assert.ok(link, 'no data-app="/register" link');
        assert.match(link, /href="https:\/\/app\.ladu\.com\.ar\/register"/);
        assert.match(html, /data-i18n="createAccount"/);
    });

    it('the phone has "Already registered? Sign in"', () => {
        const html = read('index.html');
        assert.match(html, /class="m-signin"/);
        assert.match(html, /data-i18n="alreadyRegistered"/);
        assert.match(html, /<a data-app="\/login"[^>]*data-i18n="signIn"/);
    });

    it('has the new labels in every language, and no "Open" label', () => {
        const app = read('app.js');
        for (const code of ['en', 'es', 'de', 'ee', 'fr']) {
            const strings = stringsOf(app, code);
            for (const key of ['createAccount', 'alreadyRegistered', 'signIn']) {
                assert.match(strings, new RegExp(`\\b${key}: '[^']+'`), `${code} lacks ${key}`);
            }
            assert.doesNotMatch(strings, /\bopen: '/, `${code} still has open`);
        }
    });
});
