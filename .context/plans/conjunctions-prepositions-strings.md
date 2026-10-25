# Conjunctions and prepositions: strings to review

Generated 2026-10-25 from `frontend/public/locales/{en,es,de,ee}/`. Plan: `conjunctions-prepositions.md`, slice 4. English is the reference. Please check the Spanish, German and Estonian columns: spelling, grammar and the technical terms (the Estonian PoS label for adpositions is "Kaassõna"). Option values such as "Coordinating" or "Before the noun" are shown in English in every language on purpose (they are the grammatical terms of the app, like "Gradable"); only the labels below are translated.

## Conjunction form: field labels

| Key | EN | ES | DE | EE |
|---|---|---|---|---|
| `conjunctionEN` | Conjunction | Conjunción | Konjunktion | Sidesõna |
| `conjunctionTypeEN` | Type | Tipo | Typ | Tüüp |
| `correlativeEN` | Paired (e.g. neither … nor) | En pareja (p. ej. ni … ni) | Zweiteilig (z. B. weder … noch) | Kaheosaline (nt nii … kui ka) |
| `secondPartEN` | Second part | Segunda parte | Zweiter Teil | Teine osa |
| `moodES` | Verb mood | Modo del verbo | Verbmodus | Verbi kõneviis |

## Conjunction form: error messages (the text is the same for EN, ES, DE and EE forms)

| Key | EN | ES | DE | EE |
|---|---|---|---|---|
| `formEN.conjunctionRequired` | Conjunction is required | La conjunción es obligatoria | Konjunktion ist erforderlich | Sidesõna on kohustuslik |
| `formEN.typeInvalid` | That is not an option | Esa no es una opción | Das ist keine Option | See pole valik |
| `formEN.secondPartRequired` | Second part is required | La segunda parte es obligatoria | Der zweite Teil ist erforderlich | Teine osa on kohustuslik |

## Preposition form: field labels

| Key | EN | ES | DE | EE |
|---|---|---|---|---|
| `prepositionEN` | Preposition | Preposición | Präposition | Kaassõna |
| `positionEN` | Position | Posición | Stellung | Asukoht |
| `governedCaseDE` | Case(s) of the noun | Caso(s) del sustantivo | Fall/Fälle des Nomens | Nimisõna kääne(d) |
| `contractsDE` | Contracts with the article | Se contrae con el artículo | Verschmilzt mit dem Artikel | Sulandub artikliga |
| `withDemDE` | With “dem” (e.g. zum) | Con «dem» (p. ej. zum) | Mit „dem“ (z. B. zum) | Artikliga „dem“ (nt zum) |
| `withDerDE` | With “der” (e.g. zur) | Con «der» (p. ej. zur) | Mit „der“ (z. B. zur) | Artikliga „der“ (nt zur) |
| `withDasDE` | With “das” (e.g. ins) | Con «das» (p. ej. ins) | Mit „das“ (z. B. ins) | Artikliga „das“ (nt ins) |
| `governedCasePreEE` | Case of the noun (word before it) | Caso del sustantivo (palabra delante) | Fall des Nomens (Wort davor) | Nimisõna kääne (sõna on ees) |
| `governedCasePostEE` | Case of the noun (word after it) | Caso del sustantivo (palabra detrás) | Fall des Nomens (Wort danach) | Nimisõna kääne (sõna on järel) |
| `spatialSeriesEE` | Has a where-to / where-from series | Tiene serie de destino / origen | Hat eine Wohin- / Woher-Reihe | On sisse- / seest-rida |
| `directionToEE` | Where to (e.g. sisse) | Hacia dónde (p. ej. sisse) | Wohin (z. B. sisse) | Kuhu (nt sisse) |
| `directionFromEE` | Where from (e.g. seest) | Desde dónde (p. ej. seest) | Woher (z. B. seest) | Kust (nt seest) |

## Preposition form: error messages

| Key | EN | ES | DE | EE |
|---|---|---|---|---|
| `formEN.prepositionRequired` | Preposition is required | La preposición es obligatoria | Präposition ist erforderlich | Kaassõna on kohustuslik |
| `formEN.positionInvalid` | That is not an option | Esa no es una opción | Das ist keine Option | See pole valik |

## Part-of-speech descriptions (shown on the /addWord cards)

| Key | EN | ES | DE | EE |
|---|---|---|---|---|
| `partOfSpeechSelector.description.conjunction.info` | Conjunctions join words, phrases or clauses. Coordinating conjunctions join equal parts (and, but, or). Subordinating conjunctions start a dependent clause (because, although, if). Some conjunctions work in pairs (neither … nor). | Las conjunciones unen palabras, grupos de palabras u oraciones. Las coordinantes unen partes del mismo nivel (y, pero, o). Las subordinantes introducen una oración dependiente (porque, aunque, si). Algunas conjunciones van en pareja (ni … ni). | Konjunktionen verbinden Wörter, Wortgruppen oder Sätze. Nebenordnende Konjunktionen verbinden gleichwertige Teile (und, aber, oder). Unterordnende Konjunktionen leiten einen Nebensatz ein (weil, obwohl, wenn). Manche Konjunktionen stehen paarweise (weder … noch). | Sidesõnad ühendavad sõnu, sõnarühmi või lauseid. Rinnastavad sidesõnad ühendavad võrdseid osi (ja, aga, või). Alistavad sidesõnad alustavad kõrvallauset (sest, kuigi, kui). Mõned sidesõnad esinevad paarina (nii … kui ka). |
| `...conjunction.examples[0]` | I like tea *and* coffee. | Me gusta el té *y* el café. | Ich mag Tee *und* Kaffee. | Mulle meeldib tee *ja* kohv. |
| `...conjunction.examples[1]` | She stayed home *because* she was ill. | Se quedó en casa *porque* estaba enferma. | Sie blieb zu Hause, *weil* sie krank war. | Ta jäi koju, *sest* ta oli haige. |
| `...conjunction.examples[2]` | He speaks *neither* French *nor* Italian. | No habla *ni* francés *ni* italiano. | Er spricht *weder* Französisch *noch* Italienisch. | Ta ei räägi *ega* prantsuse *ega* itaalia keelt. |
| `partOfSpeechSelector.description.preposition.info` | Prepositions show how a noun relates to another word: place, time, cause or direction. In German, a preposition decides the case of the noun after it. Estonian mostly uses postpositions, which stand after the noun. | Las preposiciones muestran la relación de un sustantivo con otra palabra: lugar, tiempo, causa o dirección. En alemán, la preposición decide el caso del sustantivo que la sigue. El estonio usa sobre todo posposiciones, que van detrás del sustantivo. | Präpositionen zeigen, wie ein Nomen zu einem anderen Wort steht: Ort, Zeit, Grund oder Richtung. Im Deutschen bestimmt die Präposition den Fall des folgenden Nomens. Das Estnische verwendet meist Postpositionen, die hinter dem Nomen stehen. | Kaassõnad näitavad, kuidas nimisõna on seotud teise sõnaga: koht, aeg, põhjus või suund. Saksa keeles määrab eessõna järgneva nimisõna käände. Eesti keeles on enamik kaassõnu tagasõnad, mis seisavad nimisõna järel. |
| `...preposition.examples[0]` | The book is *on* the table. | El libro está *sobre* la mesa. | Das Buch liegt *auf* dem Tisch. | Raamat on laua *peal*. |
| `...preposition.examples[1]` | We met *after* the lesson. | Nos vimos *después de* la clase. | Wir trafen uns *nach* dem Unterricht. | Kohtusime *pärast* tundi. |
| `...preposition.examples[2]` | She stayed home *because of* the rain. | Se quedó en casa *a causa de* la lluvia. | Sie blieb *wegen* des Regens zu Hause. | Ta jäi vihma *tõttu* koju. |

## Practice screen: the "no exercises yet" texts

| Key | EN | ES | DE | EE |
|---|---|---|---|---|
| `practice:setup.hints.noExercisesYet` | Adjectives, adverbs, conjunctions and prepositions have no exercises yet. | Los adjetivos, los adverbios, las conjunciones y las preposiciones aún no tienen ejercicios. | Für Adjektive, Adverbien, Konjunktionen und Präpositionen gibt es noch keine Übungen. | Omadussõnade, määrsõnade, sidesõnade ja kaassõnade jaoks ei ole veel harjutusi. |
| `practice:setup.hints.posPreselected` | With selected words, only their word types can be chosen. Adjectives, adverbs, conjunctions and prepositions have no exercises yet. | Con palabras seleccionadas, solo se pueden elegir sus tipos de palabra. Los adjetivos, los adverbios, las conjunciones y las preposiciones aún no tienen ejercicios. | Bei ausgewählten Wörtern sind nur deren Wortarten wählbar. Für Adjektive, Adverbien, Konjunktionen und Präpositionen gibt es noch keine Übungen. | Valitud sõnade puhul saab valida ainult nende sõnaliike. Omadussõnade, määrsõnade, sidesõnade ja kaassõnade jaoks ei ole veel harjutusi. |

## Part-of-speech name for the Estonian adposition

| Key | EN | ES | DE | EE |
|---|---|---|---|---|
| `common:partOfSpeech.preposition` | Preposition | Preposición | Präposition | Kaassõna |
