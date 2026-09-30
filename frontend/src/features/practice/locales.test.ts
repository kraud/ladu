import { describe, expect, it } from 'vitest';
import de from '../../../public/locales/de/practice.json';
import ee from '../../../public/locales/ee/practice.json';
import en from '../../../public/locales/en/practice.json';
import es from '../../../public/locales/es/practice.json';

type Tree = { [key: string]: string | Tree };

/** Every leaf as `a.b.c`. */
function leaves(tree: Tree, prefix = ''): Record<string, string> {
    return Object.entries(tree).reduce<Record<string, string>>((acc, [key, value]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'string') acc[path] = value;
        else Object.assign(acc, leaves(value, path));
        return acc;
    }, {});
}

const placeholders = (text: string) => [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort();

/** i18next plural suffixes differ per language; compare on the base key. */
const baseKey = (key: string) => key.replace(/_(zero|one|two|few|many|other)$/, '');

const reference = leaves(en as Tree);
const baseKeys = (tree: Record<string, string>) => [...new Set(Object.keys(tree).map(baseKey))].sort();

describe.each([
    ['es', es],
    ['de', de],
    ['ee', ee],
])('practice.json (%s)', (_code, file) => {
    const translated = leaves(file as Tree);

    it('has exactly the keys of the English file', () => {
        expect(baseKeys(translated)).toEqual(baseKeys(reference));
    });

    it('has no empty text', () => {
        for (const [key, value] of Object.entries(translated)) expect(value.trim(), key).not.toBe('');
    });

    it('uses the same {{placeholders}} as English for every key', () => {
        for (const [key, value] of Object.entries(translated)) {
            const english = reference[key] ?? reference[`${baseKey(key)}_other`];
            if (english !== undefined) expect(placeholders(value), key).toEqual(placeholders(english));
        }
    });
});

describe('practice.json (en)', () => {
    it('has no empty text', () => {
        for (const [key, value] of Object.entries(reference)) expect(value.trim(), key).not.toBe('');
    });
});
