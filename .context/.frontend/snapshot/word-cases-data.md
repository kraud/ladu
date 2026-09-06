# WordCasesData — Verbatim Field Specification

Source: `frontend/src/ts/wordCasesDataByPoS.ts` (1,192 lines) — the exported `WordCasesData` object.

**Totals:** `Noun[]` = 21 entries; `Verb[]` = 111 entries.

## Shape (type definitions, lines 14–73)

```ts
export type NounCasesData = {
    caseName: NounCases,
    language: Lang,
} & (NounData | NounOtherPropertyData)

export type NounData = {
    isNounProperty: false,
    plurality: Plurality,
    declination: DeclensionNoun,
}

export enum NounPropertyCategories {
    gender = 'Gender',
    shortForm = 'Short-Form',
}

export type NounOtherPropertyData = {
    isNounProperty: true,
    nounPropertyCategory: NounPropertyCategories,
}

export type VerbCasesData = {
    caseName: VerbCases,
    language: Lang
} & (VerbTenseData | VerbOtherPropertyData)

export type VerbTenseData = {
    isVerbProperty: false,
    person: 1 | 2 | 3,
    plurality: Plurality,
    tense: TenseVerbEN | TenseVerbES | TenseVerbDE | TenseVerbEE,
    mood?: VerbMoodDE | VerbMoodEN | VerbMoodES | VerbMoodEE,
}

export enum VerbPropertyCategories {
    regularity = 'Regularity',
    infinitive = 'Infinitive', // NOT IN ENGLISH
    // SPANISH
    gerund = 'Gerund',
    participle = 'Participle',
    // GERMAN
    verbCaseType = 'VerbCase-Type', // declension? see: accusativeDE, dativeDE, genitiveDE
    auxiliaryVerb = 'Auxiliary-Verb',
    caseType = 'Case-Type',
    prefix = 'Prefix',
    // NOT SURE ========
    progressive = 'Progressive',
    perfect = 'Perfect',
    perfectProgressive = 'Perfect-Progressive',
}

export type VerbOtherPropertyData = {
    isVerbProperty: true,
    verbPropertyCategory: VerbPropertyCategories,
}

export interface WordCasesDataByPoS {
    Noun: NounCasesData[],
    Verb: VerbCasesData[],
}
```

## Counts per language

| PoS | EN | ES | DE | EE | Total |
|-----|----|----|----|----|-------|
| Noun | 2 | 3 | 9 | 7 | **21** |
| Verb | 21 | 42 | 28 | 20 | **111** |

---

## Noun[] — 21 entries (verbatim, in source order)

### English (EN) — 2 entries

| # | caseName | language | isNounProperty | plurality | declination |
|---|----------|----------|----------------|-----------|-------------|
| 1 | `NounCases.singularEN` | `Lang.EN` | `false` | `Plurality.S` | `DeclensionNoun.nominative` |
| 2 | `NounCases.pluralEN` | `Lang.EN` | `false` | `Plurality.P` | `DeclensionNoun.nominative` |

### Spanish (ES) — 3 entries

| # | caseName | language | isNounProperty | plurality | declination | nounPropertyCategory |
|---|----------|----------|----------------|-----------|-------------|----------------------|
| 1 | `NounCases.genderES` | `Lang.ES` | `true` | — | — | `NounPropertyCategories.gender` |
| 2 | `NounCases.singularES` | `Lang.ES` | `false` | `Plurality.S` | `DeclensionNoun.nominative` | — |
| 3 | `NounCases.pluralES` | `Lang.ES` | `false` | `Plurality.P` | `DeclensionNoun.nominative` | — |

### German (DE) — 9 entries

| # | caseName | language | isNounProperty | plurality | declination | nounPropertyCategory |
|---|----------|----------|----------------|-----------|-------------|----------------------|
| 1 | `NounCases.genderDE` | `Lang.DE` | `true` | — | — | `NounPropertyCategories.gender` |
| 2 | `NounCases.singularNominativDE` | `Lang.DE` | `false` | `Plurality.S` | `DeclensionNoun.nominative` | — |
| 3 | `NounCases.pluralNominativDE` | `Lang.DE` | `false` | `Plurality.P` | `DeclensionNoun.nominative` | — |
| 4 | `NounCases.singularAkkusativDE` | `Lang.DE` | `false` | `Plurality.S` | `DeclensionNoun.accusative` | — |
| 5 | `NounCases.pluralAkkusativDE` | `Lang.DE` | `false` | `Plurality.P` | `DeclensionNoun.accusative` | — |
| 6 | `NounCases.singularGenitivDE` | `Lang.DE` | `false` | `Plurality.S` | `DeclensionNoun.genitive` | — |
| 7 | `NounCases.pluralGenitivDE` | `Lang.DE` | `false` | `Plurality.P` | `DeclensionNoun.genitive` | — |
| 8 | `NounCases.singularDativDE` | `Lang.DE` | `false` | `Plurality.S` | `DeclensionNoun.dative` | — |
| 9 | `NounCases.pluralDativDE` | `Lang.DE` | `false` | `Plurality.P` | `DeclensionNoun.dative` | — |

### Estonian (EE) — 7 entries

| # | caseName | language | isNounProperty | plurality | declination | nounPropertyCategory |
|---|----------|----------|----------------|-----------|-------------|----------------------|
| 1 | `NounCases.singularNimetavEE` | `Lang.EE` | `false` | `Plurality.S` | `DeclensionNoun.nominative` | — |
| 2 | `NounCases.pluralNimetavEE` | `Lang.EE` | `false` | `Plurality.P` | `DeclensionNoun.nominative` | — |
| 3 | `NounCases.singularOmastavEE` | `Lang.EE` | `false` | `Plurality.S` | `DeclensionNoun.genitive` | — |
| 4 | `NounCases.pluralOmastavEE` | `Lang.EE` | `false` | `Plurality.P` | `DeclensionNoun.genitive` | — |
| 5 | `NounCases.singularOsastavEE` | `Lang.EE` | `false` | `Plurality.S` | `DeclensionNoun.partitive` | — |
| 6 | `NounCases.pluralOsastavEE` | `Lang.EE` | `false` | `Plurality.P` | `DeclensionNoun.partitive` | — |
| 7 | `NounCases.shortFormEE` | `Lang.EE` | `true` | — | — | `NounPropertyCategories.shortForm` |

---

## Verb[] — 111 entries (verbatim, in source order)

### English (EN) — 21 entries

| # | caseName | language | isVerbProperty | verbPropertyCategory | plurality | person | tense | mood |
|---|----------|----------|----------------|----------------------|-----------|--------|-------|------|
| 1 | `VerbCases.regularityEN` | `Lang.EN` | `true` | `VerbPropertyCategories.regularity` | — | — | — | — |
| 2 | `VerbCases.simplePresent1sEN` | `Lang.EN` | `false` | — | `Plurality.S` | `1` | `TenseVerbEN.presentSimple` | `VerbMoodEN.indicativeEN` |
| 3 | `VerbCases.simplePresent2sEN` | `Lang.EN` | `false` | — | `Plurality.S` | `2` | `TenseVerbEN.presentSimple` | `VerbMoodEN.indicativeEN` |
| 4 | `VerbCases.simplePresent3sEN` | `Lang.EN` | `false` | — | `Plurality.S` | `3` | `TenseVerbEN.presentSimple` | `VerbMoodEN.indicativeEN` |
| 5 | `VerbCases.simplePresent1plEN` | `Lang.EN` | `false` | — | `Plurality.P` | `1` | `TenseVerbEN.presentSimple` | `VerbMoodEN.indicativeEN` |
| 6 | `VerbCases.simplePresent3plEN` | `Lang.EN` | `false` | — | `Plurality.P` | `3` | `TenseVerbEN.presentSimple` | `VerbMoodEN.indicativeEN` |
| 7 | `VerbCases.simplePast1sEN` | `Lang.EN` | `false` | — | `Plurality.S` | `1` | `TenseVerbEN.pastSimple` | `VerbMoodEN.indicativeEN` |
| 8 | `VerbCases.simplePast2sEN` | `Lang.EN` | `false` | — | `Plurality.S` | `2` | `TenseVerbEN.pastSimple` | `VerbMoodEN.indicativeEN` |
| 9 | `VerbCases.simplePast3sEN` | `Lang.EN` | `false` | — | `Plurality.S` | `3` | `TenseVerbEN.pastSimple` | `VerbMoodEN.indicativeEN` |
| 10 | `VerbCases.simplePast1plEN` | `Lang.EN` | `false` | — | `Plurality.P` | `1` | `TenseVerbEN.pastSimple` | `VerbMoodEN.indicativeEN` |
| 11 | `VerbCases.simplePast3plEN` | `Lang.EN` | `false` | — | `Plurality.P` | `3` | `TenseVerbEN.pastSimple` | `VerbMoodEN.indicativeEN` |
| 12 | `VerbCases.simpleFuture1sEN` | `Lang.EN` | `false` | — | `Plurality.S` | `1` | `TenseVerbEN.futureSimple` | `VerbMoodEN.indicativeEN` |
| 13 | `VerbCases.simpleFuture2sEN` | `Lang.EN` | `false` | — | `Plurality.S` | `2` | `TenseVerbEN.futureSimple` | `VerbMoodEN.indicativeEN` |
| 14 | `VerbCases.simpleFuture3sEN` | `Lang.EN` | `false` | — | `Plurality.S` | `3` | `TenseVerbEN.futureSimple` | `VerbMoodEN.indicativeEN` |
| 15 | `VerbCases.simpleFuture1plEN` | `Lang.EN` | `false` | — | `Plurality.P` | `1` | `TenseVerbEN.futureSimple` | `VerbMoodEN.indicativeEN` |
| 16 | `VerbCases.simpleFuture3plEN` | `Lang.EN` | `false` | — | `Plurality.P` | `3` | `TenseVerbEN.futureSimple` | `VerbMoodEN.indicativeEN` |
| 17 | `VerbCases.simpleConditional1sEN` | `Lang.EN` | `false` | — | `Plurality.S` | `1` | `TenseVerbEN.conditionalSimple` | `VerbMoodEN.conditionalEN` |
| 18 | `VerbCases.simpleConditional2sEN` | `Lang.EN` | `false` | — | `Plurality.S` | `2` | `TenseVerbEN.conditionalSimple` | `VerbMoodEN.conditionalEN` |
| 19 | `VerbCases.simpleConditional3sEN` | `Lang.EN` | `false` | — | `Plurality.S` | `3` | `TenseVerbEN.conditionalSimple` | `VerbMoodEN.conditionalEN` |
| 20 | `VerbCases.simpleConditional1plEN` | `Lang.EN` | `false` | — | `Plurality.P` | `1` | `TenseVerbEN.conditionalSimple` | `VerbMoodEN.conditionalEN` |
| 21 | `VerbCases.simpleConditional3plEN` | `Lang.EN` | `false` | — | `Plurality.P` | `3` | `TenseVerbEN.conditionalSimple` | `VerbMoodEN.conditionalEN` |

### Spanish (ES) — 42 entries

| # | caseName | language | isVerbProperty | verbPropertyCategory | plurality | person | tense | mood |
|---|----------|----------|----------------|----------------------|-----------|--------|-------|------|
| 1 | `VerbCases.regularityES` | `Lang.ES` | `true` | `VerbPropertyCategories.regularity` | — | — | — | — |
| 2 | `VerbCases.infinitiveNonFiniteSimpleES` | `Lang.ES` | `true` | `VerbPropertyCategories.infinitive` | — | — | — | — |
| 3 | `VerbCases.gerundNonFiniteSimpleES` | `Lang.ES` | `true` | `VerbPropertyCategories.gerund` | — | — | — | — |
| 4 | `VerbCases.participleNonFiniteSimpleES` | `Lang.ES` | `true` | `VerbPropertyCategories.participle` | — | — | — | — |
| 5 | `VerbCases.infinitiveNonFiniteCompound` | `Lang.ES` | `true` | `VerbPropertyCategories.infinitive` | — | — | — | — |
| 6 | `VerbCases.gerundNonFiniteCompound` | `Lang.ES` | `true` | `VerbPropertyCategories.gerund` | — | — | — | — |
| 7 | `VerbCases.indicativePresent1sES` | `Lang.ES` | `false` | — | `Plurality.S` | `1` | `TenseVerbES.present` | `VerbMoodES.indicativeES` |
| 8 | `VerbCases.indicativePresent2sES` | `Lang.ES` | `false` | — | `Plurality.S` | `2` | `TenseVerbES.present` | `VerbMoodES.indicativeES` |
| 9 | `VerbCases.indicativePresent3sES` | `Lang.ES` | `false` | — | `Plurality.S` | `3` | `TenseVerbES.present` | `VerbMoodES.indicativeES` |
| 10 | `VerbCases.indicativePresent1plES` | `Lang.ES` | `false` | — | `Plurality.P` | `1` | `TenseVerbES.present` | `VerbMoodES.indicativeES` |
| 11 | `VerbCases.indicativePresent2plES` | `Lang.ES` | `false` | — | `Plurality.P` | `2` | `TenseVerbES.present` | `VerbMoodES.indicativeES` |
| 12 | `VerbCases.indicativePresent3plES` | `Lang.ES` | `false` | — | `Plurality.P` | `3` | `TenseVerbES.present` | `VerbMoodES.indicativeES` |
| 13 | `VerbCases.indicativeImperfectPast1sES` | `Lang.ES` | `false` | — | `Plurality.S` | `1` | `TenseVerbES.imperfectPast` | `VerbMoodES.indicativeES` |
| 14 | `VerbCases.indicativeImperfectPast2sES` | `Lang.ES` | `false` | — | `Plurality.S` | `2` | `TenseVerbES.imperfectPast` | `VerbMoodES.indicativeES` |
| 15 | `VerbCases.indicativeImperfectPast3sES` | `Lang.ES` | `false` | — | `Plurality.S` | `3` | `TenseVerbES.imperfectPast` | `VerbMoodES.indicativeES` |
| 16 | `VerbCases.indicativeImperfectPast1plES` | `Lang.ES` | `false` | — | `Plurality.P` | `1` | `TenseVerbES.imperfectPast` | `VerbMoodES.indicativeES` |
| 17 | `VerbCases.indicativeImperfectPast2plES` | `Lang.ES` | `false` | — | `Plurality.P` | `2` | `TenseVerbES.imperfectPast` | `VerbMoodES.indicativeES` |
| 18 | `VerbCases.indicativeImperfectPast3plES` | `Lang.ES` | `false` | — | `Plurality.P` | `3` | `TenseVerbES.imperfectPast` | `VerbMoodES.indicativeES` |
| 19 | `VerbCases.indicativePerfectSimplePast1sES` | `Lang.ES` | `false` | — | `Plurality.S` | `1` | `TenseVerbES.perfectSimplePast` | `VerbMoodES.indicativeES` |
| 20 | `VerbCases.indicativePerfectSimplePast2sES` | `Lang.ES` | `false` | — | `Plurality.S` | `2` | `TenseVerbES.perfectSimplePast` | `VerbMoodES.indicativeES` |
| 21 | `VerbCases.indicativePerfectSimplePast3sES` | `Lang.ES` | `false` | — | `Plurality.S` | `3` | `TenseVerbES.perfectSimplePast` | `VerbMoodES.indicativeES` |
| 22 | `VerbCases.indicativePerfectSimplePast1plES` | `Lang.ES` | `false` | — | `Plurality.P` | `1` | `TenseVerbES.perfectSimplePast` | `VerbMoodES.indicativeES` |
| 23 | `VerbCases.indicativePerfectSimplePast2plES` | `Lang.ES` | `false` | — | `Plurality.P` | `2` | `TenseVerbES.perfectSimplePast` | `VerbMoodES.indicativeES` |
| 24 | `VerbCases.indicativePerfectSimplePast3plES` | `Lang.ES` | `false` | — | `Plurality.P` | `3` | `TenseVerbES.perfectSimplePast` | `VerbMoodES.indicativeES` |
| 25 | `VerbCases.indicativeFuture1sES` | `Lang.ES` | `false` | — | `Plurality.S` | `1` | `TenseVerbES.future` | `VerbMoodES.indicativeES` |
| 26 | `VerbCases.indicativeFuture2sES` | `Lang.ES` | `false` | — | `Plurality.S` | `2` | `TenseVerbES.future` | `VerbMoodES.indicativeES` |
| 27 | `VerbCases.indicativeFuture3sES` | `Lang.ES` | `false` | — | `Plurality.S` | `3` | `TenseVerbES.future` | `VerbMoodES.indicativeES` |
| 28 | `VerbCases.indicativeFuture1plES` | `Lang.ES` | `false` | — | `Plurality.P` | `1` | `TenseVerbES.future` | `VerbMoodES.indicativeES` |
| 29 | `VerbCases.indicativeFuture2plES` | `Lang.ES` | `false` | — | `Plurality.P` | `2` | `TenseVerbES.future` | `VerbMoodES.indicativeES` |
| 30 | `VerbCases.indicativeFuture3plES` | `Lang.ES` | `false` | — | `Plurality.P` | `3` | `TenseVerbES.future` | `VerbMoodES.indicativeES` |
| 31 | `VerbCases.indicativeConditional1sES` | `Lang.ES` | `false` | — | `Plurality.S` | `1` | `TenseVerbES.conditional` | `VerbMoodES.conditionalES` |
| 32 | `VerbCases.indicativeConditional2sES` | `Lang.ES` | `false` | — | `Plurality.S` | `2` | `TenseVerbES.conditional` | `VerbMoodES.conditionalES` |
| 33 | `VerbCases.indicativeConditional3sES` | `Lang.ES` | `false` | — | `Plurality.S` | `3` | `TenseVerbES.conditional` | `VerbMoodES.conditionalES` |
| 34 | `VerbCases.indicativeConditional1plES` | `Lang.ES` | `false` | — | `Plurality.P` | `1` | `TenseVerbES.conditional` | `VerbMoodES.conditionalES` |
| 35 | `VerbCases.indicativeConditional2plES` | `Lang.ES` | `false` | — | `Plurality.P` | `2` | `TenseVerbES.conditional` | `VerbMoodES.conditionalES` |
| 36 | `VerbCases.indicativeConditional3plES` | `Lang.ES` | `false` | — | `Plurality.P` | `3` | `TenseVerbES.conditional` | `VerbMoodES.conditionalES` |
| 37 | `VerbCases.imperative1sES` | `Lang.ES` | `false` | — | `Plurality.S` | `1` | `TenseVerbES.present` | `VerbMoodES.imperativeES` |
| 38 | `VerbCases.imperative2sES` | `Lang.ES` | `false` | — | `Plurality.S` | `2` | `TenseVerbES.present` | `VerbMoodES.imperativeES` |
| 39 | `VerbCases.imperative3sES` | `Lang.ES` | `false` | — | `Plurality.S` | `3` | `TenseVerbES.present` | `VerbMoodES.imperativeES` |
| 40 | `VerbCases.imperative1plES` | `Lang.ES` | `false` | — | `Plurality.P` | `1` | `TenseVerbES.present` | `VerbMoodES.imperativeES` |
| 41 | `VerbCases.imperative2plES` | `Lang.ES` | `false` | — | `Plurality.P` | `2` | `TenseVerbES.present` | `VerbMoodES.imperativeES` |
| 42 | `VerbCases.imperative3plES` | `Lang.ES` | `false` | — | `Plurality.P` | `3` | `TenseVerbES.present` | `VerbMoodES.imperativeES` |

### German (DE) — 28 entries

| # | caseName | language | isVerbProperty | verbPropertyCategory | plurality | person | tense | mood |
|---|----------|----------|----------------|----------------------|-----------|--------|-------|------|
| 1 | `VerbCases.infinitiveDE` | `Lang.DE` | `true` | `VerbPropertyCategories.infinitive` | — | — | — | — |
| 2 | `VerbCases.auxVerbDE` | `Lang.DE` | `true` | `VerbPropertyCategories.auxiliaryVerb` | — | — | — | — |
| 3 | `VerbCases.caseTypeDE` | `Lang.DE` | `true` | `VerbPropertyCategories.caseType` | — | — | — | — |
| 4 | `VerbCases.prefixDE` | `Lang.DE` | `true` | `VerbPropertyCategories.prefix` | — | — | — | — |
| 5 | `VerbCases.indicativePresent1sDE` | `Lang.DE` | `false` | — | `Plurality.S` | `1` | `TenseVerbDE.present` | `VerbMoodDE.indicativeDE` |
| 6 | `VerbCases.indicativePresent2sDE` | `Lang.DE` | `false` | — | `Plurality.S` | `2` | `TenseVerbDE.present` | `VerbMoodDE.indicativeDE` |
| 7 | `VerbCases.indicativePresent3sDE` | `Lang.DE` | `false` | — | `Plurality.S` | `3` | `TenseVerbDE.present` | `VerbMoodDE.indicativeDE` |
| 8 | `VerbCases.indicativePresent1plDE` | `Lang.DE` | `false` | — | `Plurality.P` | `1` | `TenseVerbDE.present` | `VerbMoodDE.indicativeDE` |
| 9 | `VerbCases.indicativePresent2plDE` | `Lang.DE` | `false` | — | `Plurality.P` | `2` | `TenseVerbDE.present` | `VerbMoodDE.indicativeDE` |
| 10 | `VerbCases.indicativePresent3plDE` | `Lang.DE` | `false` | — | `Plurality.P` | `3` | `TenseVerbDE.present` | `VerbMoodDE.indicativeDE` |
| 11 | `VerbCases.indicativePerfect1sDE` | `Lang.DE` | `false` | — | `Plurality.S` | `1` | `TenseVerbDE.perfect` | `VerbMoodDE.indicativeDE` |
| 12 | `VerbCases.indicativePerfect2sDE` | `Lang.DE` | `false` | — | `Plurality.S` | `2` | `TenseVerbDE.perfect` | `VerbMoodDE.indicativeDE` |
| 13 | `VerbCases.indicativePerfect3sDE` | `Lang.DE` | `false` | — | `Plurality.S` | `3` | `TenseVerbDE.perfect` | `VerbMoodDE.indicativeDE` |
| 14 | `VerbCases.indicativePerfect1plDE` | `Lang.DE` | `false` | — | `Plurality.P` | `1` | `TenseVerbDE.perfect` | `VerbMoodDE.indicativeDE` |
| 15 | `VerbCases.indicativePerfect2plDE` | `Lang.DE` | `false` | — | `Plurality.P` | `2` | `TenseVerbDE.perfect` | `VerbMoodDE.indicativeDE` |
| 16 | `VerbCases.indicativePerfect3plDE` | `Lang.DE` | `false` | — | `Plurality.P` | `3` | `TenseVerbDE.perfect` | `VerbMoodDE.indicativeDE` |
| 17 | `VerbCases.indicativeSimpleFuture1sDE` | `Lang.DE` | `false` | — | `Plurality.S` | `1` | `TenseVerbDE.simpleFuture` | `VerbMoodDE.indicativeDE` |
| 18 | `VerbCases.indicativeSimpleFuture2sDE` | `Lang.DE` | `false` | — | `Plurality.S` | `2` | `TenseVerbDE.simpleFuture` | `VerbMoodDE.indicativeDE` |
| 19 | `VerbCases.indicativeSimpleFuture3sDE` | `Lang.DE` | `false` | — | `Plurality.S` | `3` | `TenseVerbDE.simpleFuture` | `VerbMoodDE.indicativeDE` |
| 20 | `VerbCases.indicativeSimpleFuture1plDE` | `Lang.DE` | `false` | — | `Plurality.P` | `1` | `TenseVerbDE.simpleFuture` | `VerbMoodDE.indicativeDE` |
| 21 | `VerbCases.indicativeSimpleFuture2plDE` | `Lang.DE` | `false` | — | `Plurality.P` | `2` | `TenseVerbDE.simpleFuture` | `VerbMoodDE.indicativeDE` |
| 22 | `VerbCases.indicativeSimpleFuture3plDE` | `Lang.DE` | `false` | — | `Plurality.P` | `3` | `TenseVerbDE.simpleFuture` | `VerbMoodDE.indicativeDE` |
| 23 | `VerbCases.indicativeSimplePast1sDE` | `Lang.DE` | `false` | — | `Plurality.S` | `1` | `TenseVerbDE.simplePast` | `VerbMoodDE.indicativeDE` |
| 24 | `VerbCases.indicativeSimplePast2sDE` | `Lang.DE` | `false` | — | `Plurality.S` | `2` | `TenseVerbDE.simplePast` | `VerbMoodDE.indicativeDE` |
| 25 | `VerbCases.indicativeSimplePast3sDE` | `Lang.DE` | `false` | — | `Plurality.S` | `3` | `TenseVerbDE.simplePast` | `VerbMoodDE.indicativeDE` |
| 26 | `VerbCases.indicativeSimplePast1plDE` | `Lang.DE` | `false` | — | `Plurality.P` | `1` | `TenseVerbDE.simplePast` | `VerbMoodDE.indicativeDE` |
| 27 | `VerbCases.indicativeSimplePast2plDE` | `Lang.DE` | `false` | — | `Plurality.P` | `2` | `TenseVerbDE.simplePast` | `VerbMoodDE.indicativeDE` |
| 28 | `VerbCases.indicativeSimplePast3plDE` | `Lang.DE` | `false` | — | `Plurality.P` | `3` | `TenseVerbDE.simplePast` | `VerbMoodDE.indicativeDE` |

### Estonian (EE) — 20 entries

| # | caseName | language | isVerbProperty | verbPropertyCategory | plurality | person | tense | mood |
|---|----------|----------|----------------|----------------------|-----------|--------|-------|------|
| 1 | `VerbCases.infinitiveMaEE` | `Lang.EE` | `true` | `VerbPropertyCategories.infinitive` | — | — | — | — |
| 2 | `VerbCases.infinitiveDaEE` | `Lang.EE` | `true` | `VerbPropertyCategories.infinitive` | — | — | — | — |
| 3 | `VerbCases.kindelPresent1sEE` | `Lang.EE` | `false` | — | `Plurality.S` | `1` | `TenseVerbEE.present` | `VerbMoodEE.indicativeEE` |
| 4 | `VerbCases.kindelPresent2sEE` | `Lang.EE` | `false` | — | `Plurality.S` | `2` | `TenseVerbEE.present` | `VerbMoodEE.indicativeEE` |
| 5 | `VerbCases.kindelPresent3sEE` | `Lang.EE` | `false` | — | `Plurality.S` | `3` | `TenseVerbEE.present` | `VerbMoodEE.indicativeEE` |
| 6 | `VerbCases.kindelPresent1plEE` | `Lang.EE` | `false` | — | `Plurality.P` | `1` | `TenseVerbEE.present` | `VerbMoodEE.indicativeEE` |
| 7 | `VerbCases.kindelPresent2plEE` | `Lang.EE` | `false` | — | `Plurality.P` | `2` | `TenseVerbEE.present` | `VerbMoodEE.indicativeEE` |
| 8 | `VerbCases.kindelPresent3plEE` | `Lang.EE` | `false` | — | `Plurality.P` | `3` | `TenseVerbEE.present` | `VerbMoodEE.indicativeEE` |
| 9 | `VerbCases.kindelSimplePast1sEE` | `Lang.EE` | `false` | — | `Plurality.S` | `1` | `TenseVerbEE.simplePast` | `VerbMoodEE.indicativeEE` |
| 10 | `VerbCases.kindelSimplePast2sEE` | `Lang.EE` | `false` | — | `Plurality.S` | `2` | `TenseVerbEE.simplePast` | `VerbMoodEE.indicativeEE` |
| 11 | `VerbCases.kindelSimplePast3sEE` | `Lang.EE` | `false` | — | `Plurality.S` | `3` | `TenseVerbEE.simplePast` | `VerbMoodEE.indicativeEE` |
| 12 | `VerbCases.kindelSimplePast1plEE` | `Lang.EE` | `false` | — | `Plurality.P` | `1` | `TenseVerbEE.simplePast` | `VerbMoodEE.indicativeEE` |
| 13 | `VerbCases.kindelSimplePast2plEE` | `Lang.EE` | `false` | — | `Plurality.P` | `2` | `TenseVerbEE.simplePast` | `VerbMoodEE.indicativeEE` |
| 14 | `VerbCases.kindelSimplePast3plEE` | `Lang.EE` | `false` | — | `Plurality.P` | `3` | `TenseVerbEE.simplePast` | `VerbMoodEE.indicativeEE` |
| 15 | `VerbCases.kindelPastPerfect1sEE` | `Lang.EE` | `false` | — | `Plurality.S` | `1` | `TenseVerbEE.pastPerfect` | `VerbMoodEE.indicativeEE` |
| 16 | `VerbCases.kindelPastPerfect2sEE` | `Lang.EE` | `false` | — | `Plurality.S` | `2` | `TenseVerbEE.pastPerfect` | `VerbMoodEE.indicativeEE` |
| 17 | `VerbCases.kindelPastPerfect3sEE` | `Lang.EE` | `false` | — | `Plurality.S` | `3` | `TenseVerbEE.pastPerfect` | `VerbMoodEE.indicativeEE` |
| 18 | `VerbCases.kindelPastPerfect1plEE` | `Lang.EE` | `false` | — | `Plurality.P` | `1` | `TenseVerbEE.pastPerfect` | `VerbMoodEE.indicativeEE` |
| 19 | `VerbCases.kindelPastPerfect2plEE` | `Lang.EE` | `false` | — | `Plurality.P` | `2` | `TenseVerbEE.pastPerfect` | `VerbMoodEE.indicativeEE` |
| 20 | `VerbCases.kindelPastPerfect3plEE` | `Lang.EE` | `false` | — | `Plurality.P` | `3` | `TenseVerbEE.pastPerfect` | `VerbMoodEE.indicativeEE` |
