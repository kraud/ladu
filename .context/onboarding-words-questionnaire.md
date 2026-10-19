# Onboarding vocabulary pool — decision questionnaire

**Purpose:** answer the open decisions from the coverage analysis of `word-lists/new-onboarding-values.md` (620 entries, 606 unique English lemma + POS).
**How to answer:** mark one option with `[x]` and/or write on the `Answer:` line under each question. You can also write a free-form answer instead of marking a box.
**Recommended** options are listed first and marked. Recommendation logic: keep the reviewed pool deterministic and offline, prefer curated single-word translations, and do not silently drop words the user selected.

Reference data: `backend/scripts/onboarding/pool.tsv` (current reviewed pool, 698 `keep`), `word-lists/en/*.tsv` (generator source), `backend/scripts/onboarding/pool-forms.json` (precomputed forms), `backend/services/onboarding/select.ts` (runtime selection).

## Summary of the analysis

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

---

## A. Scope and cutover

### Q1. What role should the new 620-entry list have?
- [x] **(Recommended)** Replace the current `pool.tsv` content after review; keep the same file and columns.
- [ ] Keep the current pool; use the new list only as candidates for the next review pass.
- [ ] Merge the new list into the current 698 `keep` concepts.
- [ ] Something else.

`Answer:`

### Q2. What is the acceptance rule for one entry?
- [x] **(Recommended)** Keep an entry only when the selected sense has English + at least 2 target languages (ES/DE/ET) with usable forms.
- [ ] English + at least 1 target language is enough.
- [ ] Require all four languages.
- [ ] Per topic, not per entry.

`Answer:`

### Q3. Keep the 15 topic ids and labels as they are?
- [x] **(Recommended)** Yes: same ids (`clothing`, `food_drink`, …, `people_family`) and the same English labels; map the new labels (`Food & Drink`, `Plants & Nature`, `Feelings & Mind`) to them.
- [ ] Rename topic ids.
- [ ] Change the number or order of topics.

`Answer:`

### Q4. Keep the 20% core allocation?
- [x] **(Recommended)** Yes: `CORE_SHARE = 0.2`, core always eligible, 100 core concepts in the new list.
- [ ] Change to 15%.
- [ ] Change to 25%.
- [ ] Use the 100 core words as a fixed block instead of a percentage.

`Answer:`

### Q5. Keep the current onboarding UI limits?
- [ ] **(Recommended)** Yes: 3–6 topics, 50–150 words, step 10.
- [x] Change the topic minimum/maximum. => No maximum, change minimum to 4 
- [ ] Change the word-count range.

`Answer:`

### Q6. Is the 620-entry list final, or may we replace flagged words?
- [x] **(Recommended)** Final as a set; we may replace words that cannot be translated (listed in this questionnaire).
- [ ] Final as-is; do not add or remove words.
- [ ] Open to broader editing of the list.

`Answer:`

## B. Sourceability and generator

### Q7. Ten entries are absent from `word-lists/en/*.tsv`, so the current generator cannot source them.
Missing: `pants (n)`, `clothes (n)`, `try on (v)`, `news (n)`, `data (n)`, `stairs (n)`, `thousand (n)`, `double (adj)`, `main (adj)`, `yes (adv)`.
- [x] **(Recommended)** Extend the generator to accept an explicit entry list (lemma, POS, topic, band, rank) instead of requiring a word-lists row.
- [ ] Keep the generator as-is and add these entries by hand to `pool.tsv` only.
- [ ] Drop these 10 entries from the new list.

`Answer:`

### Q8. Five entries have a frequency rank above 15,000 and would get no band.
`appliance (n)`, `humidity (n)`, `kilogram (n)`, `total (n)`, `past (n)`.
- [ ] **(Recommended)** Allow an explicit band in the entry list; keep the proposed CEFR band.
- [x] Drop these 5 entries.
- [ ] Extend the frequency bands to 20,000.

`Answer:`

### Q9. May this work change the generation scripts?
- [x] **(Recommended)** Yes: `scripts/lexicon/onboarding-pool.ts` and `word-lists.ts` may be changed to read the new explicit list.
- [ ] Data only: edit `pool.tsv` and `pool-forms.json`; do not change scripts.
- [ ] No changes yet; produce a separate reviewed TSV only.

`Answer:`

### Q10. How should difficulty bands be assigned?
- [x] **(Recommended)** Use the CEFR bands printed in the new list; do not re-derive them from frequency rank.
- [ ] Re-derive from the frequency rank (beginner ≤ 2000, intermediate ≤ 6000, advanced ≤ 15000).
- [ ] Use frequency rank for order, CEFR only as a label.

`Answer:`

## C. Duplicate concepts across topics

### Q11. Fourteen concepts appear in two topics, and some also have two different bands. `pool.tsv` requires one unique id per concept and `selectConcepts` tags a Word with one topic. What is the policy?
- [ ] **(Recommended)** One concept = one topic + one band. Use the recommended home in the table below; delete the other occurrence.
- [ ] Allow the same concept in two topics with topic-qualified ids (requires code and schema changes).
- [ ] Keep the first occurrence only; no manual table.
- [x] One concept = one topic, with more than 1 tag assigned to that word.

`Answer:`

| Concept | Occurrence 1 | Occurrence 2 | Recommended home | Your choice |
|---|---|---|---|---|
| call (v) | Technology & Media / Beginner | Core / Intermediate | Core / Intermediate | |
| camera (n) | Technology & Media / Intermediate | Sports & Hobbies / Intermediate | Technology & Media / Intermediate | |
| chicken (n) | Food & Drink / Beginner | Animals / Intermediate | Food & Drink / Beginner | |
| climate (n) | Plants & Nature / Advanced | Weather / Advanced | Weather / Advanced | |
| fast (adj) | Travel & Transport / Intermediate | Core / Beginner | Core / Beginner | |
| fish (n) | Food & Drink / Intermediate | Animals / Beginner | Animals / Beginner | |
| go (v) | Travel & Transport / Beginner | Core / Beginner | Core / Beginner | |
| live (v) | Home & Living / Beginner | Core / Intermediate | Core / Intermediate | |
| neighbor (n) | Home & Living / Advanced | People & Family / Intermediate | People & Family / Intermediate | |
| new (adj) | Clothing / Beginner | Core / Beginner | Core / Beginner | |
| pay (v) | Work & Money / Beginner | Core / Intermediate | Core / Intermediate | |
| run (v) | Sports & Hobbies / Beginner | Core / Intermediate | Sports & Hobbies / Beginner | |
| sun (n) | Plants & Nature / Intermediate | Weather / Beginner | Weather / Beginner | |
| work (v) | Work & Money / Beginner | Core / Intermediate | Work & Money / Beginner | |

## D. Sense selection

### Q12. How should the sense be chosen for each concept?
- [x] **(Recommended)** Curate the sense per concept, with the coverage analysis as an assist (67 entries would change).
- [ ] Keep the current rule: first sense with a translation.
- [ ] Automatically use the sense with the most language coverage.
- [ ] Rank senses by a new heuristic (frequency, translation count, tag quality).

`Answer:`

### Q13. How should the chosen sense be recorded in `pool.tsv`?
- [x] **(Recommended)** Add `entry_order` and `sense_order` columns (or one `sense_key` such as `0.3`) so regeneration is deterministic.
- [ ] Keep only the free-text `sense` column.
- [ ] Keep the text and add the key.

`Answer:`

### Q14. What should we do with the 67 entries where a later sense gives more languages?
- [x] **(Recommended)** Review them one by one; Appendix C lists them.
- [ ] Automatically switch to the later sense.
- [ ] Ignore; keep the first sense.

`Answer:`

### Q15. Confirm the high-impact sense corrections below (first sense is wrong or unhelpful).
| Word | First sense (current) | Proposed sense | Your decision |
|---|---|---|---|
| do (v) | in questions | perform, execute | Proposed sense (PS) |
| fast (adj) | firmly or securely fixed in place | moving or capable of moving with great speed | PS |
| sad (adj) | of colours: dark, sombre, dull | feeling sorrow | PS |
| phone (n) | speech segment | device for communication | PS |
| zipper (n) | high-pitched sound | fastener for clothing | PS |
| date (n) | fruit of the date palm | point of time | PS |
| room (n) | space | division in a building | PS |
| job (n) | task | economic role for which a person is paid | PS |
| office (n) | ceremonial religious duty or rite | room(s) or building used for non-manual work | PS |
| team (n) | set of draught animals | group of people | PS |
| press (n) | device used to apply pressure | printed media | PS |
| screen (n) | physical divider | viewing area of electronic output device | PS |
| network (n) | fabric or structure of fibrous elements | connected computers/devices | PS |
| platform (n) | stage for speeches and performances | railway platform (not political stance) | PS |
| degree (n) | academic award | temperature unit (weather) | PS |
| schedule (n) | appendix to a statute | procedural plan/timetable | PS |
| score (n) | number of points earned | result/points in a game | PS |
| concert (n) | agreement in a design or plan | musical performance | PS |
| party (n) | law: side in a contract/legal action | social gathering | PS |
| camera (n) | still camera | device for taking photographs | PS |

## E. Spanish

### Q16. Twenty entries have no Spanish word in the first sense. What is the policy?
- [x] **(Recommended)** Provide a manual Spanish word for each; drop the entry when no good single word exists.
- [ ] Accept the entry without Spanish; it can still be learned from EN/DE/ET.
- [ ] Drop the entry from onboarding.

`Answer:`

### Q17. Twenty-five Spanish picks are not in the local lexicon (mostly multiword or reflexive phrases) and Spanish has no fallback. What is the policy?
- [x] **(Recommended)** Replace with a single-word Spanish lemma where one exists; drop the entry otherwise.
- [ ] Accept the entry without Spanish.
- [ ] Allow multiword translation entries (requires forms/word-creation changes).

`Answer:`

### Q18. Two Spanish words exist but lack a required key case (`azúcar` has no gender, `arte` lacks a form). What should we do?
- [x] **(Recommended)** Supply the missing gender/form by hand in the pool.
- [ ] Drop both entries.
- [ ] Accept them without Spanish.

`Answer:`

## F. German

### Q19. Ten entries have no German word in the first sense. What is the policy?
- [x] **(Recommended)** Manual German word for each; drop when no good single word exists.
- [ ] Accept without German.
- [ ] Drop the entry.

`Answer:`

### Q20. Twenty-seven German picks have no usable local row. German has noun/verb generators but no adjective/adverb fallback. What should we do?
- [x] **(Recommended)** Keep the generator output for nouns/verbs; replace adjectives/adverbs manually; drop if no form can be produced.
- [ ] Only keep picks present in the local lexicon.
- [ ] Accept without German.

`Answer:`

## G. Estonian

### Q21. Should the onboarding pool builder use Ekilex to fill missing Estonian translations?
- [x] **(Recommended)** Yes, at pool-build time only: ask Ekilex for the missing Estonian word, then freeze it in `pool.tsv`. Onboarding stays offline at runtime.
- [ ] No: keep the offline Wiktionary hub only, and drop or accept the 124 entries without Estonian.
- [ ] Call Ekilex at runtime during onboarding.

`Answer:`

### Q22. Nine words have no Estonian answer even from Ekilex. What should happen to them?
`afraid (adj)`, `bored (adj)`, `scared (adj)`, `tropical (adj)`, `urgent (adj)`, `breath (n)`, `delight (n)`, `dirt (n)`, `try on (v)`.
- [x] **(Recommended)** Drop `try on` and provide a manual Estonian word for the other eight.
- [ ] Drop all nine.
- [ ] Keep them without Estonian.

`Answer:`

### Q23. Seventy Estonian picks are not in the local Eesthetic lexicon (mostly adjectives/adverbs, plus some nouns/verbs). What should we do?
- [x] **(Recommended)** Rely on the existing Ekilex form lookup in `onboarding-forms.ts`; keep the word if forms are found.
- [ ] Replace with words present in Eesthetic.
- [ ] Drop the entry when the local lexicon lacks it.

`Answer:`

### Q24. Is `EKILEX_API_KEY` available in the environment where the pool is generated?
- [x] **(Recommended)** Yes (it is already used by `onboarding-forms.ts`).
- [ ] No, only in production.
- [ ] Do not depend on it.

`Answer:`

## H. English forms, spelling and multiword

### Q25. Eight entries lack the required English key case (`singularEN`, `adverbEN`).
`clothes`, `data`, `news`, `pants`, `stairs` are plural-only nouns; `thousand`, `internet`, `yes` also lack a form.
- [x] **(Recommended)** Add a plural-only noun case to `KEY_CASES`; keep the words.
- [ ] Accept missing English forms; the concept can still use the other languages.
- [ ] Replace or drop these entries.

`Answer:`

### Q26. Five entries use a spelling the translation hub does not have.
`kilometer` → `kilometre`, `liter` → `litre`, `neighbor` → `neighbour`, `photo (n)` → `photograph`, `zipper` → `zip`.
- [ ] **(Recommended)** Keep the proposed spelling in the pool and add an alias map when reading the hub.
- [x] Change the new list to the hub spellings.
- [ ] Drop the entries.

`Answer:`

### Q27. Twenty-eight first-sense translation picks are multiword phrases (18 ES, 9 DE, 1 ET).
- [x] **(Recommended)** Replace them with single-word lemmas for onboarding; allow multiword phrases in the general autocomplete.
- [ ] Allow multiword translations in onboarding (requires forms and word-creation work).
- [ ] Drop the affected entries.

`Answer:`

### Q28. Three entries have no translation row at all: `internet (n)`, `thousand (n)`, `yes (adv)`.
- [ ] **(Recommended)** Provide manual translations for Spanish/German/Estonian, or replace with `the Internet`, `a thousand`, `yes` (noun) as appropriate.
- [x] Drop them.
- [ ] Accept without translations.

`Answer:`

## I. Output and validation

### Q29. Where should the decisions be recorded?
- [x] **(Recommended)** In this questionnaire, then summarized in `.context/onboarding-words-audit.md` and applied to the new list.
- [ ] Only in this questionnaire.
- [ ] In a new plan file.

`Answer:`

### Q30. Expected output of the next step?
- [x] **(Recommended)** A reviewed `pool.tsv`, regenerated `pool-forms.json`, and green `onboardingPool` + `onboardingSelect` tests.
- [ ] Only a reviewed TSV; no forms regeneration yet.
- [ ] A code change first (generator/sense policy), then regeneration.

`Answer:`

### Q31. Who supplies the missing Spanish/German/Estonian words?
- [ ] **(Recommended)** You (or a native-speaker check) for the short list; the agent prepares proposals and the table.
- [x] The agent proposes every word; you only approve.
- [ ] Defer the missing words; implement the pipeline first.

`Answer:`

## J. Additional structural issue

### Q32. The Numbers & Measures topic tags numerals as nouns (`one (n)` … `thousand (n)`). The dictionaries store them as numerals/determiners, so the noun forms lookup often fails (for example Spanish `uno`, `tres`, `seis` are not nouns). How should numbers be handled?
- [ ] **(Recommended)** Keep the English noun tag, but let the forms lookup fall back to the numeral/determiner entry for the target language.
- [x] Drop the numbers from onboarding.
- [ ] Add a new `Numeral` part of speech (schema, lookup, UI change).
- [ ] Manually supply forms for all 32 numbers.

`Answer:`

---

## Appendix A — Hard data gaps

**A1. No translation row at all:** `internet (n)`, `thousand (n)`, `yes (adv)`.

**A2. Hub spelling variants:** kilometer→kilometre, liter→litre, neighbor→neighbour, photo→photograph, zipper→zip.

**A3. English key-case gaps:** clothes, data, news, pants, stairs, thousand, internet, yes.

## Appendix B — Spanish gap tables

### B1. No Spanish word in the first sense (20)
| Topic | Band | POS | Word | First sense | Your decision / Spanish word |
|---|---|---|---|---|---|
| clothing | Intermediate | Verb | fit | to be suitable for | encajar |
| core | Advanced | Verb | allow | to let one have | permitir|
| core | Beginner | Verb | do | in questions | hacer|
| core | Beginner | Adjective | fast | firmly or securely fixed in place | asegurado|
| core | Advanced | Verb | require | to demand, call for authoritatively | requerir|
| core | Beginner | Verb | start | to begin | empezar|
| feelings | Advanced | Noun | anxiety | state of uneasiness, nervousness, apprehension and obsession | ansiedad|
| feelings | Beginner | Adjective | sad | of colours: dark, sombre, dull | triste|
| feelings | Advanced | Noun | stress | (physics) internal force across a boundary per area | estrés|
| food_drink | Beginner | Noun | drink | served beverage | bebida|
| numbers_measures | Beginner | Noun | eight | The digit/figure 8 | -numbers won't be included-|
| numbers_measures | Beginner | Noun | five | digit |  -numbers won't be included-|
| numbers_measures | Beginner | Noun | hundred | hundred-dollar (-euro, etc.) bill |  -numbers won't be included-|
| people_family | Intermediate | Noun | cousin | any relation (especially a distant one) who is not a direct ancestor or descendant but part of a person’s extended family | primo|
| technology_media | Intermediate | Adjective | online | connected to a network | conectado|
| time_calendar | Intermediate | Noun | schedule | a table of information forming appendix to a statute, other regulatory instrument or legal contract | cronograma|
| travel_transport | Intermediate | Noun | border | the line or frontier area separating various territories | frontera|
| travel_transport | Intermediate | Adjective | fast | firmly or securely fixed in place | rápido|
| travel_transport | Advanced | Noun | platform | stage for speeches and performances | plataforma|
| work_money | Advanced | Noun | industry | tendency to work persistently | industrioso - THIS ONLY WORKS FOR ADJECTIVE - otherwise that sense does not fit the industry noun|

### B2. Spanish pick not in the lexicon (25) // if no answer is given, use your pick
| Topic | Band | POS | Word | Spanish pick | Your decision / replacement |
|---|---|---|---|---|---|
| body_health | Advanced | Noun | nurse | enfermera | |
| clothing | Beginner | Noun | sock | soquete | |
| clothing | Beginner | Verb | wear | llevar (puesto) | |
| core | Advanced | Verb | agree | estar de acuerdo | |
| core | Intermediate | Verb | become | volverse | |
| core | Advanced | Verb | break | romperse | |
| core | Advanced | Verb | develop | desarrollarse | |
| core | Intermediate | Verb | move | moverse | |
| core | Beginner | Verb | need | necesitar/precisar (de) | necesitar|
| core | Advanced | Verb | reach | llegar a | alcanzar|
| core | Advanced | Verb | remember | acordarse/arrecordarse/alcordarse de | recordar|
| core | Intermediate | Verb | sit | sentarse | |
| feelings | Beginner | Adjective | afraid | con miedo | |
| feelings | Beginner | Verb | like | gustarle | |
| feelings | Advanced | Noun | mood | humor m ánimo | ánimo|
| feelings | Intermediate | Verb | worry | preocuparse | |
| numbers_measures | Beginner | Noun | one | uno | -numbers won't be included-|
| numbers_measures | Advanced | Noun | percent | por ciento | porcentaje|
| numbers_measures | Beginner | Noun | six | seis | -numbers won't be included-|
| numbers_measures | Beginner | Noun | three | tres | -numbers won't be included-|
| sports_hobbies | Intermediate | Noun | party | parte contratante | participante (ENGLISH WORD SHOULD BE PARTICIPANT)|
| technology_media | Intermediate | Noun | app | app (ap) | app|
| time_calendar | Intermediate | Adjective | late | tarde | |
| weather | Intermediate | Verb | freeze | helarse | |
| weather | Intermediate | Noun | weather | tiempo atmosférico | clima|

### B3. Spanish row exists but lacks a key case (2)
| Word | Spanish pick | Missing | Your decision |
|---|---|---|---|
| sugar | azúcar | gender/required form | el/la|
| art | arte | gender/required form | el|

## Appendix C — German gap tables

### C1. No German word in the first sense (10)
| Topic | Band | POS | Word | First sense | Your decision / German word |
|---|---|---|---|---|---|
| body_health | Advanced | Noun | shoulder | top of the torso, away from the neck | |
| clothing | Advanced | Verb | suit | to be suitable or apt for one's image | |
| clothing | Intermediate | Noun | zipper | high-pitched sound | |
| feelings | Intermediate | Adjective | nervous | easily agitated or alarmed | |
| numbers_measures | Beginner | Noun | ten | set or group with ten elements | |
| people_family | Advanced | Noun | generation | origination by some process; formation | |
| sports_hobbies | Advanced | Noun | concert | agreement in a design or plan | |
| technology_media | Intermediate | Noun | media | means and institutions for publishing and broadcasting information | |
| travel_transport | Intermediate | Noun | plane | level or flat surface | |
| work_money | Advanced | Noun | investment | act of investing | |

### C2. German pick not in the local lexicon (26)
| Topic | Band | POS | Word | German pick | Generator possible? | Your decision |
|---|---|---|---|---|---|---|
| body_health | Advanced | Noun | breath | Atmen | yes | |
| body_health | Advanced | Noun | treatment | Behandeln | yes | |
| clothing | Intermediate | Noun | clothes | Kleider | yes | |
| clothing | Advanced | Noun | slipper | Slipper | yes | |
| core | Intermediate | Verb | change | sich ändern | yes | |
| core | Beginner | Adjective | main | haupt- | no | |
| core | Intermediate | Verb | move | sich bewegen | yes | |
| core | Advanced | Verb | remember | sich erinnern | yes | |
| core | Advanced | Verb | stay | sich aufhalten | yes | |
| core | Intermediate | Verb | turn | sich drehen | yes | |
| feelings | Advanced | Noun | trust | Vertrauen | yes | |
| feelings | Intermediate | Verb | worry | besorgt sein | yes | |
| food_drink | Advanced | Noun | pasta | Nudeln | yes | |
| numbers_measures | Advanced | Noun | percent | vom Hundert | yes | |
| people_family | Intermediate | Noun | cousin | entfernter Verwandter | yes | |
| sports_hobbies | Advanced | Noun | champion | Sieger | yes | |
| sports_hobbies | Intermediate | Noun | player | Spieler | yes | |
| sports_hobbies | Intermediate | Noun | reader | Leser | yes | |
| sports_hobbies | Advanced | Noun | score | Spielergebnis | yes | |
| technology_media | Advanced | Adjective | digital | Finger- | no | |
| technology_media | Intermediate | Noun | news | Neuigkeiten | yes | |
| technology_media | Intermediate | Noun | password | Codewort | yes | |
| technology_media | Beginner | Noun | phone | Phon | yes | |
| time_calendar | Intermediate | Noun | schedule | Anhang (zu e. juristischen Dokument) | yes | |
| work_money | Advanced | Noun | income | Einkommen | yes | |
| work_money | Beginner | Noun | worker | Arbeiter | yes | |

### C3. German row exists but lacks a key case (1)
| Word | German pick | Your decision |
|---|---|---|
| cost | Kosten | |

## Appendix D — Estonian gaps

### D1. No Estonian word in the first sense (124 entries; grouped by topic)
- **clothing** (8): blouse, cap, fit, suit, tie, try on, vest, zipper
- **food_drink** (3): seafood, taste, tea
- **plants_nature** (2): dirt, ground
- **weather** (4): degree, freeze, shade, tropical
- **body_health** (6): breath, cure, doctor, shoulder, surgery, treatment
- **technology_media** (6): digital, network, online, press, printer, screen
- **home_living** (3): appliance, rent, room
- **travel_transport** (10): destination, driver, fast, flight, plane, platform, train, transport, vehicle, voyage
- **sports_hobbies** (5): athlete, concert, leisure, paint, team
- **work_money** (7): cost, customer, economy, industry, investment, job, office
- **numbers_measures** (16): average, double, eight, five, four, hundred, maximum, minimum, nine, one, piece, seven, six, ten, three, total
- **time_calendar** (9): decade, delay, evening, frequency, immediate, late, schedule, temporary, urgent
- **feelings** (14): afraid, angry, anxiety, attitude, bored, calm, confidence, delight, nervous, proud, relief, sad, scared, stress
- **people_family** (4): cousin, female, male, stranger
- **core** (27): agree, be, carry, consider, cut, do, expect, fast, get, have, keep, lead, leave, mean, pass, provide, raise, reach, report, require, say, seem, serve, set, start, support, think

### D2. Ekilex answered 114 of the 123 unique missing Estonian keys
The nine with no Ekilex answer: `afraid (adj)`, `bored (adj)`, `scared (adj)`, `tropical (adj)`, `urgent (adj)`, `breath (n)`, `delight (n)`, `dirt (n)`, `try on (v)`.

## Appendix E — Multiword first-sense picks // if no answer is given, use your pick

| Language | Word | Phrase | Your decision |
|---|---|---|---|
| Spanish | afraid | con miedo | asustado|
| Spanish | agree | estar de acuerdo | acordar|
| Spanish | app | app (ap) | app|
| Spanish | bathroom | cuarto de baño | baño|
| Spanish | beef | carne de res | -REMOVE THIS WORD-|
| Spanish | email | correo electrónico | |
| Spanish | mood | humor m ánimo | ánimo|
| Spanish | need | necesitar/precisar (de) | necesitar|
| Spanish | party | parte contratante | parte|
| Spanish | percent | por ciento | porcentaje|
| Spanish | reach | llegar a | alcanzar|
| Spanish | remember | acordarse/arrecordarse/alcordarse de | recordar|
| Spanish | sometimes | a veces | |
| Spanish | stand | estar de pie | pararse|
| Spanish | tea | hoja de té | té|
| Spanish | wear | llevar (puesto) | vestir|
| Spanish | weather | tiempo atmosférico | clima|
| Spanish | website | sitio web | |
| German | change | sich ändern | |
| German | cousin | entfernter Verwandter | |
| German | move | sich bewegen | |
| German | percent | vom Hundert | |
| German | remember | sich erinnern | |
| German | schedule | Anhang (zu e. juristischen Dokument) | |
| German | stay | sich aufhalten | |
| German | turn | sich drehen | |
| German | worry | besorgt sein | |
| Estonian | score | skoor, punktiseis | |

## Appendix F — Entries where a later sense improves coverage (67)

| # | Topic | Band | POS | Word | First sense (languages with forms) | Later sense (languages with forms) | Your decision |
|---|---|---|---|---|---|---|---|
| 1 | animals | Intermediate | Noun | fly | insect of the order Diptera (English, Spanish, German) | insect of the family Muscidae (English, Spanish, German, Estonian) | |
| 2 | body_health | Advanced | Noun | breath | act or process of breathing (English, Spanish) | single act of breathing in and out (English, Spanish, German) | |
| 3 | body_health | Advanced | Noun | shoulder | top of the torso, away from the neck (English, Spanish) | joint between arm and torso (English, Spanish, German, Estonian) | |
| 4 | body_health | Advanced | Noun | treatment | process or manner of treating (English, Spanish) | medical care for an illness or injury (English, Spanish, German) | |
| 5 | clothing | Advanced | Noun | slipper | low shoe slipped on and off easily (English, Spanish) | low shoe usually worn indoors (English, Spanish, German) | |
| 6 | clothing | Advanced | Verb | suit | to be suitable or apt for one's image (English, Spanish) | to be appropriate or apt for (English, Spanish, German) | |
| 7 | clothing | Intermediate | Verb | fit | to be suitable for (English, German) | to conform to in size and shape (English, Spanish, German) | |
| 8 | clothing | Intermediate | Noun | zipper | high-pitched sound (English, Spanish) | energy, vigor, vim (English, Spanish, German) | |
| 9 | core | Advanced | Verb | break | intransitive: to separate into (to end up in) two or more pieces (English, German, Estonian) | transitive: to separate into (to cause to end up in) two or more pieces (English, Spanish, German, Estonian) | |
| 10 | core | Advanced | Verb | consider | think about seriously (English, Spanish, German) | assign some quality to (English, Spanish, German, Estonian) | |
| 11 | core | Advanced | Verb | reach | to arrive at by effort (English, German) | to give by stretching out, to hand over (English, Spanish, German) | |
| 12 | core | Advanced | Verb | require | to demand, call for authoritatively (English, German) | to need (English, Spanish, German) | |
| 13 | core | Advanced | Verb | stay | to remain in a particular place (English, Spanish, Estonian) | to postpone (English, Spanish, German, Estonian) | |
| 14 | core | Beginner | Verb | be | auxiliary: used to form the passive voice (English, Spanish, German) | used to declare the subject and object identical or equivalent (English, Spanish, German, Estonian) | |
| 15 | core | Beginner | Verb | do | in questions (English, German) | perform, execute (English, Spanish, German, Estonian) | |
| 16 | core | Beginner | Adjective | fast | firmly or securely fixed in place (English, German) | moving or capable of moving with great speed (English, Spanish, German) | |
| 17 | core | Beginner | Verb | say | to say, to tell (English, Spanish, German) | to pronounce (English, Spanish, German, Estonian) | |
| 18 | core | Beginner | Verb | start | to begin (English, German) | to initiate operation of a vehicle or machine (English, Spanish, German) | |
| 19 | core | Beginner | Verb | think | to ponder, to go over in one's head (English, Spanish, German) | communicate to oneself in one’s mind (English, Spanish, German, Estonian) | |
| 20 | core | Intermediate | Verb | change | to become something different (English, Spanish, Estonian) | to make something into something else (English, Spanish, German, Estonian) | |
| 21 | core | Intermediate | Verb | leave | to cause to remain as available, not take away, refrain from depleting (English, Spanish, German) | to depart (intransitive) (English, Spanish, German, Estonian) | |
| 22 | core | Intermediate | Verb | mean | to intend; plan on doing (English, Spanish, German) | to convey, indicate (English, Spanish, German, Estonian) | |
| 23 | core | Intermediate | Verb | move | (intransitive) to change place or posture; to go (English, Estonian) | (transitive) to change the place of something (English, Spanish, German, Estonian) | |
| 24 | feelings | Advanced | Noun | anxiety | state of uneasiness, nervousness, apprehension and obsession (English, German) | concern (English, Spanish, German, Estonian) | |
| 25 | feelings | Advanced | Noun | attitude | position of the body or way of carrying oneself (English, Spanish, German) | disposition or state of mind (English, Spanish, German, Estonian) | |
| 26 | feelings | Advanced | Noun | stress | (physics) internal force across a boundary per area (English, German) | emotional pressure (English, Spanish, German, Estonian) | |
| 27 | feelings | Beginner | Adjective | sad | of colours: dark, sombre, dull (English, German) | feeling sorrow (English, Spanish, German) | |
| 28 | feelings | Intermediate | Adjective | nervous | easily agitated or alarmed (English, Spanish) | apprehensive, anxious (English, Spanish, German) | |
| 29 | feelings | Intermediate | Verb | worry | to be troubled (English, Estonian) | to disturb the peace of mind of (English, Spanish, German) | |
| 30 | food_drink | Beginner | Noun | drink | served beverage (English, German, Estonian) | served alcoholic beverage — see also shot, cocktail (English, Spanish, German, Estonian) | |
| 31 | food_drink | Beginner | Noun | tea | dried leaves of tea plant (English, Spanish, German) | drink made from leaves of tea plant (English, Spanish, German, Estonian) | |
| 32 | home_living | Beginner | Noun | room | space (English, Spanish, German) | division in a building (English, Spanish, German, Estonian) | |
| 33 | numbers_measures | Beginner | Noun | ten | set or group with ten elements (English, Spanish) | playing card with a value of ten (English, Spanish, German) | |
| 34 | people_family | Advanced | Noun | generation | origination by some process; formation (English, Spanish, Estonian) | single step in the succession of natural descent (English, Spanish, German, Estonian) | |
| 35 | people_family | Intermediate | Noun | cousin | any relation (especially a distant one) who is not a direct ancestor or descendant but part of a person’s extended family (English) | child of a person’s parent’s brother or sister (English, Spanish, German, Estonian) | |
| 36 | sports_hobbies | Advanced | Noun | athlete | participant in track and field, road running, cross country running, or racewalking (English, Spanish, German) | person who actively participates in physical sports (English, Spanish, German, Estonian) | |
| 37 | sports_hobbies | Advanced | Noun | concert | agreement in a design or plan (English, Spanish) | a musical entertainment in which several voices or instruments take part (English, Spanish, German, Estonian) | |
| 38 | sports_hobbies | Advanced | Noun | score | number of points earned (English, Spanish) | number of points accrued (English, Spanish, German) | |
| 39 | sports_hobbies | Beginner | Noun | team | set of draught animals (English, Spanish, German) | group of people (English, Spanish, German, Estonian) | |
| 40 | sports_hobbies | Intermediate | Noun | camera | still camera (English, Spanish, German) | movie camera (English, Spanish, German, Estonian) | |
| 41 | sports_hobbies | Intermediate | Noun | party | law: particular side in a contract or legal action (English, German, Estonian) | group of people forming one side in a given dispute, contest etc. (English, Spanish, German, Estonian) | |
| 42 | technology_media | Advanced | Adjective | digital | having to do or performed with a finger (English, Spanish) | representing discrete values (English, Spanish, German) | |
| 43 | technology_media | Advanced | Noun | network | fabric or structure of fibrous elements (English, Spanish, German) | multiple computers and other devices connected together (English, Spanish, German, Estonian) | |
| 44 | technology_media | Advanced | Noun | press | device used to apply pressure (English, Spanish, German) | printed media (English, Spanish, German, Estonian) | |
| 45 | technology_media | Beginner | Noun | screen | physical divider (English, Spanish, German) | viewing area of electronic output device (English, Spanish, German, Estonian) | |
| 46 | technology_media | Intermediate | Noun | camera | still camera (English, Spanish, German) | movie camera (English, Spanish, German, Estonian) | |
| 47 | technology_media | Intermediate | Adjective | online | connected to a network (English, German) | connected to the Internet (English, Spanish, German) | |
| 48 | technology_media | Intermediate | Noun | password | word used to gain admittance (English, Spanish) | computing: string of characters known only to a user (English, Spanish, German) | |
| 49 | time_calendar | Advanced | Noun | decade | series of ten things (English, Spanish, German) | period of ten years (English, Spanish, German, Estonian) | |
| 50 | time_calendar | Intermediate | Noun | date | fruit of the date palm (English, Spanish, German) | point of time at which a transaction or event takes place (English, Spanish, German, Estonian) | |
| 51 | time_calendar | Intermediate | Adjective | late | near the end of a period of time (English, German) | associated with the end of a period (English, Spanish, German) | |
| 52 | time_calendar | Intermediate | Noun | schedule | a table of information forming appendix to a statute, other regulatory instrument or legal contract (English) | a procedural plan, usually but not necessarily tabular in nature, indicating a sequence of operations and the planned times at which those operations are to occur — see also agenda (English, Spanish, German, Estonian) | |
| 53 | travel_transport | Advanced | Noun | platform | stage for speeches and performances (English, German) | politics: political stance on a broad set of issues (English, Spanish, German) | |
| 54 | travel_transport | Beginner | Noun | train | the elongated back portion of a dress or skirt which drags along the ground (English, Spanish, German) | line of connected cars or carriages (English, Spanish, German, Estonian) | |
| 55 | travel_transport | Intermediate | Noun | border | the line or frontier area separating various territories (English, German, Estonian) | the outer edge of something (English, Spanish, German, Estonian) | |
| 56 | travel_transport | Intermediate | Adjective | fast | firmly or securely fixed in place (English, German) | moving or capable of moving with great speed (English, Spanish, German) | |
| 57 | travel_transport | Intermediate | Noun | plane | level or flat surface (English, Spanish) | geometry: flat surface extending infinitely in all directions (English, Spanish, German, Estonian) | |
| 58 | weather | Advanced | Noun | degree | academic award (English, Spanish, German) | geometry: unit of measurement of angle (English, Spanish, German, Estonian) | |
| 59 | weather | Intermediate | Verb | freeze | to become solid due to low temperature (English, German) | to lower something's temperature to freezing point (English, Spanish, German) | |
| 60 | work_money | Advanced | Noun | economy | effective management of the resources of a community or system (English, Spanish, German) | production and distribution and consumption (English, Spanish, German, Estonian) | |
| 61 | work_money | Advanced | Noun | industry | tendency to work persistently (English, German) | businesses of the same type (English, Spanish, German, Estonian) | |
| 62 | work_money | Advanced | Noun | investment | act of investing (English, Spanish) | placement of capital in expectation of deriving income or profit from its use (English, Spanish, German, Estonian) | |
| 63 | work_money | Beginner | Noun | job | task (English, Spanish, German) | economic role for which a person is paid (English, Spanish, German, Estonian) | |
| 64 | work_money | Intermediate | Noun | business | commercial enterprise or establishment (English, Spanish, German) | occupation, work or trade of a person (English, Spanish, German, Estonian) | |
| 65 | work_money | Intermediate | Noun | cost | amount of money spent for a purpose (English, Spanish) | negative consequence or loss (English, Spanish, German) | |
| 66 | work_money | Intermediate | Noun | customer | (obsolete) habitual patron, regular purchaser, returning client (English, Spanish, German) | one who purchases or receives a product or service (English, Spanish, German, Estonian) | |
| 67 | work_money | Intermediate | Noun | office | ceremonial religious duty or rite (English, Spanish, German) | room(s) or building used for non-manual work (English, Spanish, German, Estonian) | |

## Appendix G — Entries the current generator cannot source

**Not in `word-lists/en/*.tsv` (10):** pants, clothes, try on, news, data, stairs, thousand, double (adj), main (adj), yes (adv).

**Rank > 15,000, no band (5):** appliance, humidity, kilogram, total (n), past (n).

**Band mismatch:** 308 of 596 word-list entries differ from their frequency band. Matrix (proposed CEFR band → frequency band):

| Proposed band | Frequency beginner | Frequency intermediate | Frequency advanced | >15,000 | Not in list |
|---|---:|---:|---:|---:|---:|
| Beginner | 193 | 21 | 0 | 0 | 4 |
| Intermediate | 136 | 63 | 8 | 3 | 4 |
| Advanced | 61 | 85 | 38 | 2 | 2 |

## Answer checklist

Use this list to confirm that every question has an answer:
- [ ] Q1
- [ ] Q2
- [ ] Q3
- [ ] Q4
- [ ] Q5
- [ ] Q6
- [ ] Q7
- [ ] Q8
- [ ] Q9
- [ ] Q10
- [ ] Q11
- [ ] Q12
- [ ] Q13
- [ ] Q14
- [ ] Q15
- [ ] Q16
- [ ] Q17
- [ ] Q18
- [ ] Q19
- [ ] Q20
- [ ] Q21
- [ ] Q22
- [ ] Q23
- [ ] Q24
- [ ] Q25
- [ ] Q26
- [ ] Q27
- [ ] Q28
- [ ] Q29
- [ ] Q30
- [ ] Q31
- [ ] Q32

When finished, save the file and send it back. I will apply the answers to the list, the pool and the generation scripts in that order.
