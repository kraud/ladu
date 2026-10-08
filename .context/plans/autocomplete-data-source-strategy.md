# Autocomplete & lexical data sources — research record

*Status: research done (2026-09-25). Reviewed against the code and the per-slice plan written
2026-10-08 (sections 9 to 12). No code was written yet.*

*Scope: which free or very cheap source can supply the word-form autocomplete data, and
whether one source can replace the current per-language set of libraries and APIs.*

*Related: `.context/.frontend/snapshot/autocomplete.md` (the frozen 8-endpoint spec),
`.context/.frontend/snapshot/word-cases-data.md` (the case registry),
`.context/licence-study.md` (licence decisions, 2026-10-06), `new-repo-build-plan.md` §5 phase 3.*

*Read section 11 first. It lists the claims in sections 2 to 8 that the 2026-10-08 review
found wrong or incomplete.*

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

So a dictionary-backed source cannot replace a generator.

> **Correction (2026-10-08).** The first version of this section said that the current backend
> fills the whole form for a valid verb that no dictionary knows. That is wrong. Every EN, ES
> and DE route first checks the word with `is-word`. An unknown word gets `found: false`, and
> the generator never runs. Only the Spanish noun route returns a guess (`possibleMatch`). So
> the fallback below is **new behaviour**, not today's behaviour.

**Decision: keep the generators, use the dictionary as the first choice.** Look up the local
lexicon. If the lexicon has no row, fall back to the rule-based generator and return the
result as **`partial`**. The frontend already shows a notice for `partial` ("We're not fully
sure, but here's our best guess.", key `partialMatch`, all four locales). This adds coverage
and tells the user when the data is uncertain. It also fits the app model, because the app needs only a small,
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

> **Correction (2026-10-08).** The app does not store `will run`. The current controller
> removes the auxiliary (`extractVerb`) and stores only `run` in all 10 English
> future/conditional cases. So these 10 cases are a copy of the infinitive. (The conditional
> cases also call `SIMPLE_FUTURE`. That works only because the auxiliary is removed.)
> German is the same: the perfect cases store only the participle (`getanzt`), and Futur I
> stores only the infinitive. A kaikki form such as `habe getanzt` must have its auxiliary
> removed by the selector. The current code also always uses `haben`, which is wrong for
> verbs such as `gehen`. kaikki gives the correct auxiliary.

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

> **Update (2026-10-08).** `.context/licence-study.md` (2026-10-06) closes most of this
> item. CC BY-SA 4.0 allows commercial use. For German, option C was chosen: a separate table
> with `source` and `licence` columns, and no data download for users. The same rule applies
> to the EN and ES data from kaikki. One lawyer question is still open (licence study §7
> item 1). Extend it from German to EN and ES. Removing `is-word` also removes the GPL German
> word list (licence study action B9).
>
> **Effect on a paid tier.** No source in this plan has a non-commercial licence. A paid tier
> is possible. The limit is that the derived lexicon stays CC BY-SA: we can charge for
> access, but we cannot own the data exclusively. Before a paid tier, read the terms of the
> Estonian online fallback (`api.sonapi.ee` has none that I found; the Ekilex API terms are
> unread).

**Original open item.** You said you want to think about this and possibly ask a lawyer. The
two questions that matter:

1. Does CC BY-SA 4.0 on Wiktionary-derived data oblige Ladu to share the derived lexicon table?
2. Is an attribution line in the app enough, or is more needed?

**This item does not block the interface work.** The unified route, the envelope and the
registry are licence-neutral. Only the *ingest* step depends on the answer.

---

## 9. Slice plan (written 2026-10-08)

Do not start a slice without approval. Each slice starts with a plain-language overview
before any file changes. Each slice ends with a runnable app, its own tests and docs, and a
green `npm run test:e2e` (`new-repo-build-plan.md` §6). The known OAuth e2e failures
(oauth-2 to oauth-5, Google stub) are not caused by this work. Report them, but do not fix
them here.

**Order:** Slice 0 → A → B1 → B2 → C1 → C2 → D → **parity checkpoint** → E → F → H.
G and I have their own plans. Nothing after the parity checkpoint starts before the
checkpoint is met (decision D6 in section 10).

### Slice 0 — Measure coverage (no app change) — DONE 2026-10-08

**Result: `autocomplete-coverage-report.md`.** Go for EN, ES and DE; go with an online fallback
for Estonian. The findings for later slices are in its section 8 and are added below to
Slices A, C1, D and F.

**Goal.** Replace the 6-entry sample in §5.1 with real numbers before we build anything. This
closes Caveat B.

**What it does.**

1. Download the kaikki data for EN, ES and DE to a git-ignored folder
   (`backend/scripts/lexicon/.data/`). For a measurement, the deprecated per-language files are
   acceptable. The production ingest source is decided in Slice B1 (Q-B1).
2. Choose a public frequency list for EN, ES and DE. Candidate: `hermitdave/FrequencyWords`
   (OpenSubtitles 2018). Read its licence: the rank is shipped later (type-ahead order), so the
   licence matters. For Estonian, use the Pikhof list's frequency rank.
3. Map the list to lemmas and parts of speech. A frequency list holds inflected forms; use the
   kaikki `form_of` field to find the lemma. Keep the top 5,000 noun and verb lemmas per
   language.
4. Write the first version of the **selector tables** (one row per registry case:
   `caseName → required tags, excluded tags, auxiliary removal`) for EN, ES and DE, as data.
   Each selector gets a unit test. Slices B2, C1 and C2 reuse these tables.
5. For each lemma, record: which cases kaikki fills, which cases today's libraries fill, and
   whether `is-word` knows the word.
6. Measure Estonian: how many of the same top lemmas Eesthetic and Pikhof cover, and whether
   Eesthetic contains adjectives (it states nouns and verbs).
7. Measure translation coverage: for the English lemmas, how many senses have a
   `translations[]` entry for `es`, `de` and `et` (section 13).
8. Count the rows of the full filtered data set and estimate the database size (section 12).

**Output.** `.context/plans/autocomplete-coverage-report.md`: fill rate per case and per
language, the comparison with today, a go/no-go per language, the size estimate, and the
translation coverage. Scripts stay in `backend/scripts/lexicon/`.

**Done when.** The report exists, the selector tests pass, and `npm run test:e2e` is still
green.

### Slice A — One route, one response shape (no data change)

**Goal.** Remove the 8-way duplication. Behaviour stays exactly as today.

**Steps.** A1 backend (route, registry, adapters, Jest) — done 2026-10-08. A2 frontend switch and
delete the 8 old routes — done 2026-10-08 (`scripts/lexicon/measure.ts` now measures "today"
through the same adapters). A3 e2e spec with an Estonian stub server. Route path values are the
app's own enum values (`/api/dictionary/German/Noun/Haus`), decided 2026-10-08.

**Backend.**

- New route `GET /api/dictionary/:lang/:pos/:query`, behind `protect`. The Estonian verb keeps
  `?searchInEnglish=true`.
- Response: `200 { status: 'found' | 'partial' | 'not-found', cases: [{ caseName, word }] }`.
  This matches the frontend's existing `AutocompleteResult`. `400` for an unsupported
  language or part of speech. `502` when the Estonian service fails (as today).
- A registry maps `(lang, pos)` to an adapter. Adapters for this slice:
  `generator-en`, `generator-es`, `generator-de` (today's code, moved) and `eki`
  (`api.sonapi.ee` plus the 3 Estonian transforms, moved from the frontend to the backend).
- The `is-word` check stays. The Spanish noun still returns `partial` for an unknown word.
- Two fixes found by Slice 0: a library error returns `not-found`, not HTTP 500 (today 20.6%
  of frequent German nouns and 7.6% of German verbs crash); and each `is-word` list is loaded
  once, not on every request (about 27 ms per request today).
- Delete `autocompleteTranslationController.ts`, the 8 routes and their mount in `app.js`.
  Only the v2 frontend calls them (checked 2026-10-08), so no wrappers are needed.

**Frontend.**

- `features/autocomplete/api.ts`: one function, `lookupDictionary(lang, pos, query, extra?)`.
- `transforms.ts`: the registry keeps only `queryFieldName` and `extraFieldName`. The Estonian
  transforms and the generic transform are deleted.
- Update `types.ts` and the Mock Service Worker handler (`test/msw/autocompleteHandlers.ts`).

**Tests.**

- Jest: `tests/dictionary.test.js` replaces `tests/autocomplete.test.js`, with one block per
  adapter. The Estonian service stays mocked. Port the Estonian transform tests from
  `transforms.test.ts`.
- Vitest: update the autocomplete hook and the `AutocompleteRow` tests.
- E2E: a new spec for autocomplete (none exists today). It fills a German noun, a Spanish
  verb and an Estonian noun from the base form. The e2e backend must not call the real
  Estonian service: point `URL_EESTI_LANG_API` at a local stub, in the same way as the Google
  OAuth stub.

**Docs.** The route in the backend API docs and the spec index (`.context/README.md`). The
frozen snapshot files under `.context/.frontend/snapshot/` are not changed.

### Slice B1 — Lexicon tables, ingest and load (no user-visible change)

**Goal.** The German data reaches every environment's database.

- Migration: the `lexeme` and `lexeme_form` tables (section 12).
- `backend/scripts/lexicon/ingest`: reads the kaikki German data, applies the selector table,
  and writes one versioned file (for example `lexicon-de-2026-10-15.tsv.gz`). It runs on a
  developer machine, never on the VPS.
- `backend/scripts/lexicon/load`: loads one file into one database in a single transaction
  (replace all rows for that language) and records the version.
- Backup: `deploy/scripts/backup.sh` gets `--exclude-table-data` for the lexicon tables.
  The infrastructure guide (files 02 and 05) gets a step: after a restore, run `load`.
- Fixture: about 50 German lemmas, loaded into the test, CI and e2e databases.
- Tests: ingest unit tests on sample JSONL lines; a `load` integration test on
  `keelapp_test`.

Questions for the start of this slice: Q-B1, Q-B2, Q-B3 (section 10).

### Slice B2 — German from the lexicon

- The registry for DE noun and DE verb becomes a chain: `lexicon` → `generator-de`.
  Lexicon hit = `found`. Lexicon miss + generator result = `partial`. Both miss = `not-found`.
- The German existence check uses the lexicon, not `is-word`.
- The German perfect gets the correct auxiliary (`sein` or `haben`) from the data.
- The credits page (`landing/credits.html`) gets Wiktionary / kaikki (CC BY-SA 4.0).
- Tests: Jest for the three chain outcomes. E2E: a known noun fills as `found`; an unknown
  but plausible verb shows the `partialMatch` notice.

Question for the start of this slice: Q-B4 (homographs).

### Slice C1 — Spanish from the lexicon

- Selector table for 42 verb cases and 3 noun cases. Noun gender comes from `senses[].tags`.
- Chains: verb `lexicon` → `spanish-verbs`; noun `lexicon` → `rosaenlg-gender-es`. A
  generator result is `partial`. Slice 0 showed both generators are often wrong for irregular
  verbs and for gender (report §4), so the `partial` notice is essential here.
- Cases that today stay empty can now fill (gerund, conditional, imperatives). This is a
  side effect of the data, not a new part of speech, so it is inside parity scope.
- Tests and e2e as in B2.

### Slice C2 — English from the lexicon, remove `is-word`

- Selector table for 21 verb cases and 2 noun cases. The 10 future/conditional cases copy the
  infinitive (correction in §5.1).
- Chain: `lexicon` → `english-verbs-helper`.
- Remove the `is-word` package. This removes the GPL German word list (licence study action
  B9). Update the licence study, the credits page and the third-party notices.
- Run the Slice 0 measurement again. EN, ES and DE must fill at least the cases that today's
  libraries fill.

### Slice D — Estonian from local data

- Ingest Eesthetic (labelled forms, top ~5,000 nouns and verbs) and the Pikhof list
  (existence, part of speech, frequency) into the same tables. Use the Eesthetic `cells`
  table to map its codes to our case names. The codes are the same `sonapi` codes the
  transforms use today.
- Chain: `lexicon` → online fallback. A result from the online fallback is `found`, because
  it comes from a real dictionary, not from a rule.
- `searchInEnglish` stays on the online service in this slice.
- Slice 0 (report §5): Eesthetic covers all frequent verbs, about half of the frequent nouns
  and almost no adjectives. The online fallback serves a large share of lookups, not only
  rare words. 40,295 Eesthetic cells have more than one form and need a tie-break rule.
- Decide the online fallback (Q-D1). Credits: Eesthetic (CC BY 4.0), Pikhof list
  (CC BY-SA 4.0).

### Parity checkpoint

Every (language, part of speech) pair that has autocomplete today answers from the new route.
It fills at least the same cases as before, with the same or better results. The Slice 0
numbers prove it. Only after this checkpoint do Slices E, F and H start.

### Slice E — Type-ahead list

- While the user types in a query field (for example the German `infinitive`), a select list
  shows matching lemmas, ordered by frequency rank. A pick fills the form as before.
- Backend: `GET /api/dictionary/:lang/:pos?prefix=<text>&limit=10`. Prefix search with a
  B-tree index on `(lang, pos, search_key text_pattern_ops)`. Typo tolerance (`pg_trgm`) only
  if you ask for it later.
- Frontend: an accessible combobox on the query field. Minimum 2 characters, short debounce.
  It must not slow down typing (design commandment 1).
- E2E: type a prefix, pick a suggestion, see the form fill.

### Slice F — Translation table

- Ingest `translations[]` from the English entries into `lexeme_translation` (section 13).
- Route: `GET /api/dictionary/translate/:fromLang/:query` returns the senses and, for each
  sense, the candidate words per language with gender.
- Any of the 4 languages can be the start language (reverse lookup through English).
- Move the Estonian "search in English" to this path. The online service becomes the
  fallback.
- Slice 0 (report §6): EN↔ES and EN↔DE coverage is good (75–92%). Estonian is thin (11–58%),
  so Estonian translation needs a second source (for example Ekilex `api/meaning/search`) or
  must show that it is incomplete.

### Slice G — "One term → whole Word" (own plan)

The user types one word in any language. Ladu shows the senses, then builds a draft Word with
every translation and its forms in one step. The user confirms. This needs Slices E and F.
It gets its own plan document.

### Slice H — Adjectives and adverbs for EN, ES and DE

New selector tables and new form configurations. Planned after parity (decision D6). The Slice 0
measurement shows adjectives have good data in all three languages (DE full declension, ES gender and
number, EN comparative and superlative), so adjectives come first. The "reflexive" verb field
(decision D8) belongs to this slice too.

### Slice I — Browse all words (out of scope)

Reads the same tables. No plan yet.

---

## 10. Decisions and open questions

### Decisions

| # | Date | Decision |
|---|------|----------|
| D1 | 2026-10-06 | Licence: option C for CC BY-SA data (separate tables, `source` and `licence` columns, no data download for users). See `licence-study.md`. |
| D2 | 2026-10-08 | Lexicon miss + generator result = `partial`, shown with the existing `partialMatch` notice. |
| D3 | 2026-10-08 | Slice 0 uses a public frequency list, not production data (production data is too small). |
| D4 | 2026-10-08 | Storage: Postgres tables in each environment's database, excluded from the nightly backup, refilled by a load script from a versioned file. Not SQLite. |
| D5 | 2026-10-08 | Data scope: every noun and verb lemma that has forms, but only the forms that fill our case fields. Not a frequency subset. |
| D6 | 2026-10-08 | Type-ahead, translation and new parts of speech come after the parity checkpoint. |
| D7 | 2026-10-08 | Translation: measure in Slice 0, build in Slice F, "one term → whole Word" gets its own plan. Keep Estonian `searchInEnglish` until Slice F. |
| D8 | 2026-10-08 | Reflexive verbs: forms are stored **without** the reflexive pronoun (`sputen`, `personamos`), as today. A new "reflexive" field on the verb form is planned after parity (Slice H). kaikki can fill it: "always reflexive" from the lemma (DE infinitive `sich sputen`, ES lemma ending in `-se`), "reflexive in some senses" from the sense tag `reflexive`. The pronoun per person is then derived; for German, the verb-case field selects accusative (`mich`) or dative (`mir`). |
| D9 | 2026-10-08 | Separable German verbs keep today's joined form (`anruft`). German first-person singular follows standard grammar and today's library: `-ern` keeps the e (`sichere`), `-eln` drops it (`sammle`). |

### Open questions (ask at the start of the named slice)

| # | Slice | Question |
|---|-------|----------|
| Q-B1 | B1 | Production ingest source: the deprecated per-language files, the 23.5 GB raw file, or our own Wiktextract run? |
| Q-B2 | B1 | How does the versioned data file reach the VPS? A private B2 bucket, or a copy step in Ansible? (A public GitHub release conflicts with D1.) |
| Q-B3 | B1 | Re-ingest cadence: a script that a human runs (my recommendation, for example once per quarter), or a scheduled job? |
| Q-B5 | B1 | Table layout: one `lexeme_form` row per form (§12, about 460 MB), or one `jsonb` column of forms per `lexeme` with lemma copies not stored (about 176 MB)? Slice 0 recommends the `jsonb` layout (report §7). |
| Q-B4 | B2 | Homographs: one query can match more than one lemma (German `See` is `der` and `die`). Today we return one result. Return the most frequent one, or let the user choose? |
| Q-D1 | D | Online fallback for Estonian: keep `api.sonapi.ee`, or move to the official Ekilex API (needs an account, a key in the vault, and a read of its terms)? |

---

## 11. Review corrections (2026-10-08)

The review checked sections 2 to 8 against the code.

| # | The research said | The code shows | Effect |
|---|-------------------|----------------|--------|
| 1 | The generator fills any verb, even one with no dictionary entry (§5). | Every EN, ES and DE route checks `is-word` first. An unknown word gets `found: false`. | The fallback is new behaviour (D2). §5 is corrected. |
| 2 | 10 English future/conditional forms need `will`/`would` rule code. | The app stores only the bare verb. | The 10 cases copy the infinitive. §5.1 is corrected. |
| 3 | German perfect = `habe getanzt`. | The app stores only the participle and always uses `haben`. | The selector removes the auxiliary. `sein` verbs get the correct auxiliary. |
| 4 | 88 of 105 cases (84%) can be filled. | That compares kaikki to the registry. Today's routes fill fewer: ES 26 of 42, DE 25 of 28. | Compared with today, the change is a gain. |
| 5 | Keep the 8 old routes as wrappers (old Slice A). | Only the v2 frontend calls them. | Delete them in Slice A. |
| 6 | The licence question is open (§8). | `licence-study.md` closed most of it. | §8 is updated. |
| 7 | Paths `snapshot/...`. | The files are under `.context/.frontend/snapshot/`. | Header is corrected. |
| 8 | (not mentioned) | No e2e spec covers autocomplete. The e2e backend calls the real Estonian service. | Slice A adds a spec and a stub. |
| 9 | (not mentioned) | Both options need VPS disk. The nightly backup dumps all of `ladu_prod` to B2 (10 GB cap). No retention rule was found in the repo. | Exclude the lexicon from the backup (D4). Check the B2 retention setting in the B2 UI. |

**Offline behaviour.** Today EN, ES and DE call no outside service; the browser still needs our
backend. The new design keeps this, and Estonian improves (local data for the frequent
words). The network is still needed for the ingest download (once, on a developer machine),
for rare Estonian words, and for `searchInEnglish` until Slice F.

---

## 12. Data and storage design

**Tables** (names are proposals; final names in Slice B1):

| table | columns | note |
|-------|---------|------|
| `lexeme` | `id`, `lang`, `pos`, `lemma`, `search_key` (lowercase, no accents), `gender` (nullable), `freq_rank` (nullable), `source`, `licence`, `source_version` | One row per lemma and part of speech. Not unique on `(lang, pos, search_key)`: homographs exist (Q-B4). |
| `lexeme_form` | `lexeme_id`, `case_name`, `form` | Only forms that fill one of our case fields. Primary key `(lexeme_id, case_name)`. |
| `lexeme_translation` | (Slice F) English `lexeme_id`, sense gloss, target `lang`, `word`, tags | From `translations[]` in the English entries. |

**Not stored:** full paradigms, glosses, examples, audio, etymology.

**Where:** in `ladu_staging` and `ladu_prod` (and the local dev database). Test, CI and e2e
databases get a small fixture.

**Disk:** the VPS has 128 GB NVMe. Slice 0 measured about 460 MB per environment for this
layout, or about 176 MB for a `jsonb` layout (Q-B5, report §7). Both fit.

**Backup:** the lexicon tables are reference data that we can rebuild. The nightly dump skips
their data. After a restore, the `load` script refills them from the versioned file.

---

## 13. Translation (exploration for Slices F and G)

**Recommended source:** the `translations[]` field of the English kaikki entries.

- It is the same source and licence as the EN forms. We download it anyway. No network call
  at request time.
- Each translation belongs to one sense (for example "bank" as river bank, and "bank" as
  money bank). This matches the Ladu model: one Word is one concept.
- Translations often carry gender tags. They can fill `genderES` and `genderDE`.
- Reverse lookup makes every language a possible start: a Spanish word finds the English
  sense, and the English sense gives the German and Estonian words. All four languages are
  equal (design commandment 4).

**Rejected:**

- Machine-translation APIs (DeepL, Google): cost, no sense choice for a single word, and a
  network dependency.
- Self-hosted LibreTranslate: needs about 2 GB of RAM or more, and the VPS has 4 GB for both
  environments.

**Risk:** coverage, mostly for Estonian. Slice 0 measures it.

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
