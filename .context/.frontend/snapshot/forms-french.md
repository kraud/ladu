# Ladu Word Forms — French (Field Spec, v2 only)

French has no form in the old app. This file is the spec of the v2 French forms (plan `plans/language-french.md`). Code: the French builder in each file of `frontend/src/features/words/form-engine/configs/`; tests next to them. The first design is by the assistant. A French teacher reviews it (the questions are in the plan, review log). Case names end in `FR`.

Added so far: the noun and the adjective (slice 4). The verb (slice 5) and the adverb, conjunction and preposition (slice 6) are added here when they are built.

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
| Comparative (`comparative`) | `comparativeFR` | text | no | While "Uses plus" is on, it shows and saves `plus ` + the male singular (read-only). Irregular ones (bon → meilleur) are typed with the box off. |
| Superlative (`superlative`) | `superlativeFR` | text, always locked | no | Never typed. Shows and saves `le ` + the comparative: "le plus beau" while the box is on (the comparative is itself locked then), "le meilleur" for a typed comparative. Empty box with the placeholder "Depends on the comparative" while there is no comparative. A written form (searchable, usable in exercises). |
| Uses "plus" (`periphrastic`) | `periphrasticFR` | checkbox, stored as "true" | no | A property. |
| Has a form before a vowel (`hasVowelForm`) | `hasVowelFormFR` | checkbox, stored as "true" | no | A property. Shows the next field (beau → bel, nouveau → nouvel, vieux → vieil). |
| Form before a vowel (`vowelForm`) | `vowelFormFR` | text | yes, while shown | A written form. |
| Position (`position`) | `positionFR` | radio: Before the noun / After the noun / Before or after the noun | no | A property. The meaning can change with the position (un grand homme, un homme grand). |

**One form for the comparative and the superlative.** Both are stored in the male singular, the citation form. French also agrees them with the noun: plus grande, les plus grands; la plus grande, les plus grands; meilleur, meilleure, meilleurs, meilleures. The form does not store those forms: the agreement forms of the positive are already in the card, and the others follow from them. This is a limit of the form, not a rule of French. The plan lists it as a question for the teacher (review log F1).

Property prefixes (`backend/services/exercises/catalogue.ts`): `gender`, `regularity`, `periphrastic`, `position`, `hasVowelForm`. `vowelFormFR` starts with none of them, so search and exercises read it as a written form.
