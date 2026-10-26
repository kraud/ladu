# Ladu Word Forms — French (Field Spec, v2 only)

French has no form in the old app. This file is the spec of the v2 French forms (plan `plans/language-french.md`). Code: the French builder in each file of `frontend/src/features/words/form-engine/configs/`; tests next to them. The first design is by the assistant. A French teacher reviews it (the questions are in the plan, review log). Case names end in `FR`.

Added so far: the noun and the adjective (slice 4), the verb (slice 5) and the adverb, conjunction and preposition (slice 6). All six parts of speech have a French form.

## Noun (`nouns.ts`, built from the `WordCasesData.Noun` rows)

| Field (form name) | Case name | Kind | Required | Notes |
|---|---|---|---|---|
| Gender (`gender`) | `genderFR` | radio: `le` / `la` / `le/la` | yes | A property. Row "meta", first cell. `le/la` is for a noun used with either article (le/la collègue). Elision (l'arbre) is not stored: the gender stays le or la. |
| Regularity (`regularity`) | `regularityFR` | radio: regular / irregular | no | A property. Means the plural: cheval → chevaux is irregular. Row "meta", second cell. |
| Singular (`singular`) | `singularFR` | text | yes | lowercase. Headline word of the word in the words table. |
| Plural (`plural`) | `pluralFR` | text | no | lowercase. Singular and plural share one row. |

French nouns have no cases. The shape is the Spanish noun with a different set of articles.

**Layout (Spanish, German and French).** Gender and regularity share one row, two equal columns, on a desktop and on a phone (`layout.fitRow`). The cells align at the top (`layout.alignTop`), so the two labels line up when the options of one radio group wrap on a phone. The block has its own key (`nounMeta`), so it does not merge with the singular and plural rows. English and Estonian have no gender: their regularity stays alone in its row.

## Adjective (`adjectives.ts`)

| Field (form name) | Case name | Kind | Required | Notes |
|---|---|---|---|---|
| Male singular (`maleSingular`) | `maleSingularFR` | text | yes | Headline word. Row "male", column Singular. |
| Male plural (`malePlural`) | `malePluralFR` | text | no | Row "male", column Plural. |
| Female singular (`femaleSingular`) | `femaleSingularFR` | text | yes | The feminine is what a learner must know (grand → grande). Row "female". |
| Female plural (`femalePlural`) | `femalePluralFR` | text | no | |
| Uses "plus" (`periphrastic`) | `periphrasticFR` | checkbox, stored as "true" | no | A property. Sits on the row above the comparative and the superlative. |
| Comparative (`comparative`) | `comparativeFR` | text | no | Shares one row with the superlative (two equal columns, also on a phone: `fitRow`). While "Uses plus" is on, it shows and saves `plus ` + the male singular (read-only). Irregular ones (bon → meilleur) are typed with the box off. |
| Superlative (`superlative`) | `superlativeFR` | text, always locked | no | Never typed. Shows and saves `le ` + the comparative: "le plus beau" while the box is on (the comparative is itself locked then), "le meilleur" for a typed comparative. Second cell of the comparative's row. Empty box with the placeholder "Depends on the comparative" while there is no comparative. A written form (searchable, usable in exercises). |
| Has a form before a vowel (`hasVowelForm`) | `hasVowelFormFR` | checkbox, stored as "true" | no | A property. Shows the next field (beau → bel, nouveau → nouvel, vieux → vieil). |
| Form before a vowel (`vowelForm`) | `vowelFormFR` | text | yes, while shown | A written form. |
| Position (`position`) | `positionFR` | radio: Before the noun / After the noun / Before or after the noun | no | A property. The meaning can change with the position (un grand homme, un homme grand). |

**One form for the comparative and the superlative.** Both are stored in the male singular, the citation form. French also agrees them with the noun: plus grande, les plus grands; la plus grande, les plus grands; meilleur, meilleure, meilleurs, meilleures. The form does not store those forms: the agreement forms of the positive are already in the card, and the others follow from them. This is a limit of the form, not a rule of French. The plan lists it as a question for the teacher (review log F1).

Property prefixes (`backend/services/exercises/catalogue.ts`): `gender`, `regularity`, `periphrastic`, `position`, `hasVowelForm`. `vowelFormFR` starts with none of them, so search and exercises read it as a written form.

## Verb (`verbs.ts`, `buildFrConfig`)

The Indicatif only: présent, imparfait, passé composé, futur simple. Subjunctive, conditional, imperative and the passé simple are left to a later round (teacher question). The first design is by the assistant; the user confirmed it on 2026-10-26.

| Field (form name) | Case name | Kind | Required | Notes |
|---|---|---|---|---|
| Infinitive (`infinitive`) | `infinitiveFR` | text | yes | lowercase. Must end in -er, -ir or -re, with no digit. "se laver" and "s'habiller" are valid. Headline word of the word in the words table. Row `meta1`, first cell. |
| Auxiliary verb (`auxiliaryVerb`) | `auxVerbFR` | toggle: avoir / être | no | A property. Row `meta1`, second cell. Drives the auxiliary shown in the passé composé. |
| Past participle (`pastParticiple`) | `pastParticipleFR` | text | no | A written form. Row `meta2`, first cell. A practice drill: infinitive → past participle. |
| Present participle (`presentParticiple`) | `presentParticipleFR` | text | no | A written form. Row `meta2`, second cell. |
| Verb group (`verbGroup`) | `verbGroupFR` | radio: 1er groupe / 2e groupe / 3e groupe | no | A property. Replaces the regular / irregular radio: groups 1 and 2 are the regular verbs, group 3 holds all the others. Row `meta3`, first cell. A practice drill. |
| Reflexivity (`reflexivity`) | `reflexivityFR` | radio: Not reflexive / Always reflexive / Optionally reflexive | no | A property, the same options as Spanish and German. Row `meta3`, second cell. No pronoun-case radio: me, te, se are the same for the direct and the indirect object. |
| Tense forms (`indicativePresent1s` …) | `indicative<Tense><Person>FR` | text | no | `<Tense>` = `Present`, `Imperfect`, `Perfect`, `SimpleFuture`. `<Person>` = `1s 2s 3s 1pl 2pl 3pl`. Group heading "Indicatif"; one column per tense (Présent, Imparfait, Passé composé, Futur simple); one row per person. |

**Pronoun labels.** Je/J', Tu, Il/Elle/On, Nous, Vous, Ils/Elles. "Je/J'" because the passé composé shows "ai" after it (j'ai). The labels use tu and vous, as the plan says (decision R1). They are native terms, not translated.

**Passé composé.** The conjugated auxiliary shows before each box, from the auxiliary toggle: ai, as, a, avons, avez, ont (avoir) or suis, es, est, sommes, êtes, sont (être). The user types the participle in each box. So the être agreement (allés, allée) can be stored. The auxiliary is a read-only hint: it is not saved in the box.

**Reflexive hint.** While the verb is "Always reflexive", each box shows me, te, se, nous, vous, se before the verb. In the passé composé it stands before the auxiliary: "me suis" + lavé (the German hint stands after it: "habe mich"). The hint writes the full pronoun: the elision before a vowel (m', t', s') is not shown. This is a limit for the teacher list.

**Layout.** Three rows of two cells, aligned at the top (`layout.alignTop`): infinitive and auxiliary; past and present participle (both rows keep two equal cells on a phone: `layout.fitRow`); verb group and reflexivity (two radio groups: one row on a desktop, one under the other on a phone: `layout.stackOnMobile`; the same for Spanish regularity and reflexivity). Each row has its own block key (`verb-meta1` …), so the rows do not merge. The tense grid is scrolled sideways on a phone, as for German.

**Practice** (`backend/services/exercises/catalogue.ts`). Present → `indicativePresent`, "past" → `indicativeImperfect` (the passé composé form is only a participle, so it would be too easy: review log M3), future → `indicativeSimpleFuture`. Drills: auxiliary (multiple choice, avoir / être), verb group (multiple choice), past participle (text input, from the infinitive).

Property prefixes: `auxVerb`, `reflexiv`, `verbGroup` (new). `pastParticipleFR`, `presentParticipleFR`, `infinitiveFR` and every tense form start with none of them, so search and exercises read them as written forms (regression test in `exercisesCatalogue.test.js`).

## Adverb (`adverbs.ts`, `buildFrConfig`)

The adverb copies the Spanish builder and takes the "plus" mechanism of the French adjective. Decision of 2026-10-26 (user confirmed the recommended option).

| Field (form name) | Case name | Kind | Required | Notes |
|---|---|---|---|---|
| Gradable (`gradable`) | `gradableFR` | radio: Gradable / Non-gradable | yes | A property. First field, as in EN, ES, DE and EE. "Non-gradable" hides the box and both degree fields. |
| Adverb (`adverb`) | `adverbFR` | text | yes | lowercase. Headline word of the word in the words table. |
| Uses "plus" (`periphrastic`) | `periphrasticFR` | checkbox, stored as "true" | no | A property. Sits on the row above the degrees. Visible unless "Non-gradable". |
| Comparative (`comparative`) | `comparativeFR` | text | no | While the box is on, it shows and saves `plus ` + the adverb (read-only): "plus vite". With the box off the user types the form: bien → mieux, beaucoup → plus. |
| Superlative (`superlative`) | `superlativeFR` | text, always locked | no | Never typed. Shows and saves `le ` + the comparative: "le plus vite" while the box is on, "le mieux" after the typed comparative "mieux". Empty box with the placeholder "Depends on the comparative" while there is no comparative. A written form. |

**Layout.** The comparative and the superlative share one row, two equal columns, also on a phone (`layout.fitRow`, `alignTop`, block `frDegree`): the same layout as the French adjective. Checked on screens at 1280 and 375 px.

**Irregular degrees.** The form stores the superlative with its article ("le mieux"). It is the same limit as for the adjective (review log F5): the form does not store the agreement forms, which for an adverb do not exist anyway. Sources: Wiktionnaire "bien", "mieux"; CNRTL "mieux" (the comparative of *bien*; the superlative is *le mieux*).

## Conjunction (`conjunctions.ts`, shared `buildConfig` + `moodSelect`)

| Field (form name) | Case name | Kind | Required | Notes |
|---|---|---|---|---|
| Conjunction (`conjunction`) | `conjunctionFR` | text | yes | lowercase. Multi-word entries are allowed ("bien que", "parce que"). Row `word`, first cell. |
| Second part (`secondPart`) | `secondPartFR` | text | yes, while shown | A written form. Shown while "Paired" is on. Row `word`, second cell. |
| Type (`conjunctionType`) | `conjunctionTypeFR` | radio: Coordinating / Subordinating | no | A property. A re-click clears it. Row `meta`, first cell. |
| Paired (`correlative`) | `correlativeFR` | checkbox, stored as "true" | no | A property. For ni … ni, soit … soit, tantôt … tantôt. Row `meta`, second cell. |
| Verb mood (`mood`) | `moodFR` | select: Indicative / Subjunctive / **Conditional** / Depends on meaning | no | A property. Shown only for "Subordinating". Row `mood`. |

**Why a fourth value.** The Spanish select has three. French needs the conditional: "au cas où", "quand (bien) même" and "alors même que" are followed by the conditional (Le Robert, guide "Conjonctions de subordination"). "Depends on meaning" covers "de sorte que" and "encore que" (indicative or subjunctive). *Bien que*, *quoique* take the subjunctive. *Après que* takes the indicative by rule. The options are English text in every interface language (review log F4).

The first part of a pair and the second part are two fields, as in the other languages. French pairs have the same word twice (soit … soit): both boxes hold it.

## Preposition (`prepositions.ts`, `buildFrConfig`)

| Field (form name) | Case name | Kind | Required | Notes |
|---|---|---|---|---|
| Preposition (`preposition`) | `prepositionFR` | text | yes | lowercase. Multi-word entries are allowed ("à côté de", "grâce à"). Headline word. |
| Position (`position`) | `positionFR` | radio: Before the noun / After the noun / Before or after the noun | no | A property. A re-click clears it. Almost all French prepositions stand before the noun; "durant" can follow it ("trois heures durant", Wiktionnaire). |

**au / aux / du / des.** These are the article contractions of "à" and "de". They are a general rule, not a property of one word, so there is no field (the same as Spanish "al" and "del"; German has a field because the contraction depends on the preposition).

The preposition governs no case on the noun. Which preposition a verb takes (penser à, parler de) is verb valency: a later feature (see the German valency note in the memory).

Property prefixes: no new one. `gradableFR`, `periphrasticFR`, `conjunctionTypeFR`, `correlativeFR`, `moodFR` and `positionFR` start with an existing prefix. `adverbFR`, `comparativeFR`, `superlativeFR`, `conjunctionFR`, `secondPartFR` and `prepositionFR` start with none, so search reads them as written forms (regression test in `exercisesCatalogue.test.js`). Adverbs, conjunctions and prepositions have no exercises.
