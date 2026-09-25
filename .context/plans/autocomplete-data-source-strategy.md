# Autocomplete & lexical data sources — research record

*Status: research only. No code was written. Started 2026-09-25.*

*Scope: which free or very cheap source can supply the word-form autocomplete data, and
whether one source can replace the current per-language set of libraries and APIs.*

*Related: `snapshot/autocomplete.md` (the frozen 8-endpoint spec), `snapshot/word-cases-data.md`
(the case registry), `new-repo-build-plan.md` §5 phase 3.*

---

## 1. Why this document exists

Ladu gets autocomplete data from a different library or API for each language and part of
speech. That is 5 npm packages and 1 external HTTP service for 4 languages. Each source has its
own response shape, its own licence, and its own idea of what a "case" is. The frontend hides
this behind a registry (`features/autocomplete/transforms.ts`). The backend does not.

The question was: is there one central source we could use instead, even if it does not cover
every language, to unify some of the endpoints?

Answer: **yes — Wiktextract (`kaikki.org`) covers English, Spanish, German and Estonian with
tagged word forms in one schema, under one licence.** It is not a drop-in replacement for every
current source, because some current sources generate forms by rule and the new source only
stores forms. Section 5 explains that limit. Section 6 gives the recommendation.

---

## 2. Current state

Eight routes, all `GET /api/autocompleteTranslations/*`, all behind `protect`:

| lang | PoS | Route suffix | Source | Runs | Licence |
|------|-----|--------------|--------|------|---------|
| EN | verb | `/english/verb/:infinitiveVerb` | `english-verbs-helper` + `english-verbs-irregular` + `english-verbs-gerunds` | local | Apache-2.0 |
| ES | verb | `/spanish/verb/:infinitiveVerb` | `spanish-verbs` | local | Apache-2.0 |
| ES | noun | `/spanish/noun/:singularNominativeNoun` | `rosaenlg-gender-es` | local | MIT |
| DE | verb | `/german/verb/:infinitiveVerb` | `german-verbs` + `german-verbs-dict` | local | Apache-2.0 + CC-BY-SA-4.0 |
| DE | noun | `/german/noun/:singularNominativeNoun` | `german-words` + `german-words-dict` | local | Apache-2.0 + CC-BY-SA-4.0 |
| EE | verb | `/estonian/verb/:infinitiveMaVerb` | `api.sonapi.ee/v2` | **network** | CC-BY-4.0 (data) |
| EE | noun | `/estonian/noun/:singularNominativeNoun` | `api.sonapi.ee/v2` | **network** | CC-BY-4.0 (data) |
| EE | adjective | `/estonian/adjective/:singularAdjective` | `api.sonapi.ee/v2` | **network** | CC-BY-4.0 (data) |

Word existence is checked separately by `is-word`. That package builds a trie from one text file
per language (`node_modules/is-word/dictionary/`, 10 languages, 0.9 MB to 4.9 MB each).

Facts about the sources:

- The 5 npm packages come from **2 upstream data lineages**. Four are RosaeNLG packages. Two of
  those (`german-verbs-dict`, `german-words-dict`) are built from LanguageTool's
  `german-pos-dict`. `spanish-verbs` is a fork of HealthTap's `conjugator`.
- `api.sonapi.ee` is a **third-party, unauthenticated** service. It is not an EKI product. It is
  a community wrapper around EKI's Ekilex database. Our `.env` holds
  `URL_EESTI_LANG_API = 'https://api.sonapi.ee/v2'`. The backend proxy answers `502` when it
  fails, and the Jest suite mocks it.
- No autocomplete exists for adjectives or adverbs outside Estonian, and for nothing at all
  except the 8 pairs above.

---

## 3. The real problem

The pain is not coverage. The pain is that **the seam is duplicated 8 times**. Every new
language or part of speech needs a new route, a new response envelope, a new frontend transform
and a new source licence review.

`snapshot/autocomplete.md` records the result: 4 sanitize transforms in the old frontend, 4 more
sanitizers written inline inside form components, and 2 different response envelopes (the
`found<Type>` envelope, and the raw Estonian passthrough).

---

## 4. Candidate sources

### 4.1 Wiktextract / kaikki.org — the main candidate

**What it is.** Wiktextract is a tool that reads the English Wiktionary dump and writes one JSON
object per line per (word, part of speech). kaikki.org publishes ready-made per-language files
from it. Each entry has a `forms[]` array. Each form has a `form` string and a `tags` array.
The tags are **canonicalised across languages** — Wiktextract defines over 2000 tags in
categories such as case, number, person, tense, mood, degree, non-finite form and dialect.

**Coverage** (kaikki.org index pages, extraction dated 2026-09-20):

| lang | word senses | distinct word forms | postprocessed dump size |
|------|-------------|---------------------|-------------------------|
| EN | 1,787,236 | — | 3,095 MiB |
| ES | 875,726 | — | 989 MiB |
| DE | 633,412 | 352,527 | 1,026 MiB |
| EE | 16,929 | 12,595 | 52 MiB |

Dump sizes were read from the `Content-Length` of
`https://kaikki.org/dictionary/<Lang>/kaikki.org-dictionary-<Lang>.jsonl`.

The Wiktextract paper (Ylonen, LREC 2022) reports lemma and inflection counts: EN 914,577
lemmas / 656,758 inflections; ES 235,822 / 1,348,507; DE 89,662 / 2,442,099. The same paper
states the extraction covers 322 languages with at least 500 lemmas.

**Verified samples.** I downloaded these entries on 2026-09-25 and inspected the `forms[]`
arrays:

| entry | forms | examples |
|-------|-------|----------|
| ES verb `bailar` | 209 | `bailo → [first-person, indicative, present, singular]`, `bailado → [masculine, participle, past, singular]`, `bailando → [gerund]` |
| DE verb `tanzen` | 151 | `tanzt → [present, singular, third-person]`, `getanzt → [participle, past]`, plus `haben` and `sein` as auxiliaries |
| DE noun `Haus` | full grid | `Haus → [dative, singular]`, `Häusern → [dative, definite, plural]`, `Hauses → [genitive, singular]`, `Häuser → [accusative, definite, plural]`. Gender is in `senses[].tags` as `neuter`. |
| EN verb `run` | 28 | `runs → [present, singular, third-person]`, `ran → [past]`, `running → [participle, present]` |
| ES noun `casa` | 2 | `casas → [plural]`, gender `feminine` |
| EE noun `maja` | 47 | `maja → [genitive]`, `majad → [nominative, plural]`, `maja → [accusative, genitive, singular]` |

Two results matter:

1. **The German noun has the full case × number grid.** This matches what
   `german-words-dict` gives today. Wiktextract is not a downgrade here.
2. **Estonian noun declension is present in the English Wiktionary dump**, with the inflection
   class (`et-decl-saba`) and gradation class included.

**Other useful fields in the same record:**

- `form_of` — links an inflected form back to its lemma. Gives a form → lemma resolver for free.
- `translations[]` — on entries of the English language only. Each item has `lang`, `word` and
  `tags` (including gender). This is a ready-made cross-language graph, close to the Ladu
  `Word → Translation` model.
- `glosses` — English definitions for every language's entries.
- `sounds[]` — IPA and audio file URLs.

**Limits.**

- Estonian coverage is 12,595 words. That is far below EKI's Sõnaveeb. Estonian needs a second
  source (section 7).
- The per-language postprocessed JSONL files are **marked DEPRECATED**
  (`tatuylonen/wiktextract` issue 1178). The supported replacement is the raw all-languages file
  at `https://kaikki.org/dictionary/raw-wiktextract-data.jsonl` (23.5 GB, or 2.7 GB gzipped).
  A re-ingest later may need our own Wiktextract run.
- The files contain noise rows. Rows tagged `table-tags`, `inflection-template` or `class` are
  metadata, not word forms. Dialectal, archaic and `alternative` forms need filtering.
- Licence: **CC BY-SA 4.0**. See section 8.

### 4.2 Wikidata Lexemes — CC0, but too thin

Wikidata Lexemes are the only candidate with a **CC0** licence, which needs no attribution. They
have a clean structure too: Lexeme → Forms (with grammatical features) → Senses (with
`item for this sense` linking). The Ladu data model maps onto it almost 1:1.

Coverage is the problem (Wikidata statistics page, `Counts of various things by language`, read
2026-09-25), counted in senses:

| lang | senses |
|------|--------|
| EN | 59,969 |
| ES | 20,970 |
| DE | 20,135 |
| EE | 4,946 |

For comparison, kaikki has 1,787,236 English senses. **Wikidata Lexemes cannot autocomplete.**
It is a possible concept layer for the future cross-language browsing feature. Treat it as
additive, not as a source.

### 4.3 Wordnets (OMW and friends)

OMW v1 ships 28 wordnets aligned to Princeton WordNet. It has English (117,659 synsets) and
Spanish (MCR, 38,512 synsets, CC BY 3.0). The wordnet directory listing of
`github.com/omwn/omw-data` contains **no German and no Estonian**. German OdeNet
(CC-BY-SA-4.0) and Estonian EstWN are separate projects. EstWN is large — more than 91,700
concepts and about 148,000 words (TEKsaurus, October 2021).

**Wordnets carry lemmas, synsets and relations, but no inflected forms.** They cannot feed
autocomplete. They are useful for a sense/concept layer and for multiple-choice distractors.

### 4.4 Datamuse — English prefix search only

`https://api.datamuse.com/words?sp=run*` returns a prefix-ranked word list with no API key.
Verified working on 2026-09-25. English only. The current rate-limit terms were not checked.
Useful only as a quick English suggestion list. It gives no grammar.

### 4.5 Estonian-specific sources

See section 7. In short: the **Ekilex API** (official, needs a key) and **Vabamorf** (offline,
LGPL, analyzer and synthesizer, C++/Java/Python). Two ready-made datasets also exist. They need
no key at all.

### 4.6 Rejected for now

- **Apertium / Zmorge / lttoolbox** — FST morphology. They overlap what the RosaeNLG packages
  already do. No clear gain.
- **api.store** — a reseller listing for the Sõnaveeb dataset. "Get early access" only. Not a
  data source.

---

## 5. What one source can and cannot replace

This is the important limit. There are two kinds of current source. They are not equivalent.

| kind | examples | behaviour | Wiktextract equivalent |
|------|----------|-----------|------------------------|
| **Generator** | `spanish-verbs`, `english-verbs-helper` | Conjugates **any** verb from rules, including a verb with no dictionary entry | none |
| **Dictionary** | `german-verbs-dict`, `german-words-dict`, `rosaenlg-gender-es`, `api.sonapi.ee` | Looks the word up, fails when the word is absent | yes, and usually richer |

So a dictionary-backed source cannot replace a generator. A user can type a valid Spanish verb
that Wiktionary has no page for, and the current backend fills the whole form. The new source
would say "not found".

**Decision: keep the generators, use the dictionary as the first choice.** Look up the local
lexicon. If the lexicon has no row, fall back to the rule-based generator. This keeps today's
behaviour and adds coverage. It also fits the app model, because the app needs only a small,
named set of cases per language and part of speech — not a full paradigm. The Estonian noun
needs 7 cases. The Estonian verb needs 20 cells. `snapshot/word-cases-data.md` lists them all.

### 5.1 Can we identify every case? — verified audit

**Yes, with caveats.** The tags are canonical and machine-readable, so each app case becomes a
**selector**, not a filled cell. The selector is a predicate: "the form whose tag set contains
`{first-person, indicative, present, singular}`". This is the same pattern the app already uses
for Estonian. `snapshot/autocomplete.md` §2 records
`getWordFromWordFormsList(wordForms, code)`, which finds a form by `code ===`. The same function
becomes "find the form whose tags match".

I audited every EN, ES and DE entry in the registry (`snapshot/word-cases-data.md`, 105 entries)
against the real `forms[]` data.

| group | registry entries | identifiable from kaikki | what is missing |
|-------|------------------|--------------------------|-----------------|
| EN noun | 2 | **2** | — |
| ES noun | 3 | **3** | — |
| DE noun | 9 | **9** | — |
| EN verb | 21 | **10** | 10 periphrastic, 1 flag |
| ES verb | 42 | **38** | 2 periphrastic, 1 absent, 1 flag |
| DE verb | 28 | **26** | 2 flags (unverified) |
| **total** | **105** | **88 (84%)** | 12 periphrastic, 1 absent, 4 flags |

Evidence for each verb group:

- **German verbs — the best case.** All four tenses are present as forms.
  `tanze → [first-person, indicative, present, singular]`, `tanzte → [first-person, indicative, preterite, singular]`,
  `habe getanzt → [first-person, indicative, multiword-construction, perfect, singular]`,
  `werde tanzen → [first-person, future, future-i, indicative, multiword-construction, singular]`.
  The auxiliary is present too: `haben` and `sein` carry the `auxiliary` tag, which matches the
  app's `auxVerbDE` field. Only `caseTypeDE` and `prefixDE` are unverified — they are not forms.
- **Spanish verbs.** Non-finite simple forms (`bailar → [infinitive]`, `bailando → [gerund]`,
  `bailado → [participle, past]`), perfect simple past (`preterite`), future, conditional,
  imperfect and the five imperatives are all present and tagged.
- **English verbs — two real gaps.** The `simpleFuture*` and `simpleConditional*` cases are
  **absent**. I checked `run`, `walk`, `be` and `talk`. No form in any of them carries a
  `future` or `conditional` tag. English Wiktionary's verb tables do not list `will run` or
  `would run` as forms. This is consistent, not a one-entry gap.
- **Spanish `imperative1sES`** has no form. Spanish has no first-person singular imperative.
- **English `regularityEN` and Spanish `regularityES`** are flags, not forms. kaikki does not
  state them. Keep the generator, or compute the flag by diffing the listed forms against the
  regular rule.

**The 13 missing forms are cheap.** 10 English future/conditional forms are `will`/`would` plus
the bare infinitive. The 2 Spanish compound non-finites are `haber`/`habiendo` plus the
participle. These are 4 lines of rule code. They do not need a data source.

**Caveat A — several forms can match one selector.** One tag combination can have more than one
form. Spanish `baila [imperative, informal, second-person, singular]` and
`bailás [imperative, informal, second-person, singular, vos-form]` both match a naive selector
for `imperative2sES`. English `run` also has `runnest` and `ranst` tagged `archaic`. The ingest
step needs a deterministic tie-break. A global "drop archaic/obsolete/rare/nonstandard" list is
safe, but it must be per-case for `informal`/`formal` — that pair **is** the difference between
`imperative2sES` and `imperative3sES` in Spanish. Also drop the placeholder value `'-'`.

**Caveat B — the schema is fine, the entry coverage is the unknown.** I sampled 6 entries. An
entry that has no inflection table on Wiktionary will return partial forms. **Before we commit,
we must audit coverage**: ingest a few thousand lemmas per language and count how many have the
forms each registry entry needs. This is the main remaining risk and it is measurable. Slice B in
section 9 should include that measurement.

**Caveat C — one more selector per case.** The mapping is 105 hand-written predicates for
EN/ES/DE, each with a unit test. It is mechanical, but it is real work and it is the bulk of the
ingest slice. It should be written as data (a table), not as code.

---

## 6. Recommendation

**Unify the seam. Keep the sources plural, but reduce them and put them behind one interface.**

Target shape:

```
GET /api/dictionary/:lang/:pos/:query
  → 200 { found: boolean, partial?: boolean, cases: [{ caseName, word }] }
```

One controller. One response envelope. One registry that maps `(lang, pos)` to a source, a
query-field name and a case map. Three adapters behind the registry:

1. **`lexicon`** — a local table `lexeme_form(lang, lemma, pos, case_name, form, lemma_key)`,
   built by an ingest script from the kaikki dumps. Serves autocomplete, the word-existence
   check (replaces `is-word`), and the future "browse all words" feature.
2. **`generator`** — today's RosaeNLG packages, used when the lexicon has no row.
3. **`eki`** — an Estonian passthrough for the long tail, either `api.sonapi.ee` or the official
   Ekilex API.

Why this shape:

- **Latency and cost.** A prefix query on a `pg_trgm` index over a few million filtered rows
  answers in single-digit milliseconds. There is no per-request cost and no rate limit. That is
  faster and cheaper than the current Estonian network hop.
- **One licence review instead of eight.** One attribution notice covers EN, ES and DE.
- **It sets up the browsing goal.** The English dump also carries `translations[]` and glosses.
  A later feature can read the same table.

Do **not** unify by deleting the generators. Do **not** claim Wiktextract replaces Estonian.

---

## 7. Estonian: how to actually call the Ekilex API

You could not find the API documentation because the links point at a repository that no longer
exists. This is verified: `https://github.com/keeleinstituut/ekilex/wiki/Ekilex-API` returns
HTTP 404, and `api.github.com/repos/keeleinstituut/ekilex` returns nothing. The Node client
`@vanakaru/ekilex-api-client` still links to that dead page.

**The live documentation** is here:

- Repository: `https://github.com/keeleinstituut/ekilex_documentation`
- API use cases, in Estonian:
  `https://github.com/keeleinstituut/ekilex_documentation/blob/main/docs/api/api-kasutusjuhtumid.md`
- Use cases also exist for the software itself in `keeleinstituut/ekilex_docs`.

**Base addresses and access.**

- Production: `https://ekilex.ee`
- Test: `https://ekitest.tripledev.ee/ekilex/`
- An API key is required. `https://ekilex.ee/api/word/search/maja` returns **403** without one.
  Get a key from `https://ekilex.ee/userprofile`, which needs an Ekilex account.

**The endpoints that matter to us** (paths are relative to the base):

| Endpoint | Purpose | Response path |
|----------|---------|---------------|
| `GET api/word/search/{word}` | Find a word and its `wordId` | `words[*].wordId` |
| `GET api/word/ids/{word}/{dataset}/{lang}` | Same, restricted to one dataset and language. Use `eki` and `est`. | `[wordId]` |
| `GET api/word/details/{wordId}` | Full record. **This gives the paradigm.** | `$.word.paradigms[*].forms[*].value` and `.morphValue` |
| `GET api/form/search/{form}` | Find the lemma of an inflected form | `$[*].wordValue` |
| `GET api/meaning/search/{word}` | Translations | `$.results[*].meaningWords[*].wordValue` and `.lang` |
| `GET api/datasets` | All dataset codes | — |
| `GET api/classifiers/lang` | All language codes | — |
| `GET api/public_word/{dataset}` | **All** words in one dataset. Bulk export. | `$[*].value`, `$[*].wordId` |

**The wildcard feature is what autocomplete needs.** `api/word/search/{word}` accepts `*` for
any number of characters and `?` for one character. The documentation gives these examples:
`api/word/search/*loojang` returns `loojang`, `päevaloojang`, `päikeseloojang`, and
`api/word/search/l??ng/eki` returns `laeng` and `loeng`. So `api/word/search/maj*` is a prefix
search.

**Form labels arrive in Estonian.** `word/details` returns a human label per form, for example
`kindla kõneviisi oleviku ainsuse 1.pööre` ("indicative present singular, 1st person"). The
`api.sonapi.ee` response we use today also returns a short `code`, for example `SgN` and
`IndPrSg1`. Our current frontend transform already matches on those codes
(`snapshot/autocomplete.md` §2).

**The code → case mapping is already published.** The Eesthetic dataset
(`https://doi.org/10.5281/zenodo.14069724`, CC-BY-4.0, 15.23 MiB) contains a `cells` table. Each
row maps an Ekilex cell code to a Vabamorf cell code and to a plain linguistic label:
`SgN → nom.sg`, `SgG → gen.sg`, `SgP → part.sg`, `SgIll → ill.sg`, `IndPrSg1 → ind.prs.1sg`.
This is exactly the mapping work we would otherwise do by hand.

**Two ready-made Estonian datasets need no API key.** Both are worth a look before we build an
Ekilex client:

| dataset | content | licence | note |
|---------|---------|---------|------|
| `KristjanPikhof/Estonian-Wordlist-Enriched-Ekilex` | 160,316 base words, **5,454,775 inflected forms**, POS tags, CEFR levels, frequency ranks. Plain TSV files in the repository. | CC-BY-SA-4.0 (Ekilex part is CC-BY-4.0) | Forms are one comma-separated string per word, **without grammatical labels**. Good for suggestion lists and existence checks. Not enough for filling named cases. Snapshot 2026-04-01. |
| Eesthetic (`zenodo.org/records/14069724`) | 5,475 nouns × 28 cells and 5,076 verbs × 51 cells = 452,885 labeled forms | CC-BY-4.0 | Top 5000 by frequency only. **Fully labeled**, with the code mapping table. |

**Vabamorf** is the third option. It is an Estonian morphological analyzer and synthesizer,
released by Filosoft in 2015 under **LGPL**. Its `etsyn` command generates word forms from a
lemma, a part of speech and a cell. That is an offline replacement for the network call. It has
C++, Java and Python interfaces (`estnltk/pyvabamorf`), but no Node interface. It would need a
sidecar process.

**Recommended Estonian path:** ingest Eesthetic for the top-5000 labeled forms, use the Pikhof
list for suggestions and existence checks, and keep one HTTP fallback for the long tail. Which
fallback — `api.sonapi.ee` or the official Ekilex API — is an open question (section 10).

---

## 8. Licence

This section records the situation. It does not give legal advice.

| source | licence | obligation |
|--------|---------|-----------|
| Wiktextract / kaikki (Wiktionary text) | CC BY-SA 4.0, and GFDL for some parts | Attribution required. Share-alike applies to derived data. |
| Wikidata Lexemes | CC0 | None. |
| EKI Sõnaveeb / Ekilex content | CC BY 4.0 | Attribution required. |
| Eesthetic | CC-BY-4.0 | Attribution required. |
| Pikhof word list | CC-BY-SA-4.0 | Attribution required. Share-alike applies. |
| OdeNet | CC-BY-SA-4.0 | Attribution required. Share-alike applies. |
| RosaeNLG packages | Apache-2.0, MIT | Keep the notice. |
| `german-pos-dict` data | CC-BY-SA-4.0 | Already in use today. |
| Vabamorf | LGPL | Keep the library replaceable. A separate process is the simplest way. |

**Open item.** You said you want to think about this and possibly ask a lawyer. The two
questions that matter:

1. Does CC BY-SA 4.0 on Wiktionary-derived data oblige Ladu to share the derived lexicon table?
2. Is an attribution line in the app enough, or is more needed?

**This item does not block the interface work.** The unified route, the envelope and the
registry are licence-neutral. Only the *ingest* step depends on the answer.

---

## 9. Proposed slices

Do not start these without approval. Each slice must end with a runnable app and a green
`npm run test:e2e`, per `new-repo-build-plan.md` §6.

1. **Slice A — unify the seam.** Add `GET /api/dictionary/:lang/:pos/:query`. Keep all 8 old
   routes as thin wrappers or move their callers. Collapse the frontend registry to one entry
   point. No data change, no licence question. This alone removes most of the duplication.
2. **Slice B — ingest one language.** Build the ingest script and the `lexeme_form` table.
   Start with **German**, because the kaikki German sample I checked is complete for our needs
   and because it replaces two npm packages and their 18 MB of dictionaries.
3. **Slice C — add Spanish and English.** Same script, new case maps. Retire
   `rosaenlg-gender-es` and `is-word`. Keep `spanish-verbs` and `english-verbs-helper` as the
   generator fallback.
4. **Slice D — Estonian.** Ingest Eesthetic and the Pikhof list. Decide the long-tail fallback.
5. **Slice E — the browse feature.** Read the same table for free word browsing. Out of scope
   for now.

---

## 10. Open questions

1. **Licence.** Awaiting your decision, and possibly a lawyer's. See section 8.
2. **Ingest format.** Postgres table, or a single SQLite file shipped with the backend? The
   table is simpler for prefix search. A file is simpler to rebuild.
3. **Estonian fallback.** Keep `api.sonapi.ee`, or get an Ekilex API key and use the official
   route? The official route needs an account and a key. The community route needs nothing, but
   it is one person's project.
4. **Re-ingest cadence.** kaikki updates weekly. Do we want a script that a human runs, or a
   scheduled job?
5. **Adjectives and adverbs.** The new source makes them cheap to add. Is that in scope?

---

## Appendix A — evidence log

All checks were made on 2026-09-25.

| Claim | How it was checked |
|-------|--------------------|
| kaikki sense counts per language | `https://kaikki.org/dictionary/` index page |
| Dump sizes (EN 3,095 MiB, ES 989 MiB, DE 1,026 MiB, EE 52 MiB) | `Content-Length` header of each per-language JSONL |
| EE has 12,595 distinct word forms | `https://kaikki.org/dictionary/Estonian/index.html` |
| Form arrays for `bailar`, `tanzen`, `Haus`, `run`, `casa`, `maja` | Downloaded each entry page and parsed the embedded JSON |
| No English `future` or `conditional` form exists | Downloaded `run`, `walk`, `be`, `talk`; no form in any of them has a `future` or `conditional` tag |
| Every EN/ES/DE registry entry audited against real tags | Section 5.1; sources `snapshot/word-cases-data.md` and the downloaded entries above |
| Wiktextract lemma and inflection counts | Ylonen, *Wiktextract: Wiktionary as Machine-Readable Structured Data*, LREC 2022, Table 1 |
| Postprocessed JSONL is deprecated | Notice on each kaikki language page, linking to `tatuylonen/wiktextract` issue 1178 |
| Wikidata Lexeme counts | `https://www.wikidata.org/wiki/Wikidata:Lexicographical_data/Statistics/Counts_of_various_things_by_language` |
| OMW v1 wordnet table, and no German or Estonian | `https://omwn.org/omw1.html` and the `wns/` directory listing of `omwn/omw-data` |
| EstWN size | `https://cl.ut.ee/ressursid/teksaurus/` |
| Datamuse prefix search works with no key | `curl 'https://api.datamuse.com/words?sp=runn*&max=5'` |
| Ekilex API needs a key | `https://ekilex.ee/api/word/search/maja` returns 403 |
| Old Ekilex API wiki link is dead | `https://github.com/keeleinstituut/ekilex/wiki/Ekilex-API` returns 404 |
| Ekilex endpoint list, wildcard search, form search | `keeleinstituut/ekilex_documentation`, file `docs/api/api-kasutusjuhtumid.md` |
| Eesthetic size, licence, cell mapping | Zenodo record 14069724 and the paper `aclanthology.org/2024.lrec-main.491.pdf` |
| Pikhof dataset size and licence | Repository README `KristjanPikhof/Estonian-Wordlist-Enriched-Ekilex` |
| Vabamorf licence and generation tool | `https://github.com/Filosoft/vabamorf` and its `LICENSE` file ("Software is licensed under LGPL.") |
| Current source licences | `package.json` of each package in `node_modules/` |
| Estonian API URL | `.env` line 13 |
