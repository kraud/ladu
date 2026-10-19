# Onboarding pool

`pool.tsv` holds the concepts that the first-login onboarding can create as Words
(`.context/plans/onboarding.md`, Slice 2). The backend reads it with `lib/onboardingPool.ts` and
uses **only the lines with status `keep`**.

`backend/scripts/lexicon/onboarding-pool.ts` made the first version. The script does not change
this file again unless you run it with `--force`, which discards the review. Fresh candidates are
always written to the git-ignored `word-lists/pool-candidates.tsv` for comparison.

## Columns

| Column | Content |
|---|---|
| `status` | `keep` (used), `check` (the script found something to look at; not used until you set `keep`), `drop` (never used) |
| `id` | `<part of speech>:<English lemma>`, unique |
| `topic` | the primary topic: an id from `scripts/lexicon/onboarding-topics.ts`, or `core` (no topic) |
| `topics` | every topic of the concept, comma-separated, with the primary one in it (`food_drink,animals`). A Word gets one tag for each of its topics that the user picked, and `core` always gets its tag |
| `band` | `beginner`, `intermediate` or `advanced` (set by hand, not from the rank) |
| `pos` | `Noun`, `Verb`, `Adjective` or `Adverb` |
| `rank` | frequency rank of the English word (1 = most common) |
| `en`, `es`, `de`, `et` | the word in each language; empty = no word (the language is skipped for that concept) |
| `es_gender`, `de_gender` | noun gender: `el`, `la`, `el/la` / `der`, `die`, `das`; empty for other parts of speech |
| `sense` | the Wiktionary sense label the translations come from |
| `sense_key` | `<entry order>.<sense order>` of that sense in the translation hub, or `manual` (words typed by hand, no hub sense). Keeps a rebuild deterministic |
| `flags` | why a line is `check`: `sense:<entry>.<sense>` (not the first sense), `pos_order:<n>` (not the first part of speech on the page: maybe a homograph), `given_name`, `<lang>:regional`, `<lang>:not_in_lexicon` |

## How to review

The 2026-10 refresh replaced the first pool with the reviewed one (583 concepts; the decisions are in
`.context/onboarding-words-resolutions.md`). The topic `numbers_measures` now holds measures and
quantities only (label "Measures & quantities"); numerals are not in the pool. Five English nouns
exist only as a plural (`clothes`, `pants`, `news`, `data`, `stairs`): `onboarding-forms.ts` builds
their English forms from the word (`lib/onboardingPool.ts` `PLURAL_ONLY_NOUNS_EN`).

To add words from an explicit list instead of the word lists, run
`npx tsx scripts/lexicon/onboarding-pool.ts --entries <file>` (columns and rules: the header of that
script). It never changes this file: it writes the new candidates to `word-lists/pool-candidates.tsv`.

Open the file in a spreadsheet (tab-separated, UTF-8) or an editor. For each line:

1. Is the concept a good starter word for its topic and level? If not, set `drop`.
2. Do the words match the same meaning in every language (look at `sense`)? Correct a word or
   empty it. A line needs English and at least one other language.
3. For a `check` line, read `flags`, then set `keep` or `drop`.

Then, from `backend/`, run `npx tsx scripts/lexicon/onboarding-forms.ts` (it rebuilds
`pool-forms.json`, the precomputed forms; it needs the dev database with the lexicon and the Ekilex
key) and `npm test -- onboardingPool`: the test checks every line, names the id of a wrong one, and
fails while `pool-forms.json` does not match `pool.tsv`.

`first-review.md` lists the changes of the first review pass (2026-10-16), kept for reference.
Delete it before the onboarding feature is merged.

Spanish words are neutral where possible (used in Spain and Latin America); where no neutral word
exists, the Spain word (decision D19 in the plan).

## Attribution

Derived from English Wiktionary (https://en.wiktionary.org) via kaikki.org / Wiktextract,
CC BY-SA 4.0. Frequency ranks from FrequencyWords (github.com/hermitdave/FrequencyWords),
CC BY-SA 4.0. Topics from Open English WordNet (github.com/globalwordnet/english-wordnet),
CC BY 4.0, derived from Princeton WordNet (WordNet 3.0 Copyright 2006 by Princeton University).
This file is shared under CC BY-SA 4.0.
