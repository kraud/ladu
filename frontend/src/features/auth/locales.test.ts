import { describe, expect, it } from 'vitest';
import de from '../../../public/locales/de/loginRegister.json';
import ee from '../../../public/locales/ee/loginRegister.json';
import en from '../../../public/locales/en/loginRegister.json';
import es from '../../../public/locales/es/loginRegister.json';

// The Terms note is rendered with <Trans> (TermsNote.tsx), which needs the two
// tags in every language. A translation that drops one would lose a link.
describe.each([
    ['en', en],
    ['es', es],
    ['de', de],
    ['ee', ee],
])('loginRegister.json (%s) register.termsNote', (_code, file) => {
    const text = file.register.termsNote;

    it('has the text', () => {
        expect(text.trim()).not.toBe('');
    });

    it('has one <terms> and one <privacy> tag, each with content', () => {
        expect(text.match(/<terms>[^<]+<\/terms>/g)).toHaveLength(1);
        expect(text.match(/<privacy>[^<]+<\/privacy>/g)).toHaveLength(1);
    });

    it('names the age: 13', () => {
        expect(text).toContain('13');
    });
});
