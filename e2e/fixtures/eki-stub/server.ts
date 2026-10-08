/**
 * Local stub of api.sonapi.ee — the Estonian dictionary the backend's Estonian adapter calls
 * (backend/services/dictionary/eki.ts; autocomplete-data-source-strategy.md Slice A, step A3).
 *
 * The e2e backend points `URL_EESTI_LANG_API` here (playwright.config.ts), so the autocomplete
 * spec does not depend on a third-party service. It answers the same shape as sonapi
 * (`GET /v2/<word>[?lg=en]` → `{ searchResult: [...] }`) for a few fixed words; any other
 * word gets an empty result, which the backend reports as `not-found`.
 *
 * Test-only endpoint a real service has no equivalent for:
 *   `GET /__requests` — every lookup received, with the raw (still URL-encoded) path, so a spec
 *                        can check how the backend encoded the word. Newest last.
 *
 * Run standalone: `npm run stub:eki` from `e2e/`. `EKI_STUB_PORT` selects the port.
 */
import { createServer } from 'node:http';

const PORT = Number(process.env.EKI_STUB_PORT ?? 4401);

type WordForm = { code: string; value: string };
type SearchResult = { wordClasses?: string[]; wordForms: WordForm[]; meanings?: { partOfSpeech: { code: string }[] }[] };

const noun = (forms: Record<string, string>): SearchResult => ({
    wordClasses: ['noomen'],
    wordForms: Object.entries(forms).map(([code, value]) => ({ code, value })),
});

/** Fixed answers, keyed by the decoded word. Values as sonapi gives them (SgAdt can hold several, comma-separated). */
const WORDS: Record<string, SearchResult> = {
    õun: noun({ SgN: 'õun', PlN: 'õunad', SgG: 'õuna', PlG: 'õunte', SgP: 'õuna', PlP: 'õunu', SgAdt: 'õuna' }),
    maja: noun({ SgN: 'maja', PlN: 'majad', SgG: 'maja', PlG: 'majade', SgP: 'maja', PlP: 'maju', SgAdt: 'majja,koju' }),
};

const requests: { rawPath: string; word: string; english: boolean }[] = [];

const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    const send = (status: number, body: unknown) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
    };

    if (url.pathname === '/__requests') return send(200, requests);
    if (url.pathname === '/health') return send(200, { ok: true });

    const match = /^\/v2\/([^/]+)$/.exec(url.pathname);
    if (req.method !== 'GET' || !match) return send(404, { message: 'not found' });

    const word = decodeURIComponent(match[1]);
    requests.push({ rawPath: url.pathname, word, english: url.searchParams.get('lg') === 'en' });
    const result = WORDS[word];
    return send(200, { searchResult: result ? [result] : [] });
});

server.listen(PORT, () => console.log(`eki stub listening on http://localhost:${PORT}`));
