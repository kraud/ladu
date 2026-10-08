/**
 * Step 1 of the lexicon pipeline: download the source files into .data/.
 *
 * - kaikki raw all-languages Wiktextract dump (~3 GB gzip, CC BY-SA 4.0)
 * - FrequencyWords 2018 top-50k lists for en/es/de/et (CC BY-SA 4.0)
 * - Estonian: the Pikhof 160k word list (CC BY-SA 4.0) and Eesthetic v1.0.5 (CC BY 4.0, unzipped)
 *
 * A file that already exists is skipped; pass --force to download again.
 * manifest.json records each URL, its Last-Modified header and the download time,
 * so a report can name the exact data version it measured.
 *
 *   cd backend && npx tsx scripts/lexicon/download.ts [--force]
 */

const fs: typeof import('fs') = require('fs');
const { Readable }: typeof import('stream') = require('stream');
const { pipeline }: typeof import('stream/promises') = require('stream/promises');
const { execFileSync }: typeof import('child_process') = require('child_process');
const {
    DATA_DIR, LANG_CODES, KAIKKI_RAW_URL, KAIKKI_RAW_FILE, MANIFEST_FILE, frequencyUrl, frequencyFile,
    EESTHETIC_URL, EESTHETIC_ZIP, EESTHETIC_DIR, PIKHOF_URL, PIKHOF_FILE,
}: typeof import('./common') = require('./common');

interface ManifestEntry {
    url: string;
    lastModified: string | null;
    bytes: number;
    downloadedAt: string;
}

const force = process.argv.includes('--force');

function readManifest(): Record<string, ManifestEntry> {
    return fs.existsSync(MANIFEST_FILE) ? JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8')) : {};
}

async function download(url: string, file: string, manifest: Record<string, ManifestEntry>): Promise<void> {
    if (fs.existsSync(file) && !force) {
        console.log(`skip   ${file} (exists)`);
        return;
    }
    console.log(`fetch  ${url}`);
    // Zenodo answers 403 to Node's default User-Agent; name the script instead.
    const response = await fetch(url, { headers: { 'User-Agent': 'ladu-lexicon-scripts (+https://github.com/kraud/ladu)' } });
    if (!response.ok || !response.body) throw new Error(`${url} answered ${response.status}`);

    // Write to a temporary name first, so an interrupted download never looks complete.
    const partial = `${file}.part`;
    await pipeline(Readable.fromWeb(response.body as any), fs.createWriteStream(partial));
    fs.renameSync(partial, file);

    manifest[file] = {
        url,
        lastModified: response.headers.get('last-modified'),
        bytes: fs.statSync(file).size,
        downloadedAt: new Date().toISOString(),
    };
    fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
    console.log(`saved  ${file} (${manifest[file].bytes} bytes)`);
}

async function main(): Promise<void> {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const manifest = readManifest();
    for (const lang of LANG_CODES) await download(frequencyUrl(lang), frequencyFile(lang), manifest);
    await download(PIKHOF_URL, PIKHOF_FILE, manifest);
    await download(EESTHETIC_URL, EESTHETIC_ZIP, manifest);
    if (!fs.existsSync(EESTHETIC_DIR) || force) {
        execFileSync('unzip', ['-o', '-q', EESTHETIC_ZIP, '-d', EESTHETIC_DIR]);
        console.log(`unzipped ${EESTHETIC_DIR}`);
    }
    await download(KAIKKI_RAW_URL, KAIKKI_RAW_FILE, manifest);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
