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
| `topic` | an id from `scripts/lexicon/onboarding-topics.ts`, or `core` (no topic) |
| `band` | `beginner`, `intermediate` or `advanced` |
| `pos` | `Noun`, `Verb`, `Adjective` or `Adverb` |
| `rank` | frequency rank of the English word (1 = most common) |
| `en`, `es`, `de`, `et` | the word in each language; empty = no word (the language is skipped for that concept) |
| `es_gender`, `de_gender` | noun gender: `el`, `la`, `el/la` / `der`, `die`, `das`; empty for other parts of speech |
| `sense` | the Wiktionary sense label the translations come from |
| `flags` | why a line is `check`: `sense:<entry>.<sense>` (not the first sense), `pos_order:<n>` (not the first part of speech on the page: maybe a homograph), `given_name`, `<lang>:regional`, `<lang>:not_in_lexicon` |

## How to review

Open the file in a spreadsheet (tab-separated, UTF-8) or an editor. For each line:

1. Is the concept a good starter word for its topic and level? If not, set `drop`.
2. Do the words match the same meaning in every language (look at `sense`)? Correct a word or
   empty it. A line needs English and at least one other language.
3. For a `check` line, read `flags`, then set `keep` or `drop`.

Then run `npm test -- onboardingPool` from `backend/`: the test checks every line and names
the id of a wrong one.

## Attribution

Derived from English Wiktionary (https://en.wiktionary.org) via kaikki.org / Wiktextract,
CC BY-SA 4.0. Frequency ranks from FrequencyWords (github.com/hermitdave/FrequencyWords),
CC BY-SA 4.0. Topics from Open English WordNet (github.com/globalwordnet/english-wordnet),
CC BY 4.0, derived from Princeton WordNet (WordNet 3.0 Copyright 2006 by Princeton University).
This file is shared under CC BY-SA 4.0.
