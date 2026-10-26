import { describe, expect, it } from 'vitest';

/**
 * Every locale file of every language against English: the same keys, and in each text the same
 * {{placeholders}} and <tags>. A new language (guide: .context/guides/add-language.md) is covered by
 * adding its folder to `public/locales/`; nothing to list here.
 */

type Tree = { [key: string]: string | string[] | Tree };

const files = import.meta.glob<Tree>('../../public/locales/*/*.json', { eager: true, import: 'default' });

/** `{ en: { common: Tree, … }, es: { … } }` */
const locales: Record<string, Record<string, Tree>> = {};
for (const [path, tree] of Object.entries(files)) {
    const match = /locales\/([^/]+)\/([^/]+)\.json$/.exec(path);
    if (!match) continue;
    const [, code, namespace] = match;
    (locales[code!] ??= {})[namespace!] = tree;
}

/** Plural suffixes differ per language (CLDR): compare on the base key. */
const baseKey = (key: string) => key.replace(/_(zero|one|two|few|many|other)$/, '');

/** Every leaf as `a.b.c`. A list of texts is one leaf. */
function leaves(tree: Tree, prefix = ''): Record<string, string | string[]> {
    const out: Record<string, string | string[]> = {};
    for (const [key, value] of Object.entries(tree)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'string' || Array.isArray(value)) out[path] = value;
        else Object.assign(out, leaves(value, path));
    }
    return out;
}

const placeholders = (text: string) => [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort();
const tags = (text: string) => [...text.matchAll(/<\/?\w+>/g)].map((m) => m[0]).sort();
const texts = (value: string | string[]) => (Array.isArray(value) ? value : [value]);
const baseKeys = (l: Record<string, unknown>) => [...new Set(Object.keys(l).map(baseKey))].sort();

const english = locales.en ?? {};
const others = Object.keys(locales).filter((code) => code !== 'en').sort();

describe('locale folders', () => {
    it('has English and the same 14 files in every language', () => {
        expect(Object.keys(english).length).toBeGreaterThan(0);
        for (const code of others) {
            expect({ code, files: Object.keys(locales[code]!).sort() }).toEqual({ code, files: Object.keys(english).sort() });
        }
    });
});

describe.each(others)('locale %s against English', (code) => {
    it.each(Object.keys(english).sort())('%s.json: same keys, placeholders and tags', (namespace) => {
        const reference = leaves(english[namespace]!);
        const translated = leaves(locales[code]![namespace]!);

        expect(baseKeys(translated)).toEqual(baseKeys(reference));

        const problems: string[] = [];
        for (const [key, value] of Object.entries(translated)) {
            const ref = reference[key] ?? reference[`${baseKey(key)}_other`] ?? reference[baseKey(key)];
            if (ref === undefined) continue;
            const mine = texts(value);
            const theirs = texts(ref);
            if (mine.length !== theirs.length) problems.push(`${key}: ${theirs.length} lines in English, ${mine.length} here`);
            mine.forEach((text, i) => {
                const other = theirs[i] ?? '';
                if (other !== '' && text.trim() === '') problems.push(`${key}: empty text`);
                if (placeholders(text).join() !== placeholders(other).join()) problems.push(`${key}: placeholders ${placeholders(other)} vs ${placeholders(text)}`);
                if (tags(text).join() !== tags(other).join()) problems.push(`${key}: tags ${tags(other)} vs ${tags(text)}`);
            });
        }
        expect(problems).toEqual([]);
    });
});
