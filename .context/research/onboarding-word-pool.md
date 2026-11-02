# Onboarding word pool: analysis, questions and decisions

Research record, kept whole. It merges three files of 2026-10-19 (the questionnaire, its resolutions, and a temporary audit of the old pool). The decisions are applied in code (see "Applied in code"). Live plan of the feature: `.context/features/onboarding.md`. Code that cites this file: `backend/lib/onboardingPool.ts`, `backend/scripts/lexicon/onboarding-pool.ts`, `backend/scripts/onboarding/README.md`. The applied pool, with the chosen sense of every concept, is `backend/scripts/onboarding/pool.tsv`.

## Starting point

Analysis of `word-lists/new-onboarding-values.md` (620 entries, 606 unique English lemma and part-of-speech pairs), before the decisions:

| Measure | First sense (current builder) | Best sense |
|---|---:|---:|
| Entries with ≥2 languages incl. English | 614 / 620 | 616 / 620 |
| Entries with ≥2 target languages (ES/DE/ET) | 568 / 620 | 602 / 620 |
| Entries with all 4 languages | 388 / 620 | 432 / 620 |
| ≥2 target languages with Estonian via Ekilex | 601 / 620 | — |

| Language | Translation available | Usable forms | Main weakness |
|---|---:|---:|---|
| English | 617 / 620 | 612 / 620 | 8 entries lack the required key case |
| Spanish | 597 / 620 | 570 / 620 | no online fallback; 25 picks are not in the lexicon |
| German | 607 / 620 | 580 / 620 | 27 picks need a generator or a manual word |
| Estonian | 493 / 620 | 423 / 620 | Ekilex adds 114 of 123 missing keys |

## Decisions accepted

Taken by the user on 2026-10-19. Each answer is the one marked in the questionnaire.

| # | Question | Decision |
|---|---|---|
| Q1 | Q1: What role should the new 620-entry list have? | Replace the current `pool.tsv` after review. |
| Q2 | Q2: What is the acceptance rule for one entry? | Keep an entry only with English + at least 2 target languages (ES/DE/ET) with usable forms. |
| Q3 | Q3: Keep the 15 topic ids and labels as they are? | Keep the 15 topic ids and English labels. |
| Q4 | Q4: Keep the 20% core allocation? | Keep `CORE_SHARE = 0.2`; core always eligible. |
| Q5 | Q5: Keep the current onboarding UI limits? | Minimum 4 topics; **no maximum** (all 15 are allowed). |
| Q6 | Q6: Is the 620-entry list final, or may we replace flagged words? | The 620-entry set is final except for words that cannot be translated. |
| Q7 | Q7: Ten entries are absent from `word-lists/en/*.tsv`, so the current generator cannot source them. | Extend the generator to read an explicit entry list (lemma, POS, topic, band, rank). |
| Q8 | Q8: Five entries have a frequency rank above 15,000 and would get no band. | Drop `appliance`, `humidity`, `kilogram`, `total (n)`, `past (n)` (rank > 15,000). |
| Q9 | Q9: May this work change the generation scripts? | Generation scripts may change. |
| Q10 | Q10: How should difficulty bands be assigned? | Use the CEFR bands in the new list; do not re-derive from frequency. |
| Q11 | Q11: Fourteen concepts appear in two topics, and some also have two different bands. `pool.tsv` requires one unique id per concept… | One concept, one topic, but a Word may receive more than one topic tag. |
| Q12–Q14 | Q12: How should the sense be chosen for each concept?<br>Q13: How should the chosen sense be recorded in `pool.tsv`?<br>Q14: What should we do with the 67 entries where a later sense gives more languages? | Curate the sense; store `entry_order` + `sense_order`; review the 67 entries where a later sense gave more languages. |
| Q15 | Q15: Confirm the high-impact sense corrections below (first sense is wrong or unhelpful). | Use the proposed senses (the applied senses are in `pool.tsv`). |
| Q16–Q18 | Q16: Twenty entries have no Spanish word in the first sense. What is the policy?<br>Q17: Twenty-five Spanish picks are not in the local lexicon (mostly multiword or reflexive phrases) and Spanish has no fallback.…<br>Q18: Two Spanish words exist but lack a required key case (`azúcar` has no gender, `arte` lacks a form). What should we do? | Manual Spanish single-word replacements; drop when none exists; supply missing gender/form. |
| Q19–Q20 | Q19: Ten entries have no German word in the first sense. What is the policy?<br>Q20: Twenty-seven German picks have no usable local row. German has noun/verb generators but no adjective/adverb fallback. What… | Manual German words; use noun/verb generators; drop when no form is possible. |
| Q21–Q24 | Q21: Should the onboarding pool builder use Ekilex to fill missing Estonian translations?<br>Q22: Nine words have no Estonian answer even from Ekilex. What should happen to them?<br>Q23: Seventy Estonian picks are not in the local Eesthetic lexicon (mostly adjectives/adverbs, plus some nouns/verbs). What should…<br>Q24: Is `EKILEX_API_KEY` available in the environment where the pool is generated? | Fill missing Estonian at pool-build time from Ekilex and freeze it in `pool.tsv`; runtime stays offline. |
| Q25 | Q25: Eight entries lack the required English key case (`singularEN`, `adverbEN`). | Add a plural-only noun case to `KEY_CASES`; keep `clothes`, `data`, `news`, `pants`, `stairs`. |
| Q26 | Q26: Five entries use a spelling the translation hub does not have. | Use the hub spellings: `kilometre`, `litre`, `neighbour`, `photograph`, `zip`. |
| Q27 | Q27: Twenty-eight first-sense translation picks are multiword phrases (18 ES, 9 DE, 1 ET). | Replace multiword onboarding picks with single-word lemmas. |
| Q28 | Q28: Three entries have no translation row at all: `internet (n)`, `thousand (n)`, `yes (adv)`. | Drop `internet`, `thousand`, `yes`. |
| Q29–Q31 | Q29: Where should the decisions be recorded?<br>Q30: Expected output of the next step?<br>Q31: Who supplies the missing Spanish/German/Estonian words? | Record decisions here; produce a reviewed pool + forms + green tests; the agent proposes all missing words. |
| Q32 | Q32: The Numbers & Measures topic tags numerals as nouns (`one (n)` … `thousand (n)`). The dictionaries store them as… | Drop the numerals, keep the measures; rename the topic id `numbers_measures` to **“Measures & quantities”**. |
## German values (C1, C2, C3)

Forms verified against the German lexicon or the German noun generator.

| Word | Proposed German | Status |
|---|---|---|
| shoulder (n) | Schulter | lexicon |
| suit (v) | passen | lexicon |
| zip (n) (was zipper) | Reißverschluss | lexicon |
| nervous (adj) | nervös | lexicon |
| generation (n) | Generation | lexicon |
| concert (n) | Konzert | lexicon |
| media (n) | Medium | lexicon |
| plane (n) | Flugzeug | lexicon |
| investment (n) | Investition | lexicon |
| breath (n) | Atem | lexicon |
| treatment (n) | Behandlung | lexicon |
| clothes (n) | Kleidung | lexicon |
| slipper (n) | Hausschuh | lexicon |
| change (v) | ändern | lexicon |
| main (adj) | wichtig | lexicon |
| move (v) | bewegen | lexicon |
| remember (v) | erinnern | lexicon |
| stay (v) | bleiben | lexicon |
| turn (v) | drehen | lexicon |
| trust (n) | **drop the word** — `Vertrauen` has no forms; `Zuversicht` is not the same meaning | dropped |
| worry (v) | sorgen | lexicon |
| pasta (n) | Nudel | lexicon |
| percent (n) | Prozent | lexicon |
| cousin (n) | Cousin | lexicon |
| champion (n) | Meister | lexicon |
| player (n) | Spieler | generator (partial, usable) |
| reader (n) | Leser | generator (partial, usable) |
| score (n) | Ergebnis | lexicon |
| digital (adj) | digital | lexicon |
| news (n) | Nachricht | lexicon |
| password (n) | Passwort | lexicon |
| phone (n) | Telefon | lexicon |
| schedule (n) | Zeitplan | lexicon |
| income (n) | Einkommen | generator (partial, usable) |
| worker (n) | Arbeitnehmer | lexicon |
| cost (n) | Kosten | generator (found; singular form available) |

## Spanish values (B1, B2, B3)

Forms verified against the Spanish lexicon. These replace the multiword first-sense picks of the questionnaire (its Appendix E, kept in git only).

| Word | Proposed Spanish | Status |
|---|---|---|
| fit (v) | ajustar | lexicon |
| allow (v) | permitir | lexicon |
| do (v) | hacer | lexicon |
| fast (adj) | rápido | lexicon |
| require (v) | requerir | lexicon |
| start (v) | empezar | lexicon |
| anxiety (n) | ansiedad | lexicon |
| sad (adj) | triste | lexicon |
| stress (n) | estrés | lexicon |
| drink (n) | bebida | lexicon |
| cousin (n) | primo | lexicon |
| online (adj) | conectado | lexicon |
| schedule (n) | horario | lexicon |
| border (n) | frontera | lexicon |
| platform (n) | andén | lexicon |
| industry (n) | industria | lexicon |
| nurse (n) | enfermero | lexicon |
| sock (n) | calcetín | lexicon |
| wear (v) | llevar | lexicon |
| agree (v) | acordar | lexicon |
| become (v) | convertir | lexicon |
| break (v) | romper | lexicon |
| develop (v) | desarrollar | lexicon |
| move (v) | mover | lexicon |
| need (v) | necesitar | lexicon |
| reach (v) | alcanzar | lexicon |
| remember (v) | recordar | lexicon |
| sit (v) | sentar | lexicon |
| afraid (adj) | asustado | lexicon |
| like (v) | gustar | lexicon |
| mood (n) | humor | lexicon |
| worry (v) | preocupar | lexicon |
| percent (n) | porcentaje | lexicon |
| party (n) | fiesta | lexicon |
| app (n) | aplicación | lexicon |
| late (adj) | tardío | lexicon |
| freeze (v) | congelar | lexicon |
| weather (n) | clima | lexicon |
| sugar (n) | azúcar, gender `el/la` | lexicon (gender supplied) |
| art (n) | arte, gender `el` | lexicon (gender supplied) |

Number words (`one` … `ten`, `hundred`, `thousand`, `zero`, `half`) are dropped. The
`numbers_measures` topic keeps measures and quantities and is relabelled **“Measures & quantities”**.

## Estonian

- Use Ekilex at pool-build time for the 123 unique keys missing an Estonian word; freeze the result
  in `pool.tsv`.
- Prefer the first **single-word** Ekilex result. If Ekilex returns only multiword phrases, leave
  Estonian empty for that entry (allowed).
- Ignore the nine words with no Ekilex answer; keep them without Estonian.
- Drop `try on` (multiword, no word-list row, no Estonian).

## Senses

- Q15: the proposed senses were accepted. The applied sense of every concept is in `backend/scripts/onboarding/pool.tsv` (columns `sense` and `sense_key`).
- The 67 entries where a later sense gave more languages (the old Appendix F): use the sense that matches the intended meaning, not simply the coverage-best sense.
  - **Keep the first sense:** `cost` (amount of money), `consider` (think seriously), `reach`
    (arrive at), `stay` (remain), `say` (say/tell), `start` (begin), `think` (ponder), `drink`
    (beverage), `camera` (still camera, both topics), `fly` (Diptera insect), `border` (frontier),
    `anxiety` (uneasiness).
  - **Use a third sense that the old list did not show:** `plane` → airplane `(2,0)`; `platform` → travel
    raised structure `(0,3)`; `degree` → temperature unit `(0,2)`; `zip` → clothing fastener
    (manual, no hub sense).
  - **All other entries of that list:** use the later sense (the applied sense is in `pool.tsv`).

## Duplicate concepts (Q11)

One concept keeps one primary topic, but a Word may receive more than one topic tag. Proposed
representation: replace the pool's single `topic` column with `topics` (comma-separated). Selection
is eligible when any listed topic is picked; word creation adds a tag for each picked topic.

Duplicates and the recommended primary topic/band:

| Concept | Recommended primary | Second topic | Band |
|---|---|---|---|
| call (v) | Core | Technology & Media | Intermediate |
| camera (n) | Technology & Media | Sports & Hobbies | Intermediate |
| chicken (n) | Food & Drink | Animals | Beginner |
| climate (n) | Weather | Plants & Nature | Advanced |
| fast (adj) | Core | Travel & Transport | Beginner |
| fish (n) | Animals | Food & Drink | Beginner |
| go (v) | Core | Travel & Transport | Beginner |
| live (v) | Core | Home & Living | Intermediate |
| neighbour (n) | People & Family | Home & Living | Intermediate |
| new (adj) | Core | Clothing | Beginner |
| pay (v) | Core | Work & Money | Intermediate |
| run (v) | Sports & Hobbies | Core | Beginner |
| sun (n) | Weather | Plants & Nature | Beginner |
| work (v) | Work & Money | Core | Beginner |

## Entries the generator could not source (questionnaire Appendix G)

It is informative; no input is needed. It tells us:

- Q7 already covers the 10 words without a word-list row: the generator will accept explicit entries.
- Q8 drops the 5 rank > 15,000 entries.
- Q10 settles the band mismatch: use the new CEFR bands.
- The word-list gaps do not need a new frequency source.

## Review data file

`word-lists/new-onboarding-pool-review.tsv` (git-ignored) is the applied data slice: 583 concepts
after drops, spelling changes and duplicate merges.

- Columns: `status`, `id`, `topic` (primary), `topics` (comma-separated, for multi-tag), `band`,
  `pos`, `rank`, `en`, `es`, `es_gender`, `de`, `de_gender`, `et`, `sense`, `sense_key`, `flags`.
- 14 concepts carry two topics; the primary topic is the one in `topic`.
- 199 beginner / 200 intermediate / 184 advanced.
- The actual `draft` lookup was run for every row: all 583 have at least 3 usable languages. The
  only failures are the five plural-only English nouns (`pants`, `clothes`, `news`, `data`,
  `stairs`), which the Q25 plural-only key case will fix.
- 16 entries remain in `numbers_measures`; the topic now contains measures and quantities only and
  needs the label **“Measures & quantities”**.
- `trust`, `try on`, `internet`, `thousand`, `yes`, the numerals and the Q8 five are absent.

## Applied in code (2026-10-19)

The data slice is now the runtime pool. Facts that differ from, or add to, the text above:

- `backend/scripts/onboarding/pool.tsv` = the review file with one change: the `band` values are
  lower-case (`beginner`, `intermediate`, `advanced`), as the code and the old pool use them. Counts in
  the file: 199 beginner / 201 intermediate / 183 advanced (the review note says 200 / 184).
- In 9 of the 14 multi-topic concepts, the primary topic is not the first in `topics` (for
  example `fish`: primary `animals`, topics `food_drink,animals`). The parser only needs the primary
  topic to be in the list.
- Plural-only English nouns (Q25): the English lexicon has **no noun entry** for them, so the draft
  lookup answers `not-found`; the five were not failing a key case. `onboarding-forms.ts` now builds
  their forms from the word (`singularEN` and `pluralEN` = the word; the word list shows `singularEN`).
  `hasKeyCases` accepts `pluralEN` instead of `singularEN` only for those five words. Any other noun
  still needs its singular.
- Topic limits: minimum 4, no maximum, in the backend and the app. The locale folder for Estonian is
  `ee`, not `et`. New strings (`topics.countLow`, `countOk_one/_other`, the label "Measures &
  quantities" in 4 languages) need the ES/DE/EE review of open item 8 in `.context/features/onboarding.md`.
- Tags: a concept gets a tag link for every topic in `topics` whose tag exists. A concept whose
  `topics` has `core` counts as core in the 20 % share (for example `run`, `go`, `work`), even when it
  was taken through its other topic. The tag word counts count a concept in each of its topics, so
  their sum can be more than the word count.
- `sense_key` is kept in the concept model (`PoolConcept.senseKey`). The forms lookup works from the
  words, not the sense, so `onboarding-forms.ts` does not use it. The generator writes it.
- Generator: `onboarding-pool.ts --entries <file>` (Q7) reads and validates an explicit list and never
  writes `pool.tsv`.

## What was dropped from the three source files

- The questionnaire's options and reasoning for each question, and its appendices A to F (gap tables for Spanish, German and Estonian, the multiword picks, the 67 sense entries). Their results are in the decisions above and in `pool.tsv`.
- The audit file `onboarding-words-audit` ("temporary": a list of the old pool's concepts, word lists and quality flags, made before the decisions).
- Read them with `git log -- .context/onboarding-words-questionnaire.md` (and the audit and resolutions paths).
