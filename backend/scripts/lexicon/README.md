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

## Building and loading the lexicon (Slice B)

```sh
npx tsx scripts/lexicon/ingest.ts de              # → .data/out/lexicon-de-<kaikki date>.jsonl.gz (nouns, verbs, adjectives, adverbs; de ~3.5 MB / 88k, es ~3.3 MB / 109k, en ~13 MB / 611k lexemes)
node scripts/lexicon/load.js <file>               # replaces that language's rows in the DATABASE_URL database, in one transaction
node scripts/lexicon/load.js <file> --if-empty    # only if the language has no rows yet (test / e2e databases). It checks per LANGUAGE: a local
                                                    # database that has old German rows skips a new fixture — run load.js without the flag there.
npx tsx scripts/lexicon/ingest.ts de --fixture    # rewrites the committed test fixture, fixtures/lexicon-de-fixture.jsonl
npx tsx scripts/lexicon/ingest.ts es|en [--fixture]   # the same for Spanish and English (Wiktionary)
npx tsx scripts/lexicon/ingest-et.ts [--fixture]  # Estonian from Eesthetic (not Wiktionary) → lexicon-et-eesthetic-v1.0.5.jsonl.gz
npx tsx scripts/lexicon/ingest-translations.ts [--fixture]   # Slice F: English translations[] → translations-en-<date>.jsonl.gz (~5 MB, ~300k rows)
```

The translation file goes through the same `load.js` (its header format, `ladu-translations/1`,
selects the `lexeme_translations` table) and the same Ansible playbook. A load replaces every
translation row.

Estonian lookups that the lexicon cannot answer go online to the Ekilex API, which needs
`EKILEX_API_KEY` in the repo-root `.env` (see `.dev-context/infrastructure-guide/06-secrets-and-access.md`).

The file format (JSONL, a header line then one lexeme per line) is described at the top of
`load.js`. The table is `lexemes` (`backend/src/db/schema.ts`). Re-ingest is manual, about
once per quarter (decision D14): download → extract → sample → ingest → load.

`fixtures/lexicon-de-fixture.jsonl` is real Wiktionary data (CC BY-SA 4.0, attribution in its
header line): the words the tests use, common nouns, and the 20 most frequent verbs.

Slice 0 measurements (each writes a Markdown file into `.data/`; the results are copied into
`.context/plans/autocomplete-coverage-report.md`):

```sh
npx tsx scripts/lexicon/measure.ts                # EN/ES/DE: kaikki selectors vs today's controllers (~5 s)
npx tsx scripts/lexicon/measure-et.ts             # Estonian: Eesthetic, Pikhof, kaikki (et)
npx tsx scripts/lexicon/measure-translations.ts   # translations[] coverage, both directions
npx tsx scripts/lexicon/estimate-size.ts          # database size, two table layouts
```

Test fixtures (real entries for the selector unit tests in `tests/unit/lexiconSelectors*.test.js`):

```sh
npx tsx scripts/lexicon/fixture.ts de 'tanzen|verb' 'gehen|verb' 'anrufen|verb' 'sichern|verb' 'sammeln|verb' 'sputen|verb' 'Haus|noun' 'Junge|noun' 'gut|adj' 'lila|adj' 'schön|adj' 'oft|adv' 'hier|adv'
npx tsx scripts/lexicon/fixture.ts es 'bailar|verb' 'tener|verb' 'ir|verb' 'personarse|verb' 'sentir|verb' 'conocer|verb' 'buscar|verb' 'enviar|verb' 'casa|noun' 'estudiante|noun' 'rojo|adj' 'feliz|adj' 'grande|adj' 'bien|adv' 'rápidamente|adv'
npx tsx scripts/lexicon/fixture.ts en 'run|verb' 'walk|verb' 'bake|verb' 'be|verb' 'child|noun' 'sheep|noun' 'news|noun' 'big|adj' 'beautiful|adj' 'unique|adj' 'happy|adj' 'quickly|adv' 'fast|adv'
```

The selector tables themselves live in `backend/lib/lexicon/selectors/<lang>.ts`.

## Sources

| File | Source | Licence |
|------|--------|---------|
| `raw-wiktextract-data.jsonl.gz` | kaikki.org raw Wiktextract dump (English Wiktionary) | CC BY-SA 4.0 (some text also GFDL) |
| `frequency-<lang>.txt` | `hermitdave/FrequencyWords`, `content/2018/<lang>/<lang>_50k.txt` (OpenSubtitles 2018) | CC BY-SA 4.0 (content), MIT (code) |
| `pikhof-est_words_160k.tsv` | `KristjanPikhof/Estonian-Wordlist-Enriched-Ekilex`, `data/est_words_160k.tsv` | CC BY-SA 4.0 |
| `eesthetic/` (from `eesthetic-v1.0.5.zip`) | Eesthetic v1.0.5, Zenodo record 14069724 | CC BY 4.0 |

`.data/manifest.json` records the URL, the `Last-Modified` header and the download time of
each file. A report must name the version it measured.

## Notes

- Do not read kaikki files with Node's `readline`. It splits lines on U+2028 and U+2029,
  which appear raw inside JSON strings. Use `readLines()` from `common.ts`.
- The frequency lists are lowercase. Lemma matching ignores case (`haus` → `Haus`).
