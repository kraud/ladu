/**
 * Local stub of the Ekilex API — the Estonian dictionary the backend's Estonian adapter calls
 * (backend/services/dictionary/eki.ts; autocomplete-data-source-strategy.md decision D18).
 *
 * The e2e backend points `EKILEX_API_URL` here (playwright.config.ts), so no spec depends on a
 * third-party service. It answers the three endpoints the adapter uses, in Ekilex's shape, for a
 * few fixed words; any other word has no entry, which the backend reports as `not-found`:
 *   GET /api/word/ids/{word}/eki/est   → [wordId]
 *   GET /api/paradigm/details/{wordId} → [{ wordClass, paradigmForms: [{ morphCode, value }] }]
 *   GET /api/word/details/{wordId}     → { lexemes: [{ pos }], wordRelationDetails: { level1WordRelationGroups } }
 *                                         (part of speech + comparison relations komp/superl, decision D20)
 *   GET /api/meaning/search/{word}     → { results: [{ meaningWords: [{ wordValue, lang }] }] }
 * The `ekilex-api-key` header is not checked.
 *
 * Test-only endpoint a real service has no equivalent for:
 *   `GET /__requests` — every request received, with the raw (still URL-encoded) path, so a spec
 *                        can check how the backend encoded the word. Newest last.
 *
 * Run standalone: `npm run stub:eki` from `e2e/`. `EKI_STUB_PORT` selects the port.
 */
import { createServer } from 'node:http';

const PORT = Number(process.env.EKI_STUB_PORT ?? 4401);

type Form = { morphCode: string; value: string };
type Paradigm = { wordClass: string; paradigmForms: Form[] };

const forms = (pairs: Record<string, string>): Form[] => Object.entries(pairs).map(([morphCode, value]) => ({ morphCode, value }));

/** word → [word id, paradigm]. */
const WORDS: Record<string, [number, Paradigm]> = {
    õun: [101, { wordClass: 'noomen', paradigmForms: forms({ SgN: 'õun', PlN: 'õunad', SgG: 'õuna', PlG: 'õunte', SgP: 'õuna', PlP: 'õunu', SgAdt: 'õuna' }) }],
    maja: [102, { wordClass: 'noomen', paradigmForms: forms({ SgN: 'maja', PlN: 'majad', SgG: 'maja', PlG: 'majade', SgP: 'maja', PlP: 'maju', SgAdt: 'majja' }) }],
    väike: [103, { wordClass: 'noomen', paradigmForms: forms({ SgN: 'väike', PlN: 'väikesed', SgG: 'väikese', PlG: 'väikeste', SgP: 'väikest', PlP: 'väikesi' }) }],
    // MADE-UP comparison data (see DETAILS): the real Ekilex lists "toredaim" too. Here "tore" has only
    // "kõige toredam", so the e2e spec can exercise the rare "no one-word superlative" branch.
    tore: [104, { wordClass: 'noomen', paradigmForms: forms({ SgN: 'tore', PlN: 'toredad', SgG: 'toreda' }) }],
    jooksma: [201, { wordClass: 'verb', paradigmForms: forms({ Sup: 'jooksma', Inf: 'joosta', IndPrSg1: 'jooksen', IndIpfSg1: 'jooksin', PtsPtPs: 'jooksnud' }) }],
};
type Details = { lexemes: { pos: { code: string }[] }[]; wordRelationDetails?: { level1WordRelationGroups: { groupTypeCode: string; members: { wordValue: string }[] }[] } };
const relations = (groups: Record<string, string[]>) => ({
    level1WordRelationGroups: Object.entries(groups).map(([groupTypeCode, words]) => ({ groupTypeCode, members: words.map((wordValue) => ({ wordValue })) })),
});
/** word id → word details. Nouns: part of speech only. */
const DETAILS: Record<number, Details> = {
    101: { lexemes: [{ pos: [{ code: 's' }] }] },
    102: { lexemes: [{ pos: [{ code: 's' }] }] },
    103: { lexemes: [{ pos: [{ code: 'adj' }] }], wordRelationDetails: relations({ komp: ['väiksem'], superl: ['kõige väiksem', 'väikseim'] }) },
    104: { lexemes: [{ pos: [{ code: 'adj' }] }], wordRelationDetails: relations({ komp: ['toredam'], superl: ['kõige toredam'] }) },
};
/**
 * English word → meanings, each with its Estonian words (for "search in English"). Since step F3 the
 * backend asks only when its translation table has no Estonian verb: "zorp" is made up, so no table
 * has it, and its verb "tantsima" is in the Estonian lexicon.
 */
const MEANINGS: Record<string, string[][]> = { run: [['jooks', 'jooksma']], zorp: [['tantsima']] };

const requests: { rawPath: string }[] = [];

const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    const send = (status: number, body: unknown) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
    };

    if (url.pathname === '/__requests') return send(200, requests);
    if (url.pathname === '/health') return send(200, { ok: true });
    if (req.method !== 'GET') return send(404, { message: 'not found' });
    requests.push({ rawPath: url.pathname });

    let match: RegExpExecArray | null;
    if ((match = /^\/api\/word\/ids\/([^/]+)\/eki\/est$/.exec(url.pathname))) {
        const entry = WORDS[decodeURIComponent(match[1])];
        return send(200, entry ? [entry[0]] : []);
    }
    if ((match = /^\/api\/paradigm\/details\/(\d+)$/.exec(url.pathname))) {
        const entry = Object.values(WORDS).find(([id]) => id === Number(match![1]));
        return send(200, entry ? [entry[1]] : []);
    }
    if ((match = /^\/api\/word\/details\/(\d+)$/.exec(url.pathname))) {
        return send(200, DETAILS[Number(match[1])] ?? {});
    }
    if ((match = /^\/api\/meaning\/search\/([^/]+)$/.exec(url.pathname))) {
        const meanings = MEANINGS[decodeURIComponent(match[1])] ?? [];
        return send(200, { results: meanings.map((est) => ({ meaningWords: est.map((wordValue) => ({ wordValue, lang: 'est' })) })) });
    }
    return send(404, { message: 'not found' });
});

server.listen(PORT, () => console.log(`Ekilex stub listening on http://localhost:${PORT}`));
