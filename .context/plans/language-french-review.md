# French word forms: review sheet for a native speaker

Made 2026-10-26 (slice 7 of `language-french.md`). The forms are a first draft by the assistant. A French teacher checks them. This sheet is about the **word forms** (what a learner types for a noun, a verb, an adjective, an adverb, a conjunction and a preposition) and about **practice**. The interface texts have their own sheet: `language-french-strings.md`.

## How to review

1. Read "What Ladu stores" (below).
2. For each part of speech, read the field table and the two filled examples. Is each field useful? Is each example correct French?
3. Answer the questions at the end of each section, in the "Answer" column. A short "yes" or "no, because…" is enough.
4. To see the real form: run the app (`npm run dev`), register with French as a learning language, open "New word", choose the part of speech, and press the "Français" button.

## What Ladu stores

A **Word** is one idea with a translation in each language (English, Spanish, German, Estonian, French). A learner fills in the French card of a word with the **forms** of the French word. The first design keeps the forms small, so entering a word is fast. Everything stored is used in practice and in statistics.

- A **field** is one box or choice on the card.
- A **property** is a choice (for example the gender). It is stored, but it is not a "written form": a search for "le" does not find every masculine noun.
- A **required** field must be filled before the word can be saved. Every other field is optional.
- All labels are French. The values of the radio buttons and selects (for example "Regular", "Subordinating") are English text in every interface language (question G1).
- Words in the tables below: the French label is the text on the screen. "Kind" says how the field works.

## General questions

| # | Question | Answer |
|---|---|---|
| G1 | The values of the choices are English in the French interface: "Regular / Irregular", "Not reflexive / Always reflexive / Optionally reflexive", "Coordinating / Subordinating", "Indicative / Subjunctive / Conditional / Depends on meaning", "Before the noun / After the noun / Before or after the noun", "Gradable / Non-gradable". Only the field labels are French. Should these be French too? (It needs a display layer, because the English value is what is stored.) | |
| G2 | Only the **indicative** is stored for the verb (présent, imparfait, passé composé, futur simple). Which other forms must a learner of French have first? (Subjunctive, conditional, imperative, passé simple, plus-que-parfait, futur antérieur.) | |
| G3 | The labels use "tu" in sentences that speak to the learner (decision R1 in the strings sheet). Do the field labels need a change? | |

## Noun

| Field | French label | Kind | Required | Values / note |
|---|---|---|---|---|
| Gender | Genre | radio | yes | `le`, `la`, `le/la` (a noun used with both articles: le/la collègue). A property. |
| Regularity | Régularité | radio | no | Regular / Irregular. It means the plural. A property. |
| Singular | Singulier | text | yes | The word in the singular. |
| Plural | Pluriel | text | no | The word in the plural. |

**Example 1.** Genre: `le`. Régularité: Irregular. Singulier: `cheval`. Pluriel: `chevaux`.
**Example 2.** Genre: `le/la`. Régularité: Regular. Singulier: `collègue`. Pluriel: `collègues`.

| # | Question | Answer |
|---|---|---|
| N1 (M2) | French shortens the article before a vowel or a mute h: *l'arbre*, *l'homme*; but *le héros* (aspirated h). The form stores only `le` or `la`. Wherever the screen joins article and noun, "le arbre" would be wrong, so the screen shows the gender apart from the noun (a small chip). Is that acceptable? Should the form also store the elided form? | |
| N2 | Is "le/la" the right name for nouns with both genders (*le/la collègue*, *le/la élève*)? Also: nouns that change meaning with the gender (*le livre*, *la livre*; *le mode*, *la mode*) are two words in Ladu. Is that right? | |
| N3 (F2) | The gender filter in the words table holds the article, so "la" selects feminine nouns of Spanish and French together. Is that a problem for a learner? | |

## Verb

The grid shows the **Indicatif**. One column per tense (Présent, Imparfait, Passé composé, Futur simple). One row per person (Je/J', Tu, Il/Elle/On, Nous, Vous, Ils/Elles).

| Field | French label | Kind | Required | Values / note |
|---|---|---|---|---|
| Infinitive | Infinitif | text | yes | Must end in -er, -ir or -re. `se laver` and `s'habiller` are valid. |
| Auxiliary verb | Verbe auxiliaire | toggle | no | `avoir` or `être`. Decides the helper word shown before the participle in the passé composé. A property. |
| Past participle | Participe passé | text | no | Used in practice (infinitive → participle). |
| Present participle | Participe présent | text | no | |
| Verb group | Groupe du verbe | radio | no | `1er groupe`, `2e groupe`, `3e groupe`. Replaces "regular / irregular". A property. |
| Reflexivity | Réflexivité | radio | no | Not reflexive / Always reflexive / Optionally reflexive. A property. |
| Tense forms | (grid) | text | no | 24 boxes. In the passé composé the helper word (ai, as, a, avons, avez, ont, or suis, es, est, sommes, êtes, sont) shows before each box: the learner types the participle. |

**Example 1: parler.** Infinitif `parler`; Verbe auxiliaire `avoir`; Participe passé `parlé`; Participe présent `parlant`; Groupe `1er groupe`; Réflexivité: Not reflexive.

| | Présent | Imparfait | Passé composé (after the helper) | Futur simple |
|---|---|---|---|---|
| Je/J' | parle | parlais | parlé | parlerai |
| Tu | parles | parlais | parlé | parleras |
| Il/Elle/On | parle | parlait | parlé | parlera |
| Nous | parlons | parlions | parlé | parlerons |
| Vous | parlez | parliez | parlé | parlerez |
| Ils/Elles | parlent | parlaient | parlé | parleront |

**Example 2: aller.** Infinitif `aller`; Verbe auxiliaire `être`; Participe passé `allé`; Participe présent `allant`; Groupe `3e groupe`.

| | Présent | Imparfait | Passé composé (after the helper) | Futur simple |
|---|---|---|---|---|
| Je/J' | vais | allais | allé | irai |
| Tu | vas | allais | allé | iras |
| Il/Elle/On | va | allait | allé | ira |
| Nous | allons | allions | allés | irons |
| Vous | allez | alliez | allés | irez |
| Ils/Elles | vont | allaient | allés | iront |

A reflexive verb (*se laver*, "Always reflexive") shows the pronoun before each box: *me, te, se, nous, vous, se* (in the passé composé before the helper: *me suis* + lavé).

| # | Question | Answer |
|---|---|---|
| V1 (m1) | The verb group replaces the regular / irregular radio: groups 1 and 2 are regular, group 3 holds the irregular verbs. A few group 1 verbs change their spelling (*appeler → j'appelle*, *manger → nous mangeons*). Is the group enough, or must the form say "regular / irregular" as well? | |
| V2 | Is "Groupe du verbe" with the values "1er / 2e / 3e groupe" the term you would use with learners? | |
| V3 (V3) | The pronoun hint writes the full pronoun (me, te, se) and the label says "Je/J'". Elision (*je m'appelle*, *j'aime*) is not shown. Is that acceptable for a first version? | |
| V4 (V4) | The participle can be typed twice: in each passé composé box (so the agreement with *être* fits: *allés*) and in the field "Participe passé" (so practice can ask it). The two can differ. Is that a problem? | |
| V5 | For a verb with *être* the learner types the agreement in each box (*allé*, *allée*, *allés*, *allées*). Is one box per person enough, or must the form store the four agreement forms? | |
| V6 | In the passé composé the helper shows "suis, es, est…" or "ai, as, a…" from the toggle. Some verbs take both (*il a descendu l'escalier*, *il est descendu*). Should the toggle allow "both"? | |

## Adjective

| Field | French label | Kind | Required | Values / note |
|---|---|---|---|---|
| Male singular | Masculin singulier | text | yes | The citation form. |
| Male plural | Masculin pluriel | text | no | |
| Female singular | Féminin singulier | text | yes | The form a learner must know. |
| Female plural | Féminin pluriel | text | no | |
| Uses "plus" | Utilise « plus » (plus + adjectif) | box | no | With the box on, the comparative is "plus " + the male singular, locked. A property. |
| Comparative | Comparatif (masculin singulier) | text | no | Typed when the box is off (bon → meilleur). |
| Superlative | Superlatif (masculin singulier) | text, locked | no | Never typed: "le " + the comparative. |
| Form before a vowel | A une forme devant une voyelle / Forme devant une voyelle | box + text | no | beau → bel, nouveau → nouvel, vieux → vieil. |
| Position | Position | radio | no | Before the noun / After the noun / Before or after the noun. A property. |

**Example 1: beau.** Masculin singulier `beau`; masculin pluriel `beaux`; féminin singulier `belle`; féminin pluriel `belles`. « plus »: on. Comparatif: `plus beau`. Superlatif: `le plus beau`. Forme devant une voyelle: `bel`. Position: Before the noun.
**Example 2: bon.** `bon`, `bons`, `bonne`, `bonnes`. « plus »: off. Comparatif: `meilleur`. Superlatif: `le meilleur`. Position: Before the noun.

| # | Question | Answer |
|---|---|---|
| A1 (F1/F5) | The comparative and the superlative are stored in the male singular only. French agrees them: *plus grande*, *les plus grands*; *meilleure*, *meilleurs*, *meilleures*. The form cannot store those forms. Is the male singular enough for a first version? | |
| A2 | The superlative is stored with the singular masculine article ("le plus beau"). Is "le" right as the stored form, or is "le/la/les" better? | |
| A3 (F4) | The position wording ("Before the noun" …) is English. For a French teacher: are three positions enough (*un grand homme* / *un homme grand*: the meaning changes)? | |
| A4 | Other adjectives with a special form before a vowel: *fou → fol*, *mou → mol*. Is "form before a vowel" the right name (the grammar says "forme devant voyelle ou h muet")? | |

## Adverb

| Field | French label | Kind | Required | Values / note |
|---|---|---|---|---|
| Gradable | Gradable | radio | yes | Gradable / Non-gradable. A property. "Non-gradable" hides the three fields below. |
| Adverb | Adverbe | text | yes | |
| Uses "plus" | Utilise « plus » (plus + adverbe) | box | no | With the box on, the comparative is "plus " + the adverb, locked. A property. |
| Comparative | Comparatif | text | no | Typed when the box is off. |
| Superlative | Superlatif | text, locked | no | Never typed: "le " + the comparative. |

**Example 1: vite.** Gradable. Adverbe `vite`. « plus »: on. Comparatif `plus vite`. Superlatif `le plus vite`.
**Example 2: bien.** Gradable. Adverbe `bien`. « plus »: off. Comparatif `mieux`. Superlatif `le mieux`.
**Non-gradable:** `hier` (the three fields are hidden).

| # | Question | Answer |
|---|---|---|
| D1 (S6-2) | Irregular degrees are typed by hand: *bien → mieux → le mieux*; *beaucoup → plus → le plus*; *peu → moins → le moins*; *mal → plus mal / pis*. Are there other adverbs to list? Should the form propose "mieux" for "bien"? | |
| D2 | *Aussi … que* (equality) and *moins … que* (inferiority) are not stored. Should the form have a "moins" box too? | |
| D3 | The word "Gradable" is used as the label (a learner term). Is there a better French term (« graduable », « comparable »)? | |

## Conjunction

| Field | French label | Kind | Required | Values / note |
|---|---|---|---|---|
| Conjunction | Conjonction | text | yes | Several words are allowed (*bien que*, *parce que*). |
| Second part | Deuxième partie | text | yes, while shown | Shown only while the box "En paire" is on. |
| Type | Type | radio | no | Coordinating / Subordinating. A property. A second click clears it. |
| Paired | En paire (p. ex. ni … ni) | box | no | For *ni … ni*, *soit … soit*, *tantôt … tantôt*, *non seulement … mais aussi*. A property. |
| Mood | Mode du verbe | select | no | Shown only for "Subordinating". Indicative / Subjunctive / **Conditional** / Depends on meaning. A property. |

**Example 1: bien que.** Conjonction `bien que`. Type: Subordinating. Mode: Subjunctive.
**Example 2: soit … soit.** Conjonction `soit`. Type: Coordinating. En paire: on. Deuxième partie: `soit`.
**Example 3: au cas où.** Conjonction `au cas où`. Type: Subordinating. Mode: Conditional.

| # | Question | Answer |
|---|---|---|
| C1 (S6-1) | The conditional is a fourth mood value. The source is Le Robert, guide « Conjonctions de subordination »: *alors même que*, *quand (bien) même* and *au cas où* take the conditional. Is the list of four values right? Is the conditional also needed for *même si* (no: *si* takes the imparfait) and *comme si*? | |
| C2 | "Depends on meaning" covers *de sorte que*, *encore que*, *si bien que*. *Après que* takes the indicative by rule, but the subjunctive is common in use. Which value should the form propose for *après que*? | |
| C3 | The type has two values. French grammars also split the subordinating conjunctions by meaning (cause, but, concession, temps…). Is a learner helped by a "meaning" field? | |
| C4 | Is *car*, *mais*, *ou*, *et*, *donc*, *or*, *ni* ("mais où est donc Ornicar") a good first list of coordinating conjunctions? What about *soit* and *puis*? | |

## Preposition

| Field | French label | Kind | Required | Values / note |
|---|---|---|---|---|
| Preposition | Préposition | text | yes | Several words are allowed (*à côté de*, *grâce à*). |
| Position | Position | radio | no | Before the noun / After the noun / Before or after the noun. A property. A second click clears it. |

**Example 1: à côté de.** Préposition `à côté de`. Position: Before the noun.
**Example 2: durant.** Préposition `durant`. Position: Before or after the noun (*durant l'hiver*; *trois heures durant*).

There is **no field** for *au, aux, du, des*. They are the article contractions of *à* and *de* (à + le = au, à + les = aux, de + le = du, de + les = des). It is a general rule, not a property of one word, so it is not stored (Spanish *al*, *del* works the same way; German has a field because its contractions depend on the preposition).

| # | Question | Answer |
|---|---|---|
| P1 (S6-4) | *Durant* follows the noun in a fixed set (*trois heures durant*, *sa vie durant*). *Nonobstant* is probably postposed in legal text (*nonobstant appel*); no source confirmed it. Is "Before or after the noun" right for both? Which other prepositions can follow the noun (*suivant*, *vu*, *excepté*, *y compris*)? | |
| P2 | Prepositions govern no case in French. The verb decides which preposition follows (*penser à*, *parler de*). This "verb valency" is not stored. Is it the next field a learner would want? | |
| P3 | Prepositional phrases (*à côté de*, *au-dessus de*, *afin de*) are stored as one preposition. Is that right? | |

## Practice (exercises)

French words are used in practice like the other languages. Adjectives, adverbs, conjunctions and prepositions have no exercises yet.

| What | How it works in French |
|---|---|
| Noun, between languages | The singular (and the plural) of the noun, from or to another language. Example: *caballo* → `cheval`. |
| Noun, gender drill | A multiple-choice card on the gender of `cheval`: `le` / `la` / `le/la`. |
| Verb, between languages | Present, past and future, one person. "Past" is the **imparfait** (*allais*), not the passé composé (the passé composé box holds only the participle, so it would be too easy). |
| Verb drills | The past participle is typed (`aller` → `allé`). The auxiliary (`avoir` / `être`) and the group (`1er` / `2e` / `3e groupe`) are chosen. |

| # | Question | Answer |
|---|---|---|
| X1 (M3) | The practice "past" tense is the imparfait. Is it the right first choice? Should the card ask for the passé composé (with the helper word)? | |
| X2 | The practice card shows the pronoun label "Je/J'" before the prompt (*Je/J' vais*) and before the answer box. A card should read *je vais* or *j'ai*. Elision needs a rule (vowel or mute h). Is the label acceptable for a first version? | |
| X3 | A learner can pick one of three strictness levels. The default forgives capital letters only: *Allé* counts as "almost correct", and *alle* is wrong (*allé* ≠ *alle*). Level 1 also forgives missing accents; level 3 is exact. Is the default right for French, where an accent changes the word (*a* / *à*, *ou* / *où*, *sur* / *sûr*)? | |
| X4 | The practice question texts are new: « Quel est le participe passé de ce verbe ? », « À quel groupe ce verbe appartient-il ? », « Saisis le participe passé… ». Are they natural? | |

## Not stored yet (first version)

The subjunctive, the conditional (as a verb mood), the imperative, the passé simple, the plus-que-parfait, the futur antérieur, the agreement of the comparative and the superlative, the elided article (*l'*), pronoun verbs with indirect objects, the verb valency (*penser à*), and exercises for adjectives, adverbs, conjunctions and prepositions. Question G2 asks which of these come first.

## Sources used for the first design

Wiktionnaire (*bien*, *mieux*, *durant*, "Annexe : Comparatif et superlatif", "Conjonctions de coordination en français"); CNRTL (*mieux*, *ni*, *nonobstant*, *préposition*); Le Robert, guides « Conjonctions de subordination » and « Conjonctions de coordination ». Bescherelle and Grevisse (*Le Bon Usage*) are the next sources to check: a teacher with them at hand can confirm questions C1, C2 and P1.
