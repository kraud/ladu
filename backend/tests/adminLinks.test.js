// The private "More detail in other tools" links (lib/adminLinks.ts). Every
// address below is fake: the real ones must never be in the repository.
const { loadAdminLinks } = require('../lib/adminLinks');

const json = (value) => JSON.stringify(value);
const link = (overrides = {}) => ({ label: 'Sentry', description: 'Errors', href: 'https://example.test/sentry', ...overrides });

describe('loadAdminLinks', () => {
    beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
    afterEach(() => jest.restoreAllMocks());

    it('is "not_set" for a missing, empty or blank value, with no warning', () => {
        for (const raw of [undefined, '', '   ']) {
            expect(loadAdminLinks(raw)).toEqual({ status: 'not_set', links: [] });
        }
        expect(console.warn).not.toHaveBeenCalled();
    });

    it('reads a list of links, and fills in a missing description', () => {
        const result = loadAdminLinks(json([link(), { label: 'Plain', href: 'https://example.test/plain' }]));

        expect(result.status).toBe('configured');
        expect(result.links).toEqual([
            { label: 'Sentry', description: 'Errors', href: 'https://example.test/sentry' },
            { label: 'Plain', description: '', href: 'https://example.test/plain' },
        ]);
    });

    it('keeps the query and the fragment of an address, and trims the text', () => {
        const href = 'https://example.test/issues/?project=12&query=is%3Aunresolved&x=a=b#top';

        const { links } = loadAdminLinks(json([link({ label: '  Spaced  ', description: ' d ', href })]));

        expect(links[0]).toEqual({ label: 'Spaced', description: 'd', href });
    });

    it('drops fields it does not know, so nothing unexpected reaches the page', () => {
        const { links } = loadAdminLinks(json([{ ...link(), onClick: 'alert(1)', target: '_self' }]));

        expect(Object.keys(links[0]).sort()).toEqual(['description', 'href', 'label']);
    });

    it('ignores surrounding whitespace around the whole value', () => {
        expect(loadAdminLinks(`  ${json([link()])}\n`).status).toBe('configured');
    });

    describe('is "invalid" (all or nothing) for', () => {
        const cases = {
            'text that is not JSON': 'not json',
            'JSON over several lines that was cut': '[{"label":"A",',
            'single quotes instead of double quotes': "[{'label':'A','href':'https://example.test'}]",
            'an object instead of a list': json(link()),
            'an empty list': '[]',
            'a list with a non-object entry': json([link(), 'https://example.test']),
            'a null entry': json([link(), null]),
            'a nested list': json([[link()]]),
            'a missing label': json([{ href: 'https://example.test' }]),
            'a blank label': json([link({ label: '   ' })]),
            'a label that is not text': json([link({ label: 5 })]),
            'a label over 60 characters': json([link({ label: 'x'.repeat(61) })]),
            'a description that is not text': json([link({ description: 5 })]),
            'a description over 120 characters': json([link({ description: 'x'.repeat(121) })]),
            'a missing href': json([{ label: 'A' }]),
            'an href that is not text': json([link({ href: 5 })]),
            'a relative href': json([link({ href: '/settings' })]),
            'an href without a scheme': json([link({ href: 'example.test/sentry' })]),
            'an http:// href': json([link({ href: 'http://example.test' })]),
            'a javascript: href': json([link({ href: 'javascript:alert(1)' })]),
            'a data: href': json([link({ href: 'data:text/html,<script>alert(1)</script>' })]),
            'an href over 500 characters': json([link({ href: `https://example.test/${'a'.repeat(500)}` })]),
            'more than 30 links': json(Array.from({ length: 31 }, (_, i) => link({ label: `L${i}` }))),
        };

        it.each(Object.entries(cases))('%s', (_name, raw) => {
            const result = loadAdminLinks(raw);

            expect(result.status).toBe('invalid');
            expect(result.links).toEqual([]);
            expect(result.problem).toEqual(expect.any(String));
        });

        it('one bad entry among good ones', () => {
            const result = loadAdminLinks(json([link(), link({ href: 'http://example.test' }), link()]));

            expect(result.status).toBe('invalid');
            expect(result.problem).toMatch(/link 2/);
        });
    });

    it('accepts exactly 30 links', () => {
        const list = Array.from({ length: 30 }, (_, i) => link({ label: `L${i}` }));

        expect(loadAdminLinks(json(list)).links).toHaveLength(30);
    });

    it('warns once for a bad value, and never prints the value itself', () => {
        const secret = 'https://private.example.test/never-log-this';
        const raw = json([link({ href: secret }), link({ href: 'http://x.test' })]);

        loadAdminLinks(raw);
        loadAdminLinks(raw);
        loadAdminLinks(raw);

        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(String(console.warn.mock.calls[0][0])).not.toContain('private.example.test');
        expect(String(console.warn.mock.calls[0][0])).toMatch(/ADMIN_LINKS/);
    });

    it('reads process.env.ADMIN_LINKS when no value is passed', () => {
        const before = process.env.ADMIN_LINKS;
        process.env.ADMIN_LINKS = json([link({ label: 'From env' })]);
        try {
            expect(loadAdminLinks().links[0].label).toBe('From env');
            delete process.env.ADMIN_LINKS;
            expect(loadAdminLinks().status).toBe('not_set');
        } finally {
            if (before === undefined) delete process.env.ADMIN_LINKS;
            else process.env.ADMIN_LINKS = before;
        }
    });
});
