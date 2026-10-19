# Onboarding vocabulary pool — resolutions after the questionnaire

**Status:** decisions from `.context/onboarding-words-questionnaire.md` are applied here.

## Decisions accepted

| # | Decision |
|---|---|
| Q1 | Replace the current `pool.tsv` after review. |
| Q2 | Keep an entry only with English + at least 2 target languages (ES/DE/ET) with usable forms. |
| Q3 | Keep the 15 topic ids and English labels. |
| Q4 | Keep `CORE_SHARE = 0.2`; core always eligible. |
| Q5 | Minimum 4 topics; **no maximum** (all 15 are allowed). |
| Q6 | The 620-entry set is final except for words that cannot be translated. |
| Q7 | Extend the generator to read an explicit entry list (lemma, POS, topic, band, rank). |
| Q8 | Drop `appliance`, `humidity`, `kilogram`, `total (n)`, `past (n)` (rank > 15,000). |
| Q9 | Generation scripts may change. |
| Q10 | Use the CEFR bands in the new list; do not re-derive from frequency. |
| Q11 | One concept, one topic, but a Word may receive more than one topic tag. |
| Q12–Q14 | Curate the sense; store `entry_order` + `sense_order`; review the 67 Appendix F entries. |
| Q15 | Use the proposed senses in the questionnaire table. |
| Q16–Q18 | Manual Spanish single-word replacements; drop when none exists; supply missing gender/form. |
| Q19–Q20 | Manual German words; use noun/verb generators; drop when no form is possible. |
| Q21–Q24 | Fill missing Estonian at pool-build time from Ekilex and freeze it in `pool.tsv`; runtime stays offline. |
| Q25 | Add a plural-only noun case to `KEY_CASES`; keep `clothes`, `data`, `news`, `pants`, `stairs`. |
| Q26 | Use the hub spellings: `kilometre`, `litre`, `neighbour`, `photograph`, `zip`. |
| Q27 | Replace multiword onboarding picks with single-word lemmas. |
| Q28 | Drop `internet`, `thousand`, `yes`. |
| Q29–Q31 | Record decisions here; produce a reviewed pool + forms + green tests; the agent proposes all missing words. |
| Q32 | Drop the numerals, keep the measures; rename the topic id `numbers_measures` to **“Measures & quantities”**. |

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

Forms verified against the Spanish lexicon. These replace the multiword picks from Appendix E.

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

- Q15: use the proposed senses in the questionnaire table.
- Appendix F: use the sense that matches the intended meaning, not simply the coverage-best sense.
  - **Keep the first sense:** `cost` (amount of money), `consider` (think seriously), `reach`
    (arrive at), `stay` (remain), `say` (say/tell), `start` (begin), `think` (ponder), `drink`
    (beverage), `camera` (still camera, both topics), `fly` (Diptera insect), `border` (frontier),
    `anxiety` (uneasiness).
  - **Use a third sense not shown in Appendix F:** `plane` → airplane `(2,0)`; `platform` → travel
    raised structure `(0,3)`; `degree` → temperature unit `(0,2)`; `zip` → clothing fastener
    (manual, no hub sense).
  - **All other Appendix F entries:** use the later sense shown in the appendix.

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

## Appendix G — answer

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

## Next slices

1. Review `word-lists/new-onboarding-pool-review.tsv` (data slice done).
2. Implement the code changes: explicit entry list, `topics` list/multi-tag, minimum 4 topics/no
   maximum, plural-only key cases, `entry_order`/`sense_order`.
3. Regenerate `pool-forms.json`, run `onboardingPool` + `onboardingSelect` tests, and smoke-test
   onboarding.

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
  quantities" in 4 languages) need the ES/DE/EE review of open item 8 in `plans/onboarding.md`.
- Tags: a concept gets a tag link for every topic in `topics` whose tag exists. A concept whose
  `topics` has `core` counts as core in the 20 % share (for example `run`, `go`, `work`), even when it
  was taken through its other topic. The tag word counts count a concept in each of its topics, so
  their sum can be more than the word count.
- `sense_key` is kept in the concept model (`PoolConcept.senseKey`). The forms lookup works from the
  words, not the sense, so `onboarding-forms.ts` does not use it. The generator writes it.
- Generator: `onboarding-pool.ts --entries <file>` (Q7) reads and validates an explicit list and never
  writes `pool.tsv`.
