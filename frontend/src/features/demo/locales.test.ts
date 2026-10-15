import { describe, expect, it } from 'vitest';
import de from '../../../public/locales/de/demo.json';
import ee from '../../../public/locales/ee/demo.json';
import en from '../../../public/locales/en/demo.json';
import es from '../../../public/locales/es/demo.json';

/** Every key path of a nested strings object, sorted. */
const keys = (value: unknown, prefix = ''): string[] =>
    typeof value === 'object' && value !== null
        ? Object.entries(value).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k)).sort()
        : [prefix];

// The four files start as English drafts (the user reviews them later). A translation must keep every
// key, and the Terms note (rendered with <Trans> by TermsNote) must keep both link tags.
describe.each([
    ['es', es],
    ['de', de],
    ['ee', ee],
    ['en', en],
])('demo.json (%s)', (_code, file) => {
    it('has the same keys as English', () => {
        expect(keys(file)).toEqual(keys(en));
    });

    it('keeps one <terms> and one <privacy> tag in the Terms note, and the age', () => {
        const text = file.start.termsNote;
        expect(text.match(/<terms>[^<]+<\/terms>/g)).toHaveLength(1);
        expect(text.match(/<privacy>[^<]+<\/privacy>/g)).toHaveLength(1);
        expect(text).toContain('13');
    });
});
