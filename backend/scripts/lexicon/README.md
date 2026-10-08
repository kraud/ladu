# Lexicon scripts

Scripts that build and measure the autocomplete lexicon. Plan:
`.context/plans/autocomplete-data-source-strategy.md` (Slice 0 and later).

All data goes into `.data/` in this folder. Git ignores it. It needs about 5 GB of disk.
The scripts run on a developer machine, never on the VPS.

## Run order

```sh
cd backend
npx tsx scripts/lexicon/download.ts   # ~3 GB download; skips files that exist (--force to refresh)
npx tsx scripts/lexicon/extract.ts    # streams the dump once → kaikki-<lang>.jsonl (en, es, de, et)
npx tsx scripts/lexicon/sample.ts     # frequency list → ranked lemmas per part of speech → sample-<lang>.json
```

Test fixtures (real entries for the selector unit tests in `tests/unit/lexiconSelectors*.test.js`):

```sh
npx tsx scripts/lexicon/fixture.ts de 'tanzen|verb' 'gehen|verb' 'anrufen|verb' 'Haus|noun' 'Junge|noun'
npx tsx scripts/lexicon/fixture.ts es 'bailar|verb' 'tener|verb' 'ir|verb' 'casa|noun' 'estudiante|noun'
npx tsx scripts/lexicon/fixture.ts en 'run|verb' 'walk|verb' 'bake|verb' 'be|verb' 'child|noun' 'sheep|noun' 'news|noun'
```

The selector tables themselves live in `backend/lib/lexicon/selectors/<lang>.ts`.

## Sources

| File | Source | Licence |
|------|--------|---------|
| `raw-wiktextract-data.jsonl.gz` | kaikki.org raw Wiktextract dump (English Wiktionary) | CC BY-SA 4.0 (some text also GFDL) |
| `frequency-<lang>.txt` | `hermitdave/FrequencyWords`, `content/2018/<lang>/<lang>_50k.txt` (OpenSubtitles 2018) | CC BY-SA 4.0 (content), MIT (code) |

`.data/manifest.json` records the URL, the `Last-Modified` header and the download time of
each file. A report must name the version it measured.

## Notes

- Do not read kaikki files with Node's `readline`. It splits lines on U+2028 and U+2029,
  which appear raw inside JSON strings. Use `readLines()` from `common.ts`.
- The frequency lists are lowercase. Lemma matching ignores case (`haus` → `Haus`).
