# Ladu Word Forms — French (Field Spec, v2 only)

French has no form in the old app. This file is the spec of the v2 French forms (plan `plans/language-french.md`). Code: the French builder in each file of `frontend/src/features/words/form-engine/configs/`; tests next to them. The first design is by the assistant. A French teacher reviews it (the questions are in the plan, review log). Case names end in `FR`.

Added so far: the noun and the adjective (slice 4). The verb (slice 5) and the adverb, conjunction and preposition (slice 6) are added here when they are built.

## Noun (`nouns.ts`, built from the `WordCasesData.Noun` rows)

| Field (form name) | Case name | Kind | Required | Notes |
|---|---|---|---|---|
| Gender (`gender`) | `genderFR` | radio: `le` / `la` / `le/la` | yes | A property. `le/la` is for a noun used with either article (le/la collègue). Elision (l'arbre) is not stored: the gender stays le or la. |
| Regularity (`regularity`) | `regularityFR` | radio: regular / irregular | no | A property. Means the plural: cheval → chevaux is irregular. |
| Singular (`singular`) | `singularFR` | text | yes | lowercase. Headline word of the word in the words table. |
| Plural (`plural`) | `pluralFR` | text | no | lowercase. Singular and plural share one row. |

French nouns have no cases. The shape is the Spanish noun with a different set of articles.

## Adjective (`adjectives.ts`)

| Field (form name) | Case name | Kind | Required | Notes |
|---|---|---|---|---|
| Male singular (`maleSingular`) | `maleSingularFR` | text | yes | Headline word. Row "male", column Singular. |
| Male plural (`malePlural`) | `malePluralFR` | text | no | Row "male", column Plural. |
| Female singular (`femaleSingular`) | `femaleSingularFR` | text | yes | The feminine is what a learner must know (grand → grande). Row "female". |
| Female plural (`femalePlural`) | `femalePluralFR` | text | no | |
| Comparative (`comparative`) | `comparativeFR` | text | no | While "Uses plus" is on, it shows and saves `plus ` + the male singular (read-only). Irregular ones (bon → meilleur) are typed with the box off. |
| Uses "plus" (`periphrastic`) | `periphrasticFR` | checkbox, stored as "true" | no | A property. |
| Has a form before a vowel (`hasVowelForm`) | `hasVowelFormFR` | checkbox, stored as "true" | no | A property. Shows the next field (beau → bel, nouveau → nouvel, vieux → vieil). |
| Form before a vowel (`vowelForm`) | `vowelFormFR` | text | yes, while shown | A written form. |
| Position (`position`) | `positionFR` | radio: Before the noun / After the noun / Before or after the noun | no | A property. The meaning can change with the position (un grand homme, un homme grand). |

**No superlative field.** French builds the superlative from the comparative: le / la / les + the comparative (le plus grand, le meilleur). A separate field would repeat the comparative. The plan lists this as a question for the teacher.

Property prefixes (`backend/services/exercises/catalogue.ts`): `gender`, `regularity`, `periphrastic`, `position`, `hasVowelForm`. `vowelFormFR` starts with none of them, so search and exercises read it as a written form.
