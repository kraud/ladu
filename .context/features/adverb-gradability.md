# Adverb gradability (the Gradable radio and the "more / most" boxes)

## Summary

An adverb may or may not have degrees (fast, faster, fastest). In every language the adverb form now asks one required question first: "Gradable" or "Non-gradable". An adverb with no degrees ("damals", "seejärel") is therefore complete, not unfinished. For English, Spanish, Estonian and French, a checkbox says that the degree is made with a word ("more / most", "más", "kõige", "plus"), and the form fills that field from the base word and locks it. Autocomplete and the onboarding pool fill the radio where the data is reliable.

Live spec. It replaces a finished plan (archive record: `.context/archive/2026-10-adverb-gradable-radio.md`). Built 2026-10-24 (slices 1 to 4); the user checked it in the app on 2026-11-02 (English "quickly", German "oft" and "hier", Estonian "kiiresti", and the Non-gradable path in each language). Gates: `e2e/tests/autocomplete-g-adjectives-adverbs.spec.ts` and `language-french-forms.spec.ts`. The field lists: `.context/.frontend/snapshot/forms-adjectives-adverbs.md`.

Code map: frontend `frontend/src/features/words/form-engine/configs/adverbs.ts` (`gradableRadio`, `periphrasticCheckbox`, `degreeField`, `derivedFrom`), `configs/types.ts` (the `derivedWhen` rule with `store: true`), `ts/enums.ts` (`AdverbCases`); backend `controllers/wordController.ts` and `services/exercises/catalogue.ts` (`PROPERTY_PREFIXES` has `gradable` and `periphrastic`), lexicon selectors `lib/lexicon/selectors/{en,es,de,fr}.ts`, `services/dictionary/eki.ts` (Estonian), `lib/onboardingPool.ts` (`adverbPoolCases`).

## 1. Decisions (taken with the user on 2026-10-24)

| ID | Decision |
|---|---|
| Q1 | The radio is **required** in all languages, because an adverb can have no degree at all. |
| Q2 | Existing words stay as they are; nobody migrates them. When the user opens an old EN, ES or EE adverb, the radio is empty and required until a value is picked. The completion ring counts the radio, so the ring of an old adverb drops until then (German already worked this way). Autocomplete, the onboarding pool and the demo template get the new value. |
| Q4 | EN and ES get a checkbox like the Estonian one, for adverbs that form the degree with a word. When it is on, the derived field shows the prefix and the base word, read-only. |
| Q5 | Adverbs with no degrees in any language are "Non-gradable" (DE "damals" = EE "seejärel"). |
| Q6 | The autocomplete removes the prefix ("more", "most", "más", "am", "kõige") from the data it receives, fills the fields without the prefix, and sets the checkbox. |
| Q7 | English has **one** checkbox ("Uses more / most", `periphrasticEN`). It derives the comparative ("more " + adverb) and the superlative ("most " + adverb). A mixed shape ("more X" with a one-word superlative) is typed as text with the box off. |
| Q8 | Spanish: the checkbox (`periphrasticComparativeES`) derives the comparative only ("más " + adverb). The superlative is always typed ("prontísimo"). |
| Q9 | The form stores **both** the derived text ("more usually") and the checkbox value. The derived field is locked in the form, but its text is saved. The checkbox is a property of the word, which later features can use to filter or select practice targets. So the Estonian derived superlative ("kõige X") is stored too (`store: true`). |

German keeps its fixed "am" before the superlative (strategy D25). A fixed prefix does not fit EN or ES, because some values have the prefix and some do not ("mejor", "peor"). French follows the same pattern with `periphrasticFR` ("plus " and "le plus ", `features/french.md`).

## 2. Autocomplete and pool rules

- **Gradable only when data shows it.** If the lexicon has a comparative or a superlative, the radio is "Gradable". If it has none, the radio is left empty and the user chooses. **No language fills "Non-gradable"** (user, 2026-10-24: German follows the same rule). Reason: the lexicon has degree forms for about 53 % of English adverbs, 1.5 % of Spanish adverbs, and Estonian from Ekilex relations (`research/autocomplete-coverage-report.md`).
- **Prefix rules:** EN, when a regex finds `^more\s+<adverb>$` and `^most\s+<adverb>$`, sends no comparative and no superlative and sets `periphrasticEN`. ES, when the comparative is "más " + the adverb, sends none and sets `periphrasticComparativeES`; "mejor" and "peor" stay as typed text. DE strips "am". EE sends `periphrasticSuperlativeEE` (strategy D27: "kõige …" first). A mixed or unknown shape leaves the box off and fills typed text.
- **Onboarding pool:** the pool rule is "Gradable if the entry has a comparative or a superlative, else Non-gradable" (a short curated list a person can check). `adverbPoolCases` also rebuilds the phrase of the periphrastic boxes ("more usually"), because the lookup sends the box without the phrase and Q9 says a saved word holds both. Never edit `pool-forms.json` by hand; change the script and rebuild.
- **Demo template:** the two adverbs have the values. After a data change, reseed per environment with `--reset`.

## 3. Findings

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | Moderate | Old EN, ES and EE adverbs have no radio value; the required radio blocks the next save. | Accepted (Q2). |
| 2 | Moderate | A missing comparative does not prove "Non-gradable" for EN, ES and EE. | Autocomplete never sets Non-gradable (section 2). |
| 3 | Moderate | The exercise code did not know the metadata cases `periphrastic*`, so `periphrasticSuperlativeEE` could be used as a written form. | Fixed: `periphrastic` is in `PROPERTY_PREFIXES`, and the metadata filters ignore `periphrastic%` (test `exercisesCatalogue.test.js`). |
| 4, 5 | Moderate | A derived form that was not stored was invisible to practice, search and the table; Estonian did not store its derived superlative. | Fixed by Q9. |

## 4. Traps

- The pool entries that come out Non-gradable only because the sources list no degree form: ES "usualmente", DE "gewöhnlich", EE "varsti".
- The Estonian adverb form is `periphrasticSuperlativeEE`; there is no Estonian adverb in the old app.

## 5. Open items

- Review the new ES, DE and EE strings of this feature (the error messages of the required radio).
- Review the 10 adverb entries of the onboarding pool (known doubtful ones are in section 4). It is a data check; it does not block anything.

Closed 2026-11-02 (confirmed by the user): the check of the form in the app.
