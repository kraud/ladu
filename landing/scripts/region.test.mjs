import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { describe, it } from 'node:test';

const landingDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(path.join(landingDir, 'region.js'), 'utf8');

/** Runs region.js against a fake `window` and returns what it published. */
const load = ({ hostname = 'ladu.com.ar', search = '', fetch } = {}) => {
    const window = { location: { hostname, search } };
    if (fetch !== undefined) window.fetch = fetch;
    vm.runInNewContext(source, { window });
    return window.LaduRegion;
};

const reply = (body, ok = true) => () => Promise.resolve({ ok, text: () => Promise.resolve(body) });

const EU = [
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE',
    'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
];

describe('needsNotice', () => {
    const { needsNotice } = load();

    it('is true for all 27 EU states', () => {
        assert.equal(EU.length, 27);
        for (const code of EU) assert.equal(needsNotice(code), true, code);
    });

    it('is true for the other EEA states and the UK', () => {
        for (const code of ['IS', 'LI', 'NO', 'GB']) assert.equal(needsNotice(code), true, code);
    });

    it('is false for countries outside those regions, Switzerland included', () => {
        for (const code of ['AR', 'US', 'BR', 'CH', 'JP', 'AU']) assert.equal(needsNotice(code), false, code);
    });

    it('accepts lower case and spaces', () => {
        assert.equal(needsNotice(' de\n'), true);
        assert.equal(needsNotice(' ar\n'), false);
    });

    it('fails safe: unknown, empty or invalid input shows the notice', () => {
        for (const bad of ['XX', 'xx', 'T1', '', ' ', 'DEU', 'D', '1A', null, undefined, 42, {}]) {
            assert.equal(needsNotice(bad), true, String(bad));
        }
    });
});

describe('check', () => {
    it('asks /region and answers by the country code', async () => {
        const urls = [];
        const fetch = (url, options) => {
            urls.push([url, options]);
            return reply('DE')();
        };
        assert.equal(await load({ fetch }).check(), true);
        assert.equal(urls.length, 1);
        assert.equal(urls[0][0], '/region');
        assert.equal(urls[0][1].cache, 'no-store');
        assert.equal(await load({ fetch: reply('AR') }).check(), false);
    });

    it('fails safe when the request fails, is not ok, or is empty', async () => {
        assert.equal(await load({ fetch: () => Promise.reject(new Error('offline')) }).check(), true);
        assert.equal(await load({ fetch: reply('AR', false) }).check(), true);
        assert.equal(await load({ fetch: reply('') }).check(), true);
    });

    it('shows the notice when the browser has no fetch', async () => {
        assert.equal(await load().check(), true);
    });

    it('reads ?region= only on a local address', async () => {
        const fetch = reply('DE');
        assert.equal(await load({ hostname: 'localhost', search: '?region=AR', fetch }).check(), false);
        assert.equal(await load({ hostname: 'ladu.localhost', search: '?x=1&region=DE', fetch: reply('AR') }).check(), true);
        assert.equal(await load({ hostname: 'ladu.com.ar', search: '?region=AR', fetch }).check(), true);
        assert.equal(await load({ hostname: 'localhost', search: '', fetch: reply('AR') }).check(), false);
    });
});
