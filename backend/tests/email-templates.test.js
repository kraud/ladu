// Unit tests for the transactional-email building blocks that
// `auth.test.js` can't reach — `sendMail` is mocked out there, so the actual
// template/localization/escaping code never runs. These call the exported
// template functions directly, unmocked.
const fs = require('fs');
const { stringsFor } = require('../utils/resources/emailStrings');
const { escapeHtml } = require('../utils/resources/escapeHtml');
const verifyEmail = require('../utils/resources/verifyEmail');
const resetPassword = require('../utils/resources/resetPassword');

describe('escapeHtml', () => {
    it('escapes the five HTML-significant characters', () => {
        expect(escapeHtml(`<script>alert("hi") & 'bye'</script>`)).toBe(
            '&lt;script&gt;alert(&quot;hi&quot;) &amp; &#39;bye&#39;&lt;/script&gt;',
        );
    });

    it('coerces null/undefined to an empty string', () => {
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(undefined)).toBe('');
    });
});

describe('emailStrings.stringsFor', () => {
    it('returns the matching dictionary for each supported language', () => {
        expect(stringsFor('Spanish').titleVerify).toBe('Confirma tu correo electrónico');
        expect(stringsFor('German').titleReset).toBe('Setze dein Passwort zurück');
        expect(stringsFor('Estonian').subjectVerify).toBe('Kinnita oma e-post');
    });

    it('falls back to English for an unrecognized or missing language', () => {
        expect(stringsFor('Klingon')).toBe(stringsFor('English'));
        expect(stringsFor(undefined)).toBe(stringsFor('English'));
        expect(stringsFor(null)).toBe(stringsFor('English'));
    });
});

describe('verifyEmail template', () => {
    const data = {
        name: '<b>Kai</b> & "friends"',
        url: 'https://ladu.app/user/1/verify/abc',
        language: 'Spanish',
    };

    it('renders the localized title and escapes interpolated values', () => {
        const html = verifyEmail.getHtmlComponent(data);
        expect(html).toContain('Confirma tu correo electrónico');
        expect(html).toContain(data.url);
        expect(html).not.toContain('<b>Kai</b>');
        expect(html).toContain('&lt;b&gt;Kai&lt;/b&gt; &amp; &quot;friends&quot;');
    });

    it('never mentions an expiry — verification links never expire', () => {
        const html = verifyEmail.getHtmlComponent(data);
        expect(html.toLowerCase()).not.toMatch(/expir|30 min|caduc|abgelaufen|aegu/);
    });

    it('the plaintext part carries the same link and no markup from the template itself', () => {
        const text = verifyEmail.getTextComponent({ ...data, name: 'Kai' });
        expect(text).toContain(data.url);
        expect(text).not.toContain('<');
    });

    it('attaches the rasterized brand mark, which exists on disk', () => {
        const [attachment] = verifyEmail.getAttachments();
        expect(attachment.cid).toBe('logo');
        expect(fs.existsSync(attachment.path)).toBe(true);
    });
});

describe('resetPassword template', () => {
    const data = {
        name: 'Kai',
        email: 'kai+test@example.com',
        url: 'https://ladu.app/resetPassword/1/abc',
        language: 'German',
    };

    it('renders the localized title, the account email, and the expiry sentence', () => {
        const html = resetPassword.getHtmlComponent(data);
        expect(html).toContain('Setze dein Passwort zurück');
        expect(html).toContain(data.email);
        expect(html).toContain('30 Minuten');
    });

    it('escapes the interpolated email address', () => {
        const html = resetPassword.getHtmlComponent({ ...data, email: '<img src=x>' });
        expect(html).not.toContain('<img src=x>');
        expect(html).toContain('&lt;img src=x&gt;');
    });

    it('attaches the rasterized brand mark, which exists on disk', () => {
        const [attachment] = resetPassword.getAttachments();
        expect(attachment.cid).toBe('logo');
        expect(fs.existsSync(attachment.path)).toBe(true);
    });
});
