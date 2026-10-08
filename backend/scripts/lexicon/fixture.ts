/**
 * Writes a unit-test fixture of real kaikki entries: tests/unit/fixtures/lexicon-<lang>.json.
 * Takes the first lemma entry (not a pure `form_of` entry) for each word|pos pair.
 * Senses are reduced to their tags, so the file holds only what the selectors read.
 *
 *   cd backend && npx tsx scripts/lexicon/fixture.ts de tanzen|verb gehen|verb Haus|noun
 */

const fs: typeof import('fs') = require('fs');
const path: typeof import('path') = require('path');
const { MANIFEST_FILE, kaikkiFile, readLines }: typeof import('./common') = require('./common');
type LangCode = import('./common').LangCode;

async function main(): Promise<void> {
    const [lang, ...pairs] = process.argv.slice(2) as [LangCode, ...string[]];
    if (!lang || pairs.length === 0) throw new Error('usage: fixture.ts <lang> <word|pos>...');

    const wanted = new Map<string, any>(pairs.map((pair) => [pair, null]));
    for await (const line of readLines(fs.createReadStream(kaikkiFile(lang)))) {
        const entry = JSON.parse(line);
        const key = `${entry.word}|${entry.pos}`;
        if (!wanted.has(key) || wanted.get(key) !== null) continue;
        if (!(entry.senses ?? []).some((sense: any) => !sense.form_of)) continue;
        wanted.set(key, { ...entry, senses: entry.senses.map((sense: any) => ({ tags: sense.tags })), translations: undefined });
    }

    const missing = [...wanted].filter(([, entry]) => entry === null).map(([key]) => key);
    if (missing.length) throw new Error(`not found: ${missing.join(', ')}`);

    const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
    const version = Object.values<any>(manifest).find((m) => m.url.includes('kaikki'))?.lastModified;
    const file = path.join(__dirname, '../../tests/unit/fixtures', `lexicon-${lang}.json`);
    fs.writeFileSync(file, JSON.stringify({
        _source: `Excerpts of English Wiktionary via the kaikki.org raw Wiktextract dump (Last-Modified ${version}), CC BY-SA 4.0. Senses reduced to tags. Rebuild: scripts/lexicon/fixture.ts.`,
        entries: [...wanted.values()],
    }, null, 1));
    console.log(`wrote ${file}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
