# Autocomplete coverage report (Slice 0)

*Written 2026-10-08. Output of Slice 0 of `autocomplete-data-source-strategy.md`. Research only:
no app code uses the lexicon yet.*

## 1. Answer

**Go for German, Spanish and English. Go, with an online fallback, for Estonian.**

- For EN, ES and DE, kaikki fills 96–100% of our case fields for the most frequent words, and
  its values are more correct than today's libraries.
- For Estonian, the keyless local data covers all frequent verbs, about half of the frequent
  nouns, and almost no adjectives. Estonian still needs an online fallback (Q-D1).
- The full lexicon fits in about 180 MB per environment with a compact layout (section 7).

## 2. Sources and versions

| Source | Version | Licence | Use |
|--------|---------|---------|-----|
| kaikki.org raw Wiktextract dump | Last-Modified 2026-10-03 08:24 GMT | CC BY-SA 4.0 | EN/ES/DE forms, EN translations |
| FrequencyWords (`hermitdave`), 2018, top 50k | `master`, downloaded 2026-10-08 | CC BY-SA 4.0 (content) | EN/ES/DE sample ranking |
| Pikhof `est_words_160k.tsv` | `main` (snapshot 2026-04-01) | CC BY-SA 4.0 | ET sample, existence |
| Eesthetic | v1.0.5 (Zenodo 14069724) | CC BY 4.0 | ET labelled forms |

## 3. Method

1. `scripts/lexicon/sample.ts` turns each frequency list into ranked lemmas per part of
   speech. Inflected words map to their lemma through `form_of` chains (`querida` → `querido`
   → `querer`).
2. The selector tables (`backend/lib/lexicon/selectors/{de,es,en}.ts`) pick each case field
   from a kaikki entry. 25 unit tests run them on real entries.
3. `scripts/lexicon/measure.ts` takes the top 5,000 lemmas per part of speech. It compares
   the selectors with **today's real controllers**, called with a fake request. `is-word` is
   loaded once per list (same answers, about 5 seconds instead of 32 minutes).
4. `measure-et.ts`, `measure-translations.ts` and `estimate-size.ts` cover Estonian,
   translations and size.

To repeat: see `backend/scripts/lexicon/README.md`.

**Bias.** The EN/ES/DE sample comes from kaikki, so every sampled lemma exists in kaikki.
What kaikki does not know shows in the unmatched-word list (appendix A, last section). That
list has contractions, names, function words and noise, but no common content word.

**Noise.** The frequency lists are lowercase, and one word can be several parts of speech.
Some sampled "verbs" are not verbs (`yes`, `times`), and some "nouns" are homographs (`it`,
German `Ich`). This affects both sides of the comparison equally.

## 4. EN, ES and DE results

| Group | Lemmas | Today finds | Today errors | kaikki fills | Lemmas kaikki fills that today does not find |
|-------|--------|-------------|--------------|--------------|------------|
| DE nouns | 5,000 | 55.2% | **20.6%** | 96–100%, plural 88.7% | 2,241 |
| DE verbs | 4,413 | 80.2% | **7.6%** | about 98% | 875 |
| ES nouns | 5,000 | 89.0% + 11.0% guess | 0% | gender 99.4%, plural 97.0% | 549 |
| ES verbs | 2,947 | 87.3% | 0% | 97.4–98.0% | 373 |
| EN verbs | 5,000 | 91.5% | 0% | 98.2–100% | 427 |
| EN nouns | 5,000 | no route | — | plural 91.8% | all |

"Today errors" means the controller throws: the user gets HTTP 500. In German this happens
for one noun in five. It is a bug in today's app (section 8).

**Fields that only kaikki fills:** ES plural (97.0%), ES gerund (97.6%), regularity in all
three languages (97.6–98.0%), DE auxiliary verb (98.4%), DE separable prefix (25.9% — the share
of separable verbs), and all English noun fields.

**When both fill a case, kaikki is more correct.** Checked by hand:

| Language | Today (wrong or old) | kaikki |
|----------|----------------------|--------|
| ES verbs | `sento`, `pensas`, `veniré`, `suponido`, `creido`, `oír` in every person | `siento`, `piensas`, `vendré`, `supuesto`, `creído`, `oímos` |
| ES gender | `el` leche, `el` crisis, `el` gripe, `la` jazz (180 conflicts below rank 500) | `la` leche, `la` crisis, `la` gripe, `el` jazz |
| DE nouns | `das` Tag, `Doktoranden`, accusative `Herren` | `der` Tag, `Doktoren`, `Herrn` |
| DE verbs | pre-1996 spelling `läßt`, `wußte`; `haben` for every verb | `lässt`, `wusste`; `sein` where correct |
| EN verbs | `caned`, `willed` | `could`, `would` |

Both are valid in some German cells: genitive `Mannes`/`Manns`, dative `Mann`/`Manne`, past
`tatest`/`tatst`. kaikki gives the more common form first.

**Agreement where both fill** (full table in appendix A): DE genitive singular 78.5% and dative
singular 71.1% (the valid variants above), ES present 86.8–89.7% (today's stem-change errors),
every other case 91–100%.

## 5. Estonian results

Sample: Pikhof base words with a frequency rank. Pikhof ranks only 738 verbs.

| Part of speech | Sampled | Eesthetic has it | kaikki (et) has forms | In neither |
|----------------|---------|------------------|----------------------|------------|
| Noun | 5,000 | 51.9% | 38.4% | 38.6% |
| Verb | 738 | 100.0% | 56.4% | 0.0% |
| Adjective | 2,137 | 3.1% | 20.6% | 77.8% |

- When Eesthetic has a lexeme, it fills **every** field of today's Estonian transforms, except
  the short form (`shortFormEE`, 33% of nouns; not every noun has one).
- Eesthetic contains only nouns and verbs, so adjectives need another source.
- Some Pikhof "nouns" are verb forms (`oleks`, `tead`, `saan`), so the real noun coverage is
  higher than 51.9%.
- 40,295 Eesthetic cells have more than one form. Slice D needs a tie-break rule.

**Conclusion for Slice D:** local data first, then the online fallback. The fallback is not
only for rare words: it serves about half of the nouns and almost all adjectives. That makes
Q-D1 (keep `api.sonapi.ee` or move to the official Ekilex API) more important. A fully offline
alternative remains Vabamorf (strategy doc §7).

## 6. Translation results

**English → other languages** (top 5,000 English lemmas):

| English | Lemmas with ES | with DE | with ET | Translated senses with ES | with DE | with ET |
|---------|---------------|---------|---------|---------------------------|---------|---------|
| Nouns | 70.1% | 70.1% | 46.2% | 78.3% | 85.2% | 33.2% |
| Verbs | 57.3% | 57.1% | 12.7% | 75.1% | 81.0% | 11.3% |

The lemma shares are lower than the sense shares because noise entries (`'s`, `is`, `people`
as a verb) have no translation table. Real frequent verbs (`be`, `get`, `make`, `take`) have
translations.

**Reverse — can a language start a lookup** (share of its top lemmas that appear as a
translation of some English entry):

| Language | Nouns | Verbs |
|----------|-------|-------|
| ES | 91.8% | 84.2% |
| DE | 91.9% | 78.9% |
| ET | 58.1% | 57.6% |

**Conclusion for Slice F and Slice G:** the plan works well for EN, ES and DE. Estonian
translations are thin, which matches the small Estonian part of English Wiktionary. Estonian
translation needs a second source (for example Ekilex `api/meaning/search`), or the feature
must show that it is incomplete for Estonian.

## 7. Size

Two layouts were estimated (appendix D):

- **A** — one `lexeme_form` row per form (the strategy doc §12 design).
- **B** — one `jsonb` column of forms per `lexeme`, and cells equal to the lemma are not
  stored (English future/conditional/most present cells, singular nouns). The backend fills
  them from the lemma at read time.

| | Layout A | Layout B |
|-|----------|----------|
| EN + ES + DE + ET | 460 MB | 176 MB |
| + translations | 500 MB | 216 MB |

Allow up to +30% for page fill. Both fit on the 128 GB VPS. Layout B is smaller, needs no
second table, and matches how the lookup reads (all forms of one lexeme together). This is
open question Q-B5 for Slice B1.

## 8. Findings for later slices

1. **Today's German routes crash** for 20.6% of nouns and 7.6% of verbs (`german-words` throws
   when `is-word` knows a word its dictionary does not). Slice A should answer `not-found`
   instead of HTTP 500.
2. **`is-word` reloads its word list on every request** (about 27 ms). Slice A can load each
   list once. Slice C2 removes `is-word`.
3. **Today's Spanish generator is wrong for stem-changing and irregular verbs.** As the
   fallback in Slice C1 (decision D2), its results must stay `partial`, with the notice.
4. **Adjectives are the best first new part of speech** (Slice H): DE 96.1% have full
   declension, ES 98.2% gender and number, EN 75.8% comparative and superlative.
5. **Reflexive verbs** (decision D8): kaikki marks "always reflexive" (lemma) and "reflexive in
   some senses" (sense tag). The pronoun is removed from stored forms.
6. **The v2 Spanish form has no conditional or imperative.** kaikki fills them at about 97%.
   Showing them is a separate decision after parity.

## 9. Selector decisions made during Slice 0

| Topic | Decision |
|-------|----------|
| Separable German verbs | Joined form, as today (`anruft`) — D9 |
| German 1st-person singular | `-ern` full form (`sichere`), `-eln` elided (`sammle`) — D9 |
| Reflexive pronoun | Not stored (`sputen`, `personamos`) — D8 |
| English future/conditional | The bare verb, as today (the form shows will/would) |
| Excluded rows | archaic, obsolete, dated, rare, poetic, nonstandard, misspelling, dialectal, regional, colloquial, alternative, diminutive; Spanish `vos-form`, clitic `combined-form`, `negative` imperative |
| Spanish gender, both genders in one sense | `el/la` |
| No source | `caseTypeDE`, `imperative1sES`, Spanish compound non-finites, noun `regularity` |

---

# Appendices (generated)

The appendices are copied from the generated files in `backend/scripts/lexicon/.data/`, which
git ignores. Regenerate them with the scripts named in each heading.

## Appendix A — EN/ES/DE measurement (`measure.ts`)


kaikki version: Sat, 03 Oct 2026 08:24:38 GMT. Sample: top 5000 lemmas per part of speech from FrequencyWords 2018 (50k).

### DE Noun — 5000 lemmas

Today: found 55.2%, partial 0.0%, not found 24.2%, error 20.6%. kaikki fills at least one case for 2241 lemmas that today does not find.

| case | kaikki | today | agree (both filled) | examples of disagreement |
|---|---|---|---|---|
| genderDE | 99.2% | 55.2% | 98.0% (2757) | Tag: kaikki "der" / today "das"; Moment: kaikki "der" / today "das"; Mark: kaikki "die" / today "das"; Bord: kaikki "das" / today "der"; Taxi: kaikki "der" / today "das" |
| singularNominativDE | 100.0% | 55.2% | 100.0% (2759) |  |
| pluralNominativDE | 88.7% | 55.2% | 97.7% (2684) | Tag: kaikki "Tage" / today "Tags"; Wasser: kaikki "Wasser" / today "Wässer"; Doktor: kaikki "Doktoren" / today "Doktoranden"; Kumpel: kaikki "Kumpel" / today "Kumpels"; Punkt: kaikki "Punkte" / today "Punkten" |
| singularAkkusativDE | 96.4% | 55.2% | 99.5% (2722) | Herr: kaikki "Herrn" / today "Herren"; Typ: kaikki "Typ" / today "Typen"; Tor: kaikki "Tor" / today "Toren"; Junior: kaikki "Junior" / today "Junioren"; Zeh: kaikki "Zeh" / today "Zehen" |
| pluralAkkusativDE | 88.7% | 55.2% | 97.8% (2684) | Wasser: kaikki "Wasser" / today "Wässer"; Doktor: kaikki "Doktoren" / today "Doktoranden"; Kumpel: kaikki "Kumpel" / today "Kumpels"; Punkt: kaikki "Punkte" / today "Punkten"; Mark: kaikki "Mark" / today "Marken" |
| singularGenitivDE | 96.4% | 55.2% | 78.5% (2722) | Mann: kaikki "Mannes" / today "Manns"; Gott: kaikki "Gottes" / today "Gotts"; Tag: kaikki "Tages" / today "Tags"; Geld: kaikki "Geldes" / today "Gelds"; Kind: kaikki "Kindes" / today "Kinds" |
| pluralGenitivDE | 88.7% | 55.2% | 97.7% (2684) | Tag: kaikki "Tage" / today "Tags"; Wasser: kaikki "Wasser" / today "Wässer"; Doktor: kaikki "Doktoren" / today "Doktoranden"; Kumpel: kaikki "Kumpel" / today "Kumpels"; Punkt: kaikki "Punkte" / today "Punkten" |
| singularDativDE | 96.4% | 55.2% | 71.1% (2722) | Mann: kaikki "Mann" / today "Manne"; Gott: kaikki "Gott" / today "Gotte"; Tag: kaikki "Tag" / today "Tage"; Geld: kaikki "Geld" / today "Gelde"; Abend: kaikki "Abend" / today "Abende" |
| pluralDativDE | 88.7% | 55.2% | 98.0% (2684) | Tag: kaikki "Tagen" / today "Tags"; Wasser: kaikki "Wassern" / today "Wässern"; Doktor: kaikki "Doktoren" / today "Doktoranden"; Kumpel: kaikki "Kumpeln" / today "Kumpels"; Mark: kaikki "Mark" / today "Marken" |

### DE Verb — 4413 lemmas

Today: found 80.2%, partial 0.0%, not found 12.2%, error 7.6%. kaikki fills at least one case for 875 lemmas that today does not find.

| case | kaikki | today | agree (both filled) | examples of disagreement |
|---|---|---|---|---|
| infinitiveDE | 100.0% | 80.2% | 100.0% (3538) |  |
| auxVerbDE | 98.4% | 0.0% | — |  |
| prefixDE | 25.9% | 0.0% | — |  |
| regularityDE | 98.0% | 0.0% | — |  |
| indicativePresent1sDE | 97.8% | 80.2% | 100.0% (3521) | recyceln: kaikki "recycle" / today "recycele" |
| indicativePresent2sDE | 97.8% | 80.2% | 98.3% (3521) | lassen: kaikki "lässt" / today "läßt"; vergessen: kaikki "vergisst" / today "vergißt"; verlassen: kaikki "verlässt" / today "verläßt"; passen: kaikki "passt" / today "paßt"; hassen: kaikki "hasst" / today "haßt" |
| indicativePresent3sDE | 98.0% | 80.2% | 98.4% (3525) | lassen: kaikki "lässt" / today "läßt"; vergessen: kaikki "vergisst" / today "vergißt"; verlassen: kaikki "verlässt" / today "verläßt"; passen: kaikki "passt" / today "paßt"; hassen: kaikki "hasst" / today "haßt" |
| indicativePresent1plDE | 97.8% | 80.2% | 100.0% (3521) |  |
| indicativePresent2plDE | 97.8% | 80.2% | 98.6% (3521) | wissen: kaikki "wisst" / today "wißt"; lassen: kaikki "lasst" / today "laßt"; vergessen: kaikki "vergesst" / today "vergeßt"; verlassen: kaikki "verlasst" / today "verlaßt"; passen: kaikki "passt" / today "paßt" |
| indicativePresent3plDE | 98.0% | 80.2% | 100.0% (3525) |  |
| indicativePerfect1sDE | 97.8% | 80.2% | 98.5% (3521) | übersetzen: kaikki "übersetzt" / today "übergesetzt"; umgehen: kaikki "umgangen" / today "umgegangen"; quellen: kaikki "gequollen" / today "gequellt"; erschrecken: kaikki "erschrocken" / today "erschreckt"; verwenden: kaikki "verwendet" / today "verwandt" |
| indicativePerfect2sDE | 97.8% | 80.2% | 98.5% (3521) | übersetzen: kaikki "übersetzt" / today "übergesetzt"; umgehen: kaikki "umgangen" / today "umgegangen"; quellen: kaikki "gequollen" / today "gequellt"; erschrecken: kaikki "erschrocken" / today "erschreckt"; verwenden: kaikki "verwendet" / today "verwandt" |
| indicativePerfect3sDE | 98.0% | 80.2% | 98.5% (3525) | übersetzen: kaikki "übersetzt" / today "übergesetzt"; umgehen: kaikki "umgangen" / today "umgegangen"; quellen: kaikki "gequollen" / today "gequellt"; erschrecken: kaikki "erschrocken" / today "erschreckt"; verwenden: kaikki "verwendet" / today "verwandt" |
| indicativePerfect1plDE | 97.8% | 80.2% | 98.5% (3521) | übersetzen: kaikki "übersetzt" / today "übergesetzt"; umgehen: kaikki "umgangen" / today "umgegangen"; quellen: kaikki "gequollen" / today "gequellt"; erschrecken: kaikki "erschrocken" / today "erschreckt"; verwenden: kaikki "verwendet" / today "verwandt" |
| indicativePerfect2plDE | 97.8% | 80.2% | 98.5% (3521) | übersetzen: kaikki "übersetzt" / today "übergesetzt"; umgehen: kaikki "umgangen" / today "umgegangen"; quellen: kaikki "gequollen" / today "gequellt"; erschrecken: kaikki "erschrocken" / today "erschreckt"; verwenden: kaikki "verwendet" / today "verwandt" |
| indicativePerfect3plDE | 98.0% | 80.2% | 98.5% (3525) | übersetzen: kaikki "übersetzt" / today "übergesetzt"; umgehen: kaikki "umgangen" / today "umgegangen"; quellen: kaikki "gequollen" / today "gequellt"; erschrecken: kaikki "erschrocken" / today "erschreckt"; verwenden: kaikki "verwendet" / today "verwandt" |
| indicativeSimpleFuture1sDE | 97.8% | 80.2% | 100.0% (3521) |  |
| indicativeSimpleFuture2sDE | 97.8% | 80.2% | 100.0% (3521) |  |
| indicativeSimpleFuture3sDE | 98.0% | 80.2% | 100.0% (3525) |  |
| indicativeSimpleFuture1plDE | 97.8% | 80.2% | 100.0% (3521) |  |
| indicativeSimpleFuture2plDE | 97.8% | 80.2% | 100.0% (3521) |  |
| indicativeSimpleFuture3plDE | 98.0% | 80.2% | 100.0% (3525) |  |
| indicativeSimplePast1sDE | 97.8% | 80.2% | 97.2% (3521) | wissen: kaikki "wusste" / today "wußte"; scheißen: kaikki "schiss" / today "schiß"; passen: kaikki "passte" / today "paßte"; hassen: kaikki "hasste" / today "haßte"; schießen: kaikki "schoss" / today "schoß" |
| indicativeSimplePast2sDE | 97.8% | 80.2% | 94.7% (3521) | wissen: kaikki "wusstest" / today "wußtest"; tun: kaikki "tatest" / today "tatst"; lassen: kaikki "ließest" / today "ließt"; essen: kaikki "aßest" / today "aßt"; scheißen: kaikki "schissest" / today "schißt" |
| indicativeSimplePast3sDE | 98.0% | 80.2% | 97.2% (3525) | wissen: kaikki "wusste" / today "wußte"; scheißen: kaikki "schiss" / today "schiß"; passen: kaikki "passte" / today "paßte"; hassen: kaikki "hasste" / today "haßte"; schießen: kaikki "schoss" / today "schoß" |
| indicativeSimplePast1plDE | 97.8% | 80.2% | 98.6% (3521) | wissen: kaikki "wussten" / today "wußten"; passen: kaikki "passten" / today "paßten"; hassen: kaikki "hassten" / today "haßten"; vermissen: kaikki "vermissten" / today "vermißten"; hängen: kaikki "hingen" / today "hängten" |
| indicativeSimplePast2plDE | 97.8% | 80.2% | 97.1% (3521) | wissen: kaikki "wusstet" / today "wußtet"; scheißen: kaikki "schisst" / today "schißt"; passen: kaikki "passtet" / today "paßtet"; hassen: kaikki "hasstet" / today "haßtet"; schießen: kaikki "schosst" / today "schoßt" |
| indicativeSimplePast3plDE | 98.0% | 80.2% | 98.6% (3525) | wissen: kaikki "wussten" / today "wußten"; passen: kaikki "passten" / today "paßten"; hassen: kaikki "hassten" / today "haßten"; vermissen: kaikki "vermissten" / today "vermißten"; hängen: kaikki "hingen" / today "hängten" |

### ES Noun — 5000 lemmas

Today: found 89.0%, partial 11.0%, not found 0.0%, error 0.0%. kaikki fills at least one case for 549 lemmas that today does not find.

| case | kaikki | today | agree (both filled) | examples of disagreement |
|---|---|---|---|---|
| genderES | 99.4% | 98.1% | 92.3% (4875) | la: kaikki "el" / today "la"; te: kaikki "la" / today "el"; mi: kaikki "la" / today "el"; gracias: kaikki "la" / today "el"; ere: kaikki "la" / today "el" |
| singularES | 100.0% | 100.0% | 100.0% (5000) |  |
| pluralES | 97.0% | 0.0% | — |  |

### ES Verb — 2947 lemmas

Today: found 87.3%, partial 0.0%, not found 12.7%, error 0.0%. kaikki fills at least one case for 373 lemmas that today does not find.

| case | kaikki | today | agree (both filled) | examples of disagreement |
|---|---|---|---|---|
| regularityES | 97.6% | 0.0% | — |  |
| infinitiveNonFiniteSimpleES | 100.0% | 87.3% | 100.0% (2574) |  |
| gerundNonFiniteSimpleES | 97.6% | 0.0% | — |  |
| participleNonFiniteSimpleES | 98.0% | 86.5% | 97.8% (2546) | creer: kaikki "creído" / today "creido"; suponer: kaikki "supuesto" / today "suponido"; traer: kaikki "traído" / today "traido"; aponer: kaikki "apuesto" / today "aponido"; leer: kaikki "leído" / today "leido" |
| indicativePresent1sES | 97.4% | 87.3% | 86.8% (2546) | asir: kaikki "asgo" / today "aso"; sentar: kaikki "siento" / today "sento"; sentir: kaikki "siento" / today "sento"; valer: kaikki "valgo" / today "valo"; hacendar: kaikki "haciendo" / today "hacendo" |
| indicativePresent2sES | 97.4% | 87.3% | 89.7% (2546) | sentar: kaikki "sientas" / today "sentas"; sentir: kaikki "sientes" / today "sentes"; hacendar: kaikki "haciendas" / today "hacendas"; oír: kaikki "oyes" / today "oír"; pensar: kaikki "piensas" / today "pensas" |
| indicativePresent3sES | 97.5% | 87.3% | 89.6% (2548) | haber: kaikki "ha" / today "hay"; sentar: kaikki "sienta" / today "senta"; sentir: kaikki "siente" / today "sente"; hacendar: kaikki "hacienda" / today "hacenda"; oír: kaikki "oye" / today "oír" |
| indicativePresent1plES | 97.5% | 87.3% | 99.5% (2548) | oír: kaikki "oímos" / today "oír"; personarse: kaikki "personamos" / today "personarse"; freír: kaikki "freímos" / today "freír"; arrepentirse: kaikki "arrepentimos" / today "arrepentirse"; engreír: kaikki "engreímos" / today "engreír" |
| indicativePresent2plES | 97.5% | 87.3% | 99.0% (2548) | oír: kaikki "oís" / today "oír"; personarse: kaikki "personáis" / today "personarse"; piar: kaikki "piais" / today "piáis"; far: kaikki "fais" / today "fáis"; freír: kaikki "freís" / today "freír" |
| indicativePresent3plES | 97.5% | 87.3% | 89.7% (2548) | sentar: kaikki "sientan" / today "sentan"; sentir: kaikki "sienten" / today "senten"; hacendar: kaikki "haciendan" / today "hacendan"; oír: kaikki "oyen" / today "oír"; pensar: kaikki "piensan" / today "pensan" |
| indicativeImperfectPast1sES | 97.5% | 87.3% | 99.4% (2548) | ver: kaikki "veía" / today "vía"; oír: kaikki "oía" / today "oír"; personarse: kaikki "personaba" / today "personarse"; freír: kaikki "freía" / today "freír"; prever: kaikki "preveía" / today "prevía" |
| indicativeImperfectPast2sES | 97.5% | 87.3% | 99.4% (2548) | ver: kaikki "veías" / today "vías"; oír: kaikki "oías" / today "oír"; personarse: kaikki "personabas" / today "personarse"; freír: kaikki "freías" / today "freír"; prever: kaikki "preveías" / today "prevías" |
| indicativeImperfectPast3sES | 97.6% | 87.3% | 99.4% (2550) | ver: kaikki "veía" / today "vía"; oír: kaikki "oía" / today "oír"; personarse: kaikki "personaba" / today "personarse"; freír: kaikki "freía" / today "freír"; prever: kaikki "preveía" / today "prevía" |
| indicativeImperfectPast1plES | 97.5% | 87.3% | 99.4% (2548) | ver: kaikki "veíamos" / today "víamos"; oír: kaikki "oíamos" / today "oír"; personarse: kaikki "personábamos" / today "personarse"; freír: kaikki "freíamos" / today "freír"; prever: kaikki "preveíamos" / today "prevíamos" |
| indicativeImperfectPast2plES | 97.5% | 87.3% | 99.4% (2548) | ver: kaikki "veíais" / today "víais"; oír: kaikki "oíais" / today "oír"; personarse: kaikki "personabais" / today "personarse"; freír: kaikki "freíais" / today "freír"; prever: kaikki "preveíais" / today "prevíais" |
| indicativeImperfectPast3plES | 97.6% | 87.3% | 99.4% (2550) | ver: kaikki "veían" / today "vían"; oír: kaikki "oían" / today "oír"; personarse: kaikki "personaban" / today "personarse"; freír: kaikki "freían" / today "freír"; prever: kaikki "preveían" / today "prevían" |
| indicativePerfectSimplePast1sES | 97.5% | 87.3% | 96.7% (2548) | oír: kaikki "oí" / today "oír"; suponer: kaikki "supuse" / today "suponí"; personarse: kaikki "personé" / today "personarse"; maldecir: kaikki "maldije" / today "maldecí"; mantener: kaikki "mantuve" / today "mantení" |
| indicativePerfectSimplePast2sES | 97.5% | 87.3% | 96.9% (2548) | creer: kaikki "creíste" / today "creiste"; oír: kaikki "oíste" / today "oír"; suponer: kaikki "supusiste" / today "suponiste"; personarse: kaikki "personaste" / today "personarse"; maldecir: kaikki "maldijiste" / today "maldeciste" |
| indicativePerfectSimplePast3sES | 97.6% | 87.3% | 93.5% (2550) | sentir: kaikki "sintió" / today "sentió"; oír: kaikki "oyó" / today "oír"; suponer: kaikki "supuso" / today "suponió"; personarse: kaikki "personó" / today "personarse"; comedir: kaikki "comidió" / today "comedió" |
| indicativePerfectSimplePast1plES | 97.5% | 87.3% | 96.9% (2548) | creer: kaikki "creímos" / today "creimos"; oír: kaikki "oímos" / today "oír"; suponer: kaikki "supusimos" / today "suponimos"; personarse: kaikki "personamos" / today "personarse"; maldecir: kaikki "maldijimos" / today "maldecimos" |
| indicativePerfectSimplePast2plES | 97.5% | 87.3% | 96.9% (2548) | creer: kaikki "creísteis" / today "creisteis"; oír: kaikki "oísteis" / today "oír"; suponer: kaikki "supusisteis" / today "suponisteis"; personarse: kaikki "personasteis" / today "personarse"; maldecir: kaikki "maldijisteis" / today "maldecisteis" |
| indicativePerfectSimplePast3plES | 97.6% | 87.3% | 94.0% (2550) | sentir: kaikki "sintieron" / today "sentieron"; oír: kaikki "oyeron" / today "oír"; suponer: kaikki "supusieron" / today "suponieron"; personarse: kaikki "personaron" / today "personarse"; comedir: kaikki "comidieron" / today "comedieron" |
| indicativeFuture1sES | 97.5% | 87.3% | 98.0% (2548) | valer: kaikki "valdré" / today "valeré"; oír: kaikki "oiré" / today "oír"; venir: kaikki "vendré" / today "veniré"; salir: kaikki "saldré" / today "saliré"; suponer: kaikki "supondré" / today "suponeré" |
| indicativeFuture2sES | 97.5% | 87.3% | 98.0% (2548) | valer: kaikki "valdrás" / today "valerás"; oír: kaikki "oirás" / today "oír"; venir: kaikki "vendrás" / today "venirás"; salir: kaikki "saldrás" / today "salirás"; suponer: kaikki "supondrás" / today "suponerás" |
| indicativeFuture3sES | 97.6% | 87.3% | 98.0% (2550) | valer: kaikki "valdrá" / today "valerá"; oír: kaikki "oirá" / today "oír"; venir: kaikki "vendrá" / today "venirá"; salir: kaikki "saldrá" / today "salirá"; suponer: kaikki "supondrá" / today "suponerá" |
| indicativeFuture1plES | 97.5% | 87.3% | 98.0% (2548) | valer: kaikki "valdremos" / today "valeremos"; oír: kaikki "oiremos" / today "oír"; venir: kaikki "vendremos" / today "veniremos"; salir: kaikki "saldremos" / today "saliremos"; suponer: kaikki "supondremos" / today "suponeremos" |
| indicativeFuture2plES | 97.5% | 87.3% | 98.0% (2548) | valer: kaikki "valdréis" / today "valeréis"; oír: kaikki "oiréis" / today "oír"; venir: kaikki "vendréis" / today "veniréis"; salir: kaikki "saldréis" / today "saliréis"; suponer: kaikki "supondréis" / today "suponeréis" |
| indicativeFuture3plES | 97.6% | 87.3% | 98.0% (2550) | valer: kaikki "valdrán" / today "valerán"; oír: kaikki "oirán" / today "oír"; venir: kaikki "vendrán" / today "venirán"; salir: kaikki "saldrán" / today "salirán"; suponer: kaikki "supondrán" / today "suponerán" |
| indicativeConditional1sES | 97.5% | 0.0% | — |  |
| indicativeConditional2sES | 97.5% | 0.0% | — |  |
| indicativeConditional3sES | 97.6% | 0.0% | — |  |
| indicativeConditional1plES | 97.5% | 0.0% | — |  |
| indicativeConditional2plES | 97.5% | 0.0% | — |  |
| indicativeConditional3plES | 97.6% | 0.0% | — |  |
| imperative2sES | 97.4% | 0.0% | — |  |
| imperative2plES | 97.5% | 0.0% | — |  |
| imperative3sES | 97.4% | 0.0% | — |  |
| imperative1plES | 97.4% | 0.0% | — |  |
| imperative3plES | 97.4% | 0.0% | — |  |

### EN Noun — 5000 lemmas

Today: no route exists.

| case | kaikki | today | agree (both filled) | examples of disagreement |
|---|---|---|---|---|
| singularEN | 100.0% | — | — |  |
| pluralEN | 91.8% | — | — |  |

### EN Verb — 5000 lemmas

Today: found 91.5%, partial 0.0%, not found 8.5%, error 0.0%. kaikki fills at least one case for 427 lemmas that today does not find.

| case | kaikki | today | agree (both filled) | examples of disagreement |
|---|---|---|---|---|
| regularityEN | 98.0% | 0.0% | — |  |
| simplePresent1sEN | 100.0% | 91.5% | 100.0% (4573) |  |
| simplePresent2sEN | 100.0% | 91.5% | 100.0% (4573) |  |
| simplePresent3sEN | 98.2% | 91.5% | 98.7% (4539) | got: kaikki "got" / today "gots"; yes: kaikki "yeses" / today "yess"; gotta: kaikki "gotta" / today "gottas"; times: kaikki "timeses" / today "timess"; Christmas: kaikki "Christmases" / today "Christmass" |
| simplePresent1plEN | 100.0% | 91.5% | 100.0% (4573) |  |
| simplePresent3plEN | 100.0% | 91.5% | 100.0% (4573) |  |
| simplePast1sEN | 98.2% | 91.5% | 90.9% (4539) | can: kaikki "could" / today "caned"; will: kaikki "would" / today "willed"; got: kaikki "had" / today "goted"; yes: kaikki "yessed" / today "yesed"; must: kaikki "must" / today "musted" |
| simplePast2sEN | 98.2% | 91.5% | 90.9% (4539) | can: kaikki "could" / today "caned"; will: kaikki "would" / today "willed"; got: kaikki "had" / today "goted"; yes: kaikki "yessed" / today "yesed"; must: kaikki "must" / today "musted" |
| simplePast3sEN | 98.2% | 91.5% | 90.9% (4539) | can: kaikki "could" / today "caned"; will: kaikki "would" / today "willed"; got: kaikki "had" / today "goted"; yes: kaikki "yessed" / today "yesed"; must: kaikki "must" / today "musted" |
| simplePast1plEN | 98.2% | 91.5% | 90.9% (4539) | can: kaikki "could" / today "caned"; will: kaikki "would" / today "willed"; got: kaikki "had" / today "goted"; yes: kaikki "yessed" / today "yesed"; must: kaikki "must" / today "musted" |
| simplePast3plEN | 98.2% | 91.5% | 90.9% (4539) | can: kaikki "could" / today "caned"; will: kaikki "would" / today "willed"; got: kaikki "had" / today "goted"; yes: kaikki "yessed" / today "yesed"; must: kaikki "must" / today "musted" |
| simpleFuture1sEN | 100.0% | 91.5% | 100.0% (4573) |  |
| simpleFuture2sEN | 100.0% | 91.5% | 100.0% (4573) |  |
| simpleFuture3sEN | 100.0% | 91.5% | 100.0% (4573) |  |
| simpleFuture1plEN | 100.0% | 91.5% | 100.0% (4573) |  |
| simpleFuture3plEN | 100.0% | 91.5% | 100.0% (4573) |  |
| simpleConditional1sEN | 100.0% | 91.5% | 100.0% (4573) |  |
| simpleConditional2sEN | 100.0% | 91.5% | 100.0% (4573) |  |
| simpleConditional3sEN | 100.0% | 91.5% | 100.0% (4573) |  |
| simpleConditional1plEN | 100.0% | 91.5% | 100.0% (4573) |  |
| simpleConditional3plEN | 100.0% | 91.5% | 100.0% (4573) |  |

### Other parts of speech (light check)

### DE

| part of speech | lemmas in sample | measured | with any forms | most common form tags |
|---|---|---|---|---|
| Adjective | 3382 | 1000 | 96.1% | masculine,nominative,singular,strong 95.6%; masculine,nominative,singular,strong,without-article 94.0%; feminine,nominative,singular,strong,without-article 94.0%; neuter,nominative,singular,strong,without-article 94.0%; nominative,plural,strong,without-article 94.0%; genitive,masculine,singular,strong,without-article 94.0% |
| Adverb | 976 | 976 | 1.8% | comparative 1.3%; superlative 1.2%; masculine,predicative,singular 0.4%; feminine,predicative,singular 0.4%; neuter,predicative,singular 0.4%; plural,predicative 0.4% |
| Preposition | 99 | 99 | 18.2% | prepositional 18.2%; error-unrecognized-form 18.2% |
| Conjunction | 67 | 67 | 0.0% |  |
| Pronoun | 103 | 103 | 39.8% | genitive,masculine,singular 17.5%; genitive,neuter,singular 17.5%; neuter,nominative,singular 16.5%; feminine,genitive,singular 16.5%; dative,masculine,singular 16.5%; dative,neuter,singular 16.5% |
| Interjection | 181 | 181 | 13.8% | canonical 13.3%; nominative,singular 0.6%; definite,nominative,plural 0.6%; genitive,singular 0.6%; definite,genitive,plural 0.6%; dative,singular 0.6% |
| Proper noun | 1709 | 1000 | 70.7% | genitive 56.0%; genitive,with-article 22.0%; plural 17.8%; genitive,masculine 10.2%; feminine,genitive 10.2%; nominative,singular 8.7% |
| Numerals | 57 | 57 | 5.3% | neuter,nominative,singular 1.8%; accusative,neuter,singular 1.8%; masculine,nominative,singular,strong,without-article 1.8%; feminine,nominative,singular,strong,without-article 1.8%; neuter,nominative,singular,strong,without-article 1.8%; nominative,plural,strong,without-article 1.8% |

### ES

| part of speech | lemmas in sample | measured | with any forms | most common form tags |
|---|---|---|---|---|
| Adjective | 4088 | 1000 | 98.2% | feminine,plural 69.2%; feminine 69.1%; masculine,plural 69.1%; feminine,masculine,plural 28.5%; superlative 8.9%; masculine,singular 0.6% |
| Adverb | 588 | 588 | 1.5% | superlative 0.7%; comparative 0.3%; canonical 0.3%; Latin-America,superlative 0.2%; abbreviation,apocopic 0.2% |
| Preposition | 39 | 39 | 0.0% |  |
| Conjunction | 32 | 32 | 6.3% | canonical 6.3% |
| Pronoun | 95 | 95 | 43.2% | feminine,plural 18.9%; feminine 17.9%; plural 14.7%; masculine,plural 13.7%; neuter 6.3%; masculine 4.2% |
| Interjection | 222 | 222 | 21.6% | canonical 19.8%; plural 1.8%; feminine 0.9%; feminine,plural 0.9%; canonical,masculine 0.5% |
| Proper noun | 967 | 967 | 2.0% | demonym 0.9%; canonical,masculine 0.6%; canonical 0.3%; feminine 0.2%; feminine,plural 0.2%; plural 0.1% |
| Numerals | 48 | 48 | 22.9% | feminine 20.8%; masculine 4.2%; standard 2.1% |

### EN

| part of speech | lemmas in sample | measured | with any forms | most common form tags |
|---|---|---|---|---|
| Adjective | 8390 | 1000 | 75.8% | superlative 75.7%; comparative 75.4%; proscribed,superlative 0.2%; abbreviation 0.2%; positive 0.1%; adverb 0.1% |
| Adverb | 1348 | 1000 | 52.9% | superlative 52.9%; comparative 52.8%; abbreviation 0.1%; comparative,uncommon 0.1%; superlative,uncommon 0.1% |
| Preposition | 143 | 143 | 0.0% |  |
| Conjunction | 70 | 70 | 0.0% |  |
| Pronoun | 165 | 165 | 24.8% | plural 9.1%; reflexive 8.5%; objective 4.2%; possessive 4.2%; reflexive,singular 3.0%; possessive,pronoun,without-noun 2.4% |
| Interjection | 597 | 597 | 1.2% | canonical 1.2% |
| Proper noun | 7225 | 1000 | 36.0% | plural 35.2%; canonical 0.6%; canonical,plural 0.2%; abbreviation 0.1% |
| Numerals | 72 | 72 | 9.7% | plural 8.3%; ordinal 1.4% |

### Most frequent words kaikki did not match (first 40)

- **DE** (12706 of 50000 unmatched): im@64, alle@100, zum@105, hey@126, am@132, zur@173, mr.@181, sir@207, ins@229, vom@241, viele@257, beim@317, vielen@395, eure@404, mrs.@555, the@557, john@562, captain@570, jack@596, wow@691, sam@736, mr@795, daddy@826, aufs@886, york@887, meisten@894, charlie@914, joe@921, you@952, george@958, mary@987, monsieur@1011, fürs@1015, chffffff@1053, nen@1076, aller@1079, ans@1174, de@1175, and@1176, james@1200
- **ES** (9712 of 50000 unmatched): el@6, lo@10, del@31, tu@34, al@35, todos@75, tus@183, todas@212, toda@225, algún@266, cualquier@282, ningún@391, ok@456, john@573, jack@624, the@702, sam@718, michael@827, frank@839, charlie@841, tom@851, george@860, io@897, mike@898, peter@1004, paul@1052, cuántos@1081, ben@1105, james@1113, max@1124, harry@1177, mary@1218, you@1236, ia@1247, bill@1256, jimmy@1258, jim@1278, danny@1305, nick@1325, alex@1327
- **EN** (5137 of 50000 unmatched): didn@105, doesn@188, isn@198, wasn@259, wouldn@276, wanna@323, couldn@336, shouldn@564, hasn@795, i-i@991, hadn@1158, 'ii@1167, uh-huh@1452, 'all@1606, thousands@1705, ohh@1797, fbi@1822, 'clock@2055, mustn@2510, i-@2564, u.s.@2717, 'you@2832, you-@2898, chffffff@3179, just-@3218, somethin@3235, l.a.@3570, 's-@3778, 'the@3780, 'and@3798, dont@3922, von@3924, aii@3995, uh-@4319, iike@4322, mmm-hmm@4515, 't-@4561, i.d.@4674, and-@4886, yöu@5020

## Appendix B — Estonian measurement (`measure-et.ts`)


Sample: Pikhof base words with a frequency rank, top 5000 per part of speech. Eesthetic v1.0.5 has 10551 lexemes; 40295 cells have more than one form.

| part of speech | sampled | in Eesthetic (any POS) | in Eesthetic (same POS) | kaikki entry | kaikki entry with forms | in neither Eesthetic nor kaikki |
|---|---|---|---|---|---|---|
| Noun | 5000 | 52.0% | 51.9% | 40.0% | 38.4% | 38.6% |
| Verb | 738 | 100.0% | 100.0% | 56.8% | 56.4% | 0.0% |
| Adjective | 2137 | 3.1% | 3.1% | 21.5% | 20.6% | 77.8% |

#### Noun: Eesthetic fill rate per case

| case | filled |
|---|---|
| singularNimetavEE | 51.9% |
| pluralNimetavEE | 51.9% |
| singularOmastavEE | 51.9% |
| pluralOmastavEE | 51.9% |
| singularOsastavEE | 51.9% |
| pluralOsastavEE | 51.9% |
| shortFormEE | 33.3% |

Most frequent lemmas in neither source: üks, oleks, tead, saan, kaks, saad, i, lase, parem, kuule, suur, ühe, väike, kolm, õige, terve, kullake, parim, teist, sir, panna, issand, lähe, viimane, halb

#### Verb: Eesthetic fill rate per case

| case | filled |
|---|---|
| infinitiveMaEE | 100.0% |
| infinitiveDaEE | 100.0% |
| kindelPresent1sEE | 100.0% |
| kindelSimplePast1sEE | 100.0% |
| kindelPresent2sEE | 100.0% |
| kindelSimplePast2sEE | 100.0% |
| kindelPresent3sEE | 100.0% |
| kindelSimplePast3sEE | 100.0% |
| kindelPresent1plEE | 100.0% |
| kindelSimplePast1plEE | 100.0% |
| kindelPresent2plEE | 100.0% |
| kindelSimplePast2plEE | 100.0% |
| kindelPresent3plEE | 100.0% |
| kindelSimplePast3plEE | 100.0% |
| kindelPastPerfect1sEE | 100.0% |
| kindelPastPerfect2sEE | 100.0% |
| kindelPastPerfect3sEE | 100.0% |
| kindelPastPerfect1plEE | 100.0% |
| kindelPastPerfect2plEE | 100.0% |
| kindelPastPerfect3plEE | 100.0% |

Most frequent lemmas in neither source: 

#### Adjective: Eesthetic fill rate per case

| case | filled |
|---|---|
| singularNimetavEE | 3.1% |
| pluralNimetavEE | 3.1% |
| singularOmastavEE | 3.1% |
| pluralOmastavEE | 3.1% |
| singularOsastavEE | 3.1% |
| pluralOsastavEE | 3.1% |
| shortFormEE | 1.3% |

Most frequent lemmas in neither source: korras, parem, päris, kuradi, elus, läinud, parim, tehtud, neetud, mööda, kadunud, väärt, seotud, ülejäänud, kuradima, kohutav, ainuke, imeline, pask, suurem, hullem, huvitatud, valus, armunud, rahul


## Appendix C — Translation measurement (`measure-translations.ts`)


### Forward: English → other languages (top 5000 English lemmas)

| English | lemmas | translated senses | lemmas with ES | with DE | with ET | senses with ES | with DE | with ET |
|---|---|---|---|---|---|---|---|---|
| verb | 5000 | 7750 | 57.3% | 57.1% | 12.7% | 75.1% | 81.0% | 11.3% |
| noun | 5000 | 10098 | 70.1% | 70.1% | 46.2% | 78.3% | 85.2% | 33.2% |

### Reverse: can the language start a lookup? (top 5000 lemmas found as a translation word)

| language | nouns | verbs |
|---|---|---|
| es | 91.8% of 5000 | 84.2% of 2947 |
| de | 91.9% of 5000 | 78.9% of 4413 |
| et | 58.1% of 5000 | 57.6% of 738 |

## Appendix D — Size estimate (`estimate-size.ts`)


Layout A: one `lexeme_form` row per form (strategy doc §12). Layout B: one jsonb column of forms per `lexeme`, cells equal to the lemma not stored (filled from the lemma at read time).

| language | lexemes | A: forms | A: total | B: stored forms | B: total |
|---|---|---|---|---|---|
| de | 69,280 | 753,532 | 89.6 MB | 444,082 | 27.2 MB |
| es | 80,138 | 547,716 | 69.3 MB | 465,782 | 30.2 MB |
| en | 553,310 | 2,077,506 | 286.8 MB | 735,222 | 113.0 MB |
| et | 10,551 | 120,048 | 14.5 MB | 108,220 | 5.7 MB |
| translations (EN → es/de/et) | — | 329,854 rows | 39.5 MB | same | 39.5 MB |

Total without translations: A 460.1 MB, B 176.1 MB. With translations: A 499.7 MB, B 215.7 MB. Postgres pages are not full, so allow up to +30%.
