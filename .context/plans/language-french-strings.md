# French interface strings: review sheet for a native speaker

Made 2026-10-26 (slice 3 of `language-french.md`). The French text is a first draft by the assistant. A native speaker must read it before the French interface goes live (review-log item M1 in the plan).

## How to review

1. Read the **decisions** (R1 to R10). Say yes, or give the better choice. A change of a term is a search-and-replace in the files.
2. Read the **glossary**. Each term is used in the same way in every file.
3. Read the **files**. Open the app in French (`npm run dev`, then choose Français in the language menu), or read the JSON files.
4. Write your answers in the "Answer" column or next to the string.

## Where the French text is

| Place | File | What the user sees |
|---|---|---|
| The app (14 files, about 1,400 strings) | `frontend/public/locales/fr/*.json` | Menus, forms, errors, practice, tags, the account, onboarding, the demo |
| Emails (36 strings) | `backend/utils/resources/emailStrings.js`, block `French` | Confirm email, reset password, invitation, "you can sign in now" |
| Topic names (16) | `backend/services/onboarding/labels.ts` and `onboarding.json` (`topics.names`) | Tag names made by the first-login setup. Both lists must stay equal (a test checks it). |
| Landing page (36) | `landing/app.js`, block `fr` | The public home page |
| The 404 page | `common.json` (`notFound.lines`) and `frontend/src/routes/not-found.tsx` | One more line in the rotating "nothing to see here" |

Not in French yet: the legal pages (Terms, Privacy Policy, Legal notice) and the blog. They are English only in every language.

## Decisions to confirm

| # | Decision | Alternative | Answer |
|---|---|---|---|
| R1 | **Register: "tu".** Spanish uses "tú", German "du", Estonian the informal imperative. French follows. Example: "Tu n'as pas encore d'amis." | "vous" (formal). It changes the verbs in every sentence that speaks to the user. | |
| R2 | **Typography.** A no-break space before `:` `;` `?` `!` and inside `« »`. The apostrophe is `’`. | Plain spaces and `'`. | |
| R3 | **"e-mail"** (with a hyphen). | "courriel", "email", "mail" | |
| R4 | **"Étiquette"** for a tag. | keep "tag" | |
| R5 | **"Entraînement"** for Practice (the page and the verb "s'entraîner"). | "Pratique", "Exercices" | |
| R6 | **"Classe grammaticale"** for part of speech. | "nature", "catégorie grammaticale" | |
| R7 | **Gender-neutral wording.** Where English says "a new {{category}}", French says "un mot de type «{{category}}»", because the type is masculine (nom) or feminine (préposition). The same for "Already registered?" → "Tu as déjà un compte ?". | A form with "(e)" | |
| R8 | **Grammar terms of other languages inside French sentences:** "Nominatif singulier", "Illatif court", "Génitif", "Partitif", "Datif", "Accusatif". The Estonian and German field names (`nimetav`, `nominativ`) stay as they are in quotes. | | |
| R9 | **Language names:** capital letter in lists ("Anglais", "Espagnol", "Français"), lower case after "en" ("en anglais"). In sentences with a variable, French uses parentheses: "Ajouter une traduction ({{language}})". | "en {{language}}" | |
| R10 | **The shelf metaphor stays:** "Ton étagère est prête." | | |

## Glossary

| English | French | Note |
|---|---|---|
| word | mot | A Ladu "Word" is one concept with its translations |
| translation | traduction | |
| tag | étiquette | R4 |
| practice / exercise | entraînement / exercice | R5 |
| part of speech | classe grammaticale | R6 |
| noun, verb, adjective, adverb, conjunction, preposition | nom, verbe, adjectif, adverbe, conjonction, préposition | Table short forms: n., v., adj., adv., conj., prép. |
| gender | genre | |
| regularity | régularité | |
| verb group | groupe du verbe | Slice 5. The values stored are "1er groupe", "2e groupe", "3e groupe". Replaces "régularité" for French verbs |
| past / present participle | participe passé / participe présent | Slice 5 |
| auxiliary verb | verbe auxiliaire | Slice 5. The toggle holds "avoir" and "être" |
| reflexive verb | verbe pronominal | In "Cas du pronom réfléchi" the standard term "pronom réfléchi" is used |
| mastered / revise | maîtrisé / à réviser | |
| follow / unfollow / clone | suivre / ne plus suivre / cloner | |
| dashboard, account, profile | tableau de bord, compte, profil | |
| sign in / log out / sign up | se connecter / se déconnecter / s'inscrire | |
| native language | langue maternelle | |
| interface language | langue de l'interface | |
| demo | démo | |
| label (name of a tag) | nom | English "label" is a name |
| pie chart | graphique circulaire | |
| gradable | gradable | Term kept for the adverb field |

## Strings that need a second look

- **Plurals.** French uses the singular for 0 and 1. Keys with a count have a `_one` and an `_other` form. Where English has a count without a plural form (for example "{{count}} correct"), French has both forms ("1 bonne réponse", "2 bonnes réponses"). One text still uses "(s)": `practice.json`, `results.almostHint` ("dont {{count}} presque correcte(s)").
- **`{{language}}` and `{{category}}` in a sentence.** The value is a name such as "Anglais". See R7 and R9.
- **Field labels of the other languages** in `wordRelated.json` (`wordForm.*.fields`). Example: "Illatif court" for the Estonian "short illative".
- **Examples of parts of speech** (`partOfSpeechSelector.description`): the sentences are French, with the word between `*…*`.
- **The demo text says "four languages"** (`demo.json`). It is true until the demo has French words (slice 11 of the plan). Then it changes in all five languages.
