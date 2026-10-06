const fs = require('fs');
const path = require('path');
const { TERMS_VERSION, termsAcceptance } = require('../../lib/terms');

describe('terms acceptance record', () => {
    it('gives the version and the time for the users row', () => {
        const now = new Date('2026-10-06T12:00:00Z');
        expect(termsAcceptance(now)).toEqual({ termsAcceptedAt: now, termsVersion: TERMS_VERSION });
    });

    it('uses the current time when none is given', () => {
        const before = Date.now();
        const { termsAcceptedAt } = termsAcceptance();
        expect(termsAcceptedAt.getTime()).toBeGreaterThanOrEqual(before);
    });

    // The version is the "Last updated" date of the public Terms page. If the page
    // changes and this value does not (or the reverse), the stored record is wrong.
    it('matches the "Last updated" date on landing/terms.html', () => {
        const html = fs.readFileSync(path.join(__dirname, '../../../landing/terms.html'), 'utf8');
        expect(html).toContain(`Last updated ${TERMS_VERSION}.`);
    });
});
