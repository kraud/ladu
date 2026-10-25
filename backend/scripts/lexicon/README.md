# Lexicon scripts

Scripts that build and measure the autocomplete lexicon. Plan:
`.context/plans/autocomplete-data-source-strategy.md` (Slice 0 and later).

All data goes into `.data/` in this folder. Git ignores it. It needs about 5 GB of disk.
The scripts run on a developer machine, never on the VPS.

## Run order

```sh
cd backend
npx tsx scripts/lexicon/download.ts   # ~3 GB download; skips files that exist (--force to refresh)
npx tsx scripts/lexicon/extract.ts    # streams the dump once → kaikki-<lang>.jsonl (en, es, de, et); keeps `categories` for conj/prep/postp entries
npx tsx scripts/lexicon/sample.ts     # frequency list → ranked lemmas per part of speech → sample-<lang>.json
```

## Building and loading the lexicon (Slice B)

```sh
npx tsx scripts/lexicon/ingest.ts de              # → .data/out/lexicon-de-<kaikki date>.jsonl.gz (nouns, verbs, adjectives, adverbs, conjunctions, prepositions; de ~3.5 MB / 88k, es ~3.3 MB / 109k, en ~13 MB / 611k lexemes)
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

## Word lists for onboarding (repo-root `word-lists/`, git-ignored)

```sh
npx tsx scripts/lexicon/word-lists.ts   # ~5 min: newest lexicon-en file + raw dump → word-lists/en/<pos>.tsv
```

One TSV per part of speech with the English lemmas that have a frequency rank (~37k), their
rank, their Wiktionary topics, their WordNet supersenses (`english-wordnet-2025.xml.gz`, from
`download.ts`) and their onboarding topic. The columns and their limits are described at the top
of the script. Run it again after each re-ingest.

The topic map is `onboarding-topics.ts` (supersenses, WordNet hypernym anchors, an adjective
page-topic allowlist, the restricted words, the level bands); its unit test is
`tests/unit/onboardingTopics.test.js`. The script fails at once if an anchor id is not a sense of
its label in the WordNet edition. It also writes `word-lists/topic-report.md`: words per topic and
level band, with examples, for the review (`.context/plans/onboarding.md`).

```sh
npx tsx scripts/lexicon/onboarding-pool.ts [--force]   # ~2 s: word lists + translations → onboarding pool
```

Writes `word-lists/pool-candidates.tsv` and, only when it does not exist yet (or with `--force`,
which discards the review), the committed `scripts/onboarding/pool.tsv`. See
`scripts/onboarding/README.md` for the review.

```sh
npx tsx scripts/lexicon/onboarding-forms.ts   # ~15 s: the forms of every keep concept → scripts/onboarding/pool-forms.json
```

Runs the draft lookup (DATABASE_URL lexicon + Ekilex) for the onboarding pool. Run it after every
edit of `pool.tsv`; onboarding reads the result and makes no lookups at runtime.

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
| `english-wordnet-2025.xml.gz` | Open English WordNet 2025 (`globalwordnet/english-wordnet` release) | CC BY 4.0 + Princeton WordNet licence (attribute both) |

`.data/manifest.json` records the URL, the `Last-Modified` header and the download time of
each file. A report must name the version it measured.

## Notes

- Do not read kaikki files with Node's `readline`. It splits lines on U+2028 and U+2029,
  which appear raw inside JSON strings. Use `readLines()` from `common.ts`.
- The frequency lists are lowercase. Lemma matching ignores case (`haus` → `Haus`).
