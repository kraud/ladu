import {
    DeclensionNoun,
    Lang,
    NounCases,
    Plurality, TenseVerbDE, TenseVerbEE,
    TenseVerbEN, TenseVerbES,
    VerbCases,
    VerbMoodDE,
    VerbMoodEE,
    VerbMoodEN,
    VerbMoodES,
} from "./enums";

// =========== NOUN ===========
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

// =========== VERB ===========
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

// =========== DATA OBJECT STRUCTURE ===========
export interface WordCasesDataByPoS {
    Noun: NounCasesData[],
    Verb: VerbCasesData[],
}

export const WordCasesData: WordCasesDataByPoS = {
    Noun: [
        {
            caseName: NounCases.singularEN,
            language: Lang.EN,
            isNounProperty: false,
            plurality: Plurality.S,
            declination: DeclensionNoun.nominative,
        },
        {
            caseName: NounCases.pluralEN,
            language: Lang.EN,
            isNounProperty: false,
            plurality: Plurality.P,
            declination: DeclensionNoun.nominative,
        },
        {
            caseName: NounCases.genderES,
            language: Lang.ES,
            isNounProperty: true,
            nounPropertyCategory: NounPropertyCategories.gender,
        },
        {
            caseName: NounCases.singularES,
            language: Lang.ES,
            isNounProperty: false,
            plurality: Plurality.S,
            declination: DeclensionNoun.nominative,
        },
        {
            caseName: NounCases.pluralES,
            language: Lang.ES,
            isNounProperty: false,
            plurality: Plurality.P,
            declination: DeclensionNoun.nominative,
        },
        {
            caseName: NounCases.genderDE,
            language: Lang.DE,
            isNounProperty: true,
            nounPropertyCategory: NounPropertyCategories.gender,
        },
        {
            caseName: NounCases.singularNominativDE,
            language: Lang.DE,
            isNounProperty: false,
            plurality: Plurality.S,
            declination: DeclensionNoun.nominative,
        },
        {
            caseName: NounCases.pluralNominativDE,
            language: Lang.DE,
            isNounProperty: false,
            plurality: Plurality.P,
            declination: DeclensionNoun.nominative,
        },
        {
            caseName: NounCases.singularAkkusativDE,
            language: Lang.DE,
            isNounProperty: false,
            plurality: Plurality.S,
            declination: DeclensionNoun.accusative,
        },
        {
            caseName: NounCases.pluralAkkusativDE,
            language: Lang.DE,
            isNounProperty: false,
            plurality: Plurality.P,
            declination: DeclensionNoun.accusative,
        },
        {
            caseName: NounCases.singularGenitivDE,
            language: Lang.DE,
            isNounProperty: false,
            plurality: Plurality.S,
            declination: DeclensionNoun.genitive,
        },
        {
            caseName: NounCases.pluralGenitivDE,
            language: Lang.DE,
            isNounProperty: false,
            plurality: Plurality.P,
            declination: DeclensionNoun.genitive,
        },
        {
            caseName: NounCases.singularDativDE,
            language: Lang.DE,
            isNounProperty: false,
            plurality: Plurality.S,
            declination: DeclensionNoun.dative,
        },
        {
            caseName: NounCases.pluralDativDE,
            language: Lang.DE,
            isNounProperty: false,
            plurality: Plurality.P,
            declination: DeclensionNoun.dative,
        },
        {
            caseName: NounCases.singularNimetavEE,
            language: Lang.EE,
            isNounProperty: false,
            plurality: Plurality.S,
            declination: DeclensionNoun.nominative,
        },
        {
            caseName: NounCases.pluralNimetavEE,
            language: Lang.EE,
            isNounProperty: false,
            plurality: Plurality.P,
            declination: DeclensionNoun.nominative,
        },
        {
            caseName: NounCases.singularOmastavEE,
            language: Lang.EE,
            isNounProperty: false,
            plurality: Plurality.S,
            declination: DeclensionNoun.genitive,
        },
        {
            caseName: NounCases.pluralOmastavEE,
            language: Lang.EE,
            isNounProperty: false,
            plurality: Plurality.P,
            declination: DeclensionNoun.genitive,
        },
        {
            caseName: NounCases.singularOsastavEE,
            language: Lang.EE,
            isNounProperty: false,
            plurality: Plurality.S,
            declination: DeclensionNoun.partitive,
        },
        {
            caseName: NounCases.pluralOsastavEE,
            language: Lang.EE,
            isNounProperty: false,
            plurality: Plurality.P,
            declination: DeclensionNoun.partitive,
        },
        {
            caseName: NounCases.shortFormEE,
            language: Lang.EE,
            isNounProperty: true,
            nounPropertyCategory: NounPropertyCategories.shortForm,
        }
    ],
    Verb: [
        // English (EN)
        {
            caseName: VerbCases.regularityEN,
            language: Lang.EN,
            isVerbProperty: true,
            verbPropertyCategory: VerbPropertyCategories.regularity
        },
        {
            caseName: VerbCases.simplePresent1sEN,
            language: Lang.EN,
            plurality: Plurality.S,
            person: 1,
            tense: TenseVerbEN.presentSimple,
            mood: VerbMoodEN.indicativeEN,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.simplePresent2sEN,
            language: Lang.EN,
            plurality: Plurality.S,
            person: 2,
            tense: TenseVerbEN.presentSimple,
            mood: VerbMoodEN.indicativeEN,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.simplePresent3sEN,
            language: Lang.EN,
            plurality: Plurality.S,
            person: 3,
            tense: TenseVerbEN.presentSimple,
            mood: VerbMoodEN.indicativeEN,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.simplePresent1plEN,
            language: Lang.EN,
            plurality: Plurality.P,
            person: 1,
            tense: TenseVerbEN.presentSimple,
            mood: VerbMoodEN.indicativeEN,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.simplePresent3plEN,
            language: Lang.EN,
            plurality: Plurality.P,
            person: 3,
            tense: TenseVerbEN.presentSimple,
            mood: VerbMoodEN.indicativeEN,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.simplePast1sEN,
            language: Lang.EN,
            plurality: Plurality.S,
            person: 1,
            tense: TenseVerbEN.pastSimple,
            mood: VerbMoodEN.indicativeEN,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.simplePast2sEN,
            language: Lang.EN,
            plurality: Plurality.S,
            person: 2,
            tense: TenseVerbEN.pastSimple,
            mood: VerbMoodEN.indicativeEN,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.simplePast3sEN,
            language: Lang.EN,
            plurality: Plurality.S,
            person: 3,
            tense: TenseVerbEN.pastSimple,
            mood: VerbMoodEN.indicativeEN,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.simplePast1plEN,
            language: Lang.EN,
            plurality: Plurality.P,
            person: 1,
            tense: TenseVerbEN.pastSimple,
            mood: VerbMoodEN.indicativeEN,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.simplePast3plEN,
            language: Lang.EN,
            plurality: Plurality.P,
            person: 3,
            tense: TenseVerbEN.pastSimple,
            mood: VerbMoodEN.indicativeEN,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.simpleFuture1sEN,
            language: Lang.EN,
            plurality: Plurality.S,
            person: 1,
            tense: TenseVerbEN.futureSimple,
            mood: VerbMoodEN.indicativeEN,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.simpleFuture2sEN,
            language: Lang.EN,
            plurality: Plurality.S,
            person: 2,
            tense: TenseVerbEN.futureSimple,
            mood: VerbMoodEN.indicativeEN,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.simpleFuture3sEN,
            language: Lang.EN,
            plurality: Plurality.S,
            person: 3,
            tense: TenseVerbEN.futureSimple,
            mood: VerbMoodEN.indicativeEN,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.simpleFuture1plEN,
            language: Lang.EN,
            plurality: Plurality.P,
            person: 1,
            tense: TenseVerbEN.futureSimple,
            mood: VerbMoodEN.indicativeEN,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.simpleFuture3plEN,
            language: Lang.EN,
            plurality: Plurality.P,
            person: 3,
            tense: TenseVerbEN.futureSimple,
            mood: VerbMoodEN.indicativeEN,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.simpleConditional1sEN,
            language: Lang.EN,
            plurality: Plurality.S,
            person: 1,
            tense: TenseVerbEN.conditionalSimple,
            mood: VerbMoodEN.conditionalEN,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.simpleConditional2sEN,
            language: Lang.EN,
            plurality: Plurality.S,
            person: 2,
            tense: TenseVerbEN.conditionalSimple,
            mood: VerbMoodEN.conditionalEN,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.simpleConditional3sEN,
            language: Lang.EN,
            plurality: Plurality.S,
            person: 3,
            tense: TenseVerbEN.conditionalSimple,
            mood: VerbMoodEN.conditionalEN,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.simpleConditional1plEN,
            language: Lang.EN,
            plurality: Plurality.P,
            person: 1,
            tense: TenseVerbEN.conditionalSimple,
            mood: VerbMoodEN.conditionalEN,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.simpleConditional3plEN,
            language: Lang.EN,
            plurality: Plurality.P,
            person: 3,
            tense: TenseVerbEN.conditionalSimple,
            mood: VerbMoodEN.conditionalEN,
            isVerbProperty: false
        },
        // Spanish (ES)
        {
            caseName: VerbCases.regularityES,
            language: Lang.ES,
            isVerbProperty: true,
            verbPropertyCategory: VerbPropertyCategories.regularity,
        },
        {
            caseName: VerbCases.infinitiveNonFiniteSimpleES,
            language: Lang.ES,
            isVerbProperty: true,
            verbPropertyCategory: VerbPropertyCategories.infinitive,
        },
        {
            caseName: VerbCases.gerundNonFiniteSimpleES,
            language: Lang.ES,
            isVerbProperty: true,
            verbPropertyCategory: VerbPropertyCategories.gerund,
        },
        {
            caseName: VerbCases.participleNonFiniteSimpleES,
            language: Lang.ES,
            isVerbProperty: true,
            verbPropertyCategory: VerbPropertyCategories.participle,
        },
        {
            caseName: VerbCases.infinitiveNonFiniteCompound,
            language: Lang.ES,
            isVerbProperty: true,
            verbPropertyCategory: VerbPropertyCategories.infinitive,
        },
        {
            caseName: VerbCases.gerundNonFiniteCompound,
            language: Lang.ES,
            isVerbProperty: true,
            verbPropertyCategory: VerbPropertyCategories.gerund,
        },
        {
            caseName: VerbCases.indicativePresent1sES,
            language: Lang.ES,
            plurality: Plurality.S,
            person: 1,
            tense: TenseVerbES.present,
            mood: VerbMoodES.indicativeES,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativePresent2sES,
            language: Lang.ES,
            plurality: Plurality.S,
            person: 2,
            tense: TenseVerbES.present,
            mood: VerbMoodES.indicativeES,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativePresent3sES,
            language: Lang.ES,
            plurality: Plurality.S,
            person: 3,
            tense: TenseVerbES.present,
            mood: VerbMoodES.indicativeES,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativePresent1plES,
            language: Lang.ES,
            plurality: Plurality.P,
            person: 1,
            tense: TenseVerbES.present,
            mood: VerbMoodES.indicativeES,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativePresent2plES,
            language: Lang.ES,
            plurality: Plurality.P,
            person: 2,
            tense: TenseVerbES.present,
            mood: VerbMoodES.indicativeES,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativePresent3plES,
            language: Lang.ES,
            plurality: Plurality.P,
            person: 3,
            tense: TenseVerbES.present,
            mood: VerbMoodES.indicativeES,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativeImperfectPast1sES,
            language: Lang.ES,
            plurality: Plurality.S,
            person: 1,
            tense: TenseVerbES.imperfectPast,
            mood: VerbMoodES.indicativeES,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativeImperfectPast2sES,
            language: Lang.ES,
            plurality: Plurality.S,
            person: 2,
            tense: TenseVerbES.imperfectPast,
            mood: VerbMoodES.indicativeES,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativeImperfectPast3sES,
            language: Lang.ES,
            plurality: Plurality.S,
            person: 3,
            tense: TenseVerbES.imperfectPast,
            mood: VerbMoodES.indicativeES,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativeImperfectPast1plES,
            language: Lang.ES,
            plurality: Plurality.P,
            person: 1,
            tense: TenseVerbES.imperfectPast,
            mood: VerbMoodES.indicativeES,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativeImperfectPast2plES,
            language: Lang.ES,
            plurality: Plurality.P,
            person: 2,
            tense: TenseVerbES.imperfectPast,
            mood: VerbMoodES.indicativeES,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativeImperfectPast3plES,
            language: Lang.ES,
            plurality: Plurality.P,
            person: 3,
            tense: TenseVerbES.imperfectPast,
            mood: VerbMoodES.indicativeES,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativePerfectSimplePast1sES,
            language: Lang.ES,
            plurality: Plurality.S,
            person: 1,
            tense: TenseVerbES.perfectSimplePast,
            mood: VerbMoodES.indicativeES,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativePerfectSimplePast2sES,
            language: Lang.ES,
            plurality: Plurality.S,
            person: 2,
            tense: TenseVerbES.perfectSimplePast,
            mood: VerbMoodES.indicativeES,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativePerfectSimplePast3sES,
            language: Lang.ES,
            plurality: Plurality.S,
            person: 3,
            tense: TenseVerbES.perfectSimplePast,
            mood: VerbMoodES.indicativeES,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativePerfectSimplePast1plES,
            language: Lang.ES,
            plurality: Plurality.P,
            person: 1,
            tense: TenseVerbES.perfectSimplePast,
            mood: VerbMoodES.indicativeES,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativePerfectSimplePast2plES,
            language: Lang.ES,
            plurality: Plurality.P,
            person: 2,
            tense: TenseVerbES.perfectSimplePast,
            mood: VerbMoodES.indicativeES,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativePerfectSimplePast3plES,
            language: Lang.ES,
            plurality: Plurality.P,
            person: 3,
            tense: TenseVerbES.perfectSimplePast,
            mood: VerbMoodES.indicativeES,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativeFuture1sES,
            language: Lang.ES,
            plurality: Plurality.S,
            person: 1,
            tense: TenseVerbES.future,
            mood: VerbMoodES.indicativeES,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativeFuture2sES,
            language: Lang.ES,
            plurality: Plurality.S,
            person: 2,
            tense: TenseVerbES.future,
            mood: VerbMoodES.indicativeES,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativeFuture3sES,
            language: Lang.ES,
            plurality: Plurality.S,
            person: 3,
            tense: TenseVerbES.future,
            mood: VerbMoodES.indicativeES,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativeFuture1plES,
            language: Lang.ES,
            plurality: Plurality.P,
            person: 1,
            tense: TenseVerbES.future,
            mood: VerbMoodES.indicativeES,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativeFuture2plES,
            language: Lang.ES,
            plurality: Plurality.P,
            person: 2,
            tense: TenseVerbES.future,
            mood: VerbMoodES.indicativeES,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativeFuture3plES,
            language: Lang.ES,
            plurality: Plurality.P,
            person: 3,
            tense: TenseVerbES.future,
            mood: VerbMoodES.indicativeES,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativeConditional1sES,
            language: Lang.ES,
            plurality: Plurality.S,
            person: 1,
            tense: TenseVerbES.conditional,
            mood: VerbMoodES.conditionalES,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativeConditional2sES,
            language: Lang.ES,
            plurality: Plurality.S,
            person: 2,
            tense: TenseVerbES.conditional,
            mood: VerbMoodES.conditionalES,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativeConditional3sES,
            language: Lang.ES,
            plurality: Plurality.S,
            person: 3,
            tense: TenseVerbES.conditional,
            mood: VerbMoodES.conditionalES,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativeConditional1plES,
            language: Lang.ES,
            plurality: Plurality.P,
            person: 1,
            tense: TenseVerbES.conditional,
            mood: VerbMoodES.conditionalES,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativeConditional2plES,
            language: Lang.ES,
            plurality: Plurality.P,
            person: 2,
            tense: TenseVerbES.conditional,
            mood: VerbMoodES.conditionalES,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativeConditional3plES,
            language: Lang.ES,
            plurality: Plurality.P,
            person: 3,
            tense: TenseVerbES.conditional,
            mood: VerbMoodES.conditionalES,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.imperative1sES,
            language: Lang.ES,
            plurality: Plurality.S,
            person: 1,
            tense: TenseVerbES.present,
            mood: VerbMoodES.imperativeES,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.imperative2sES,
            language: Lang.ES,
            plurality: Plurality.S,
            person: 2,
            tense: TenseVerbES.present,
            mood: VerbMoodES.imperativeES,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.imperative3sES,
            language: Lang.ES,
            plurality: Plurality.S,
            person: 3,
            tense: TenseVerbES.present,
            mood: VerbMoodES.imperativeES,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.imperative1plES,
            language: Lang.ES,
            plurality: Plurality.P,
            person: 1,
            tense: TenseVerbES.present,
            mood: VerbMoodES.imperativeES,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.imperative2plES,
            language: Lang.ES,
            plurality: Plurality.P,
            person: 2,
            tense: TenseVerbES.present,
            mood: VerbMoodES.imperativeES,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.imperative3plES,
            language: Lang.ES,
            plurality: Plurality.P,
            person: 3,
            tense: TenseVerbES.present,
            mood: VerbMoodES.imperativeES,
            isVerbProperty: false
        },
        // German (DE)

        {
            caseName: VerbCases.infinitiveDE,
            language: Lang.DE,
            isVerbProperty: true,
            verbPropertyCategory: VerbPropertyCategories.infinitive
        },
        {
            caseName: VerbCases.auxVerbDE,
            language: Lang.DE,
            isVerbProperty: true,
            verbPropertyCategory: VerbPropertyCategories.auxiliaryVerb
        },
        {
            caseName: VerbCases.caseTypeDE,
            language: Lang.DE,
            isVerbProperty: true,
            verbPropertyCategory: VerbPropertyCategories.caseType
        },
        {
            caseName: VerbCases.prefixDE,
            language: Lang.DE,
            isVerbProperty: true,
            verbPropertyCategory: VerbPropertyCategories.prefix
        },
        {
            caseName: VerbCases.indicativePresent1sDE,
            language: Lang.DE,
            plurality: Plurality.S,
            person: 1,
            tense: TenseVerbDE.present,
            mood: VerbMoodDE.indicativeDE,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativePresent2sDE,
            language: Lang.DE,
            plurality: Plurality.S,
            person: 2,
            tense: TenseVerbDE.present,
            mood: VerbMoodDE.indicativeDE,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativePresent3sDE,
            language: Lang.DE,
            plurality: Plurality.S,
            person: 3,
            tense: TenseVerbDE.present,
            mood: VerbMoodDE.indicativeDE,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativePresent1plDE,
            language: Lang.DE,
            plurality: Plurality.P,
            person: 1,
            tense: TenseVerbDE.present,
            mood: VerbMoodDE.indicativeDE,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativePresent2plDE,
            language: Lang.DE,
            plurality: Plurality.P,
            person: 2,
            tense: TenseVerbDE.present,
            mood: VerbMoodDE.indicativeDE,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativePresent3plDE,
            language: Lang.DE,
            plurality: Plurality.P,
            person: 3,
            tense: TenseVerbDE.present,
            mood: VerbMoodDE.indicativeDE,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativePerfect1sDE,
            language: Lang.DE,
            plurality: Plurality.S,
            person: 1,
            tense: TenseVerbDE.perfect,
            mood: VerbMoodDE.indicativeDE,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativePerfect2sDE,
            language: Lang.DE,
            plurality: Plurality.S,
            person: 2,
            tense: TenseVerbDE.perfect,
            mood: VerbMoodDE.indicativeDE,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativePerfect3sDE,
            language: Lang.DE,
            plurality: Plurality.S,
            person: 3,
            tense: TenseVerbDE.perfect,
            mood: VerbMoodDE.indicativeDE,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativePerfect1plDE,
            language: Lang.DE,
            plurality: Plurality.P,
            person: 1,
            tense: TenseVerbDE.perfect,
            mood: VerbMoodDE.indicativeDE,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativePerfect2plDE,
            language: Lang.DE,
            plurality: Plurality.P,
            person: 2,
            tense: TenseVerbDE.perfect,
            mood: VerbMoodDE.indicativeDE,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativePerfect3plDE,
            language: Lang.DE,
            plurality: Plurality.P,
            person: 3,
            tense: TenseVerbDE.perfect,
            mood: VerbMoodDE.indicativeDE,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativeSimpleFuture1sDE,
            language: Lang.DE,
            plurality: Plurality.S,
            person: 1,
            tense: TenseVerbDE.simpleFuture,
            mood: VerbMoodDE.indicativeDE,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativeSimpleFuture2sDE,
            language: Lang.DE,
            plurality: Plurality.S,
            person: 2,
            tense: TenseVerbDE.simpleFuture,
            mood: VerbMoodDE.indicativeDE,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativeSimpleFuture3sDE,
            language: Lang.DE,
            plurality: Plurality.S,
            person: 3,
            tense: TenseVerbDE.simpleFuture,
            mood: VerbMoodDE.indicativeDE,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativeSimpleFuture1plDE,
            language: Lang.DE,
            plurality: Plurality.P,
            person: 1,
            tense: TenseVerbDE.simpleFuture,
            mood: VerbMoodDE.indicativeDE,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativeSimpleFuture2plDE,
            language: Lang.DE,
            plurality: Plurality.P,
            person: 2,
            tense: TenseVerbDE.simpleFuture,
            mood: VerbMoodDE.indicativeDE,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativeSimpleFuture3plDE,
            language: Lang.DE,
            plurality: Plurality.P,
            person: 3,
            tense: TenseVerbDE.simpleFuture,
            mood: VerbMoodDE.indicativeDE,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativeSimplePast1sDE,
            language: Lang.DE,
            plurality: Plurality.S,
            person: 1,
            tense: TenseVerbDE.simplePast,
            mood: VerbMoodDE.indicativeDE,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativeSimplePast2sDE,
            language: Lang.DE,
            plurality: Plurality.S,
            person: 2,
            tense: TenseVerbDE.simplePast,
            mood: VerbMoodDE.indicativeDE,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativeSimplePast3sDE,
            language: Lang.DE,
            plurality: Plurality.S,
            person: 3,
            tense: TenseVerbDE.simplePast,
            mood: VerbMoodDE.indicativeDE,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativeSimplePast1plDE,
            language: Lang.DE,
            plurality: Plurality.P,
            person: 1,
            tense: TenseVerbDE.simplePast,
            mood: VerbMoodDE.indicativeDE,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativeSimplePast2plDE,
            language: Lang.DE,
            plurality: Plurality.P,
            person: 2,
            tense: TenseVerbDE.simplePast,
            mood: VerbMoodDE.indicativeDE,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.indicativeSimplePast3plDE,
            language: Lang.DE,
            plurality: Plurality.P,
            person: 3,
            tense: TenseVerbDE.simplePast,
            mood: VerbMoodDE.indicativeDE,
            isVerbProperty: false
        },

        // Estonian (EE)
        {
            caseName: VerbCases.infinitiveMaEE,
            language: Lang.EE,
            isVerbProperty: true,
            verbPropertyCategory: VerbPropertyCategories.infinitive
        },
        {
            caseName: VerbCases.infinitiveDaEE,
            language: Lang.EE,
            isVerbProperty: true,
            verbPropertyCategory: VerbPropertyCategories.infinitive
        },
        {
            caseName: VerbCases.kindelPresent1sEE,
            language: Lang.EE,
            plurality: Plurality.S,
            person: 1,
            tense: TenseVerbEE.present,
            mood: VerbMoodEE.indicativeEE,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.kindelPresent2sEE,
            language: Lang.EE,
            plurality: Plurality.S,
            person: 2,
            tense: TenseVerbEE.present,
            mood: VerbMoodEE.indicativeEE,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.kindelPresent3sEE,
            language: Lang.EE,
            plurality: Plurality.S,
            person: 3,
            tense: TenseVerbEE.present,
            mood: VerbMoodEE.indicativeEE,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.kindelPresent1plEE,
            language: Lang.EE,
            plurality: Plurality.P,
            person: 1,
            tense: TenseVerbEE.present,
            mood: VerbMoodEE.indicativeEE,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.kindelPresent2plEE,
            language: Lang.EE,
            plurality: Plurality.P,
            person: 2,
            tense: TenseVerbEE.present,
            mood: VerbMoodEE.indicativeEE,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.kindelPresent3plEE,
            language: Lang.EE,
            plurality: Plurality.P,
            person: 3,
            tense: TenseVerbEE.present,
            mood: VerbMoodEE.indicativeEE,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.kindelSimplePast1sEE,
            language: Lang.EE,
            plurality: Plurality.S,
            person: 1,
            tense: TenseVerbEE.simplePast,
            mood: VerbMoodEE.indicativeEE,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.kindelSimplePast2sEE,
            language: Lang.EE,
            plurality: Plurality.S,
            person: 2,
            tense: TenseVerbEE.simplePast,
            mood: VerbMoodEE.indicativeEE,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.kindelSimplePast3sEE,
            language: Lang.EE,
            plurality: Plurality.S,
            person: 3,
            tense: TenseVerbEE.simplePast,
            mood: VerbMoodEE.indicativeEE,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.kindelSimplePast1plEE,
            language: Lang.EE,
            plurality: Plurality.P,
            person: 1,
            tense: TenseVerbEE.simplePast,
            mood: VerbMoodEE.indicativeEE,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.kindelSimplePast2plEE,
            language: Lang.EE,
            plurality: Plurality.P,
            person: 2,
            tense: TenseVerbEE.simplePast,
            mood: VerbMoodEE.indicativeEE,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.kindelSimplePast3plEE,
            language: Lang.EE,
            plurality: Plurality.P,
            person: 3,
            tense: TenseVerbEE.simplePast,
            mood: VerbMoodEE.indicativeEE,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.kindelPastPerfect1sEE,
            language: Lang.EE,
            plurality: Plurality.S,
            person: 1,
            tense: TenseVerbEE.pastPerfect,
            mood: VerbMoodEE.indicativeEE,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.kindelPastPerfect2sEE,
            language: Lang.EE,
            plurality: Plurality.S,
            person: 2,
            tense: TenseVerbEE.pastPerfect,
            mood: VerbMoodEE.indicativeEE,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.kindelPastPerfect3sEE,
            language: Lang.EE,
            plurality: Plurality.S,
            person: 3,
            tense: TenseVerbEE.pastPerfect,
            mood: VerbMoodEE.indicativeEE,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.kindelPastPerfect1plEE,
            language: Lang.EE,
            plurality: Plurality.P,
            person: 1,
            tense: TenseVerbEE.pastPerfect,
            mood: VerbMoodEE.indicativeEE,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.kindelPastPerfect2plEE,
            language: Lang.EE,
            plurality: Plurality.P,
            person: 2,
            tense: TenseVerbEE.pastPerfect,
            mood: VerbMoodEE.indicativeEE,
            isVerbProperty: false
        },
        {
            caseName: VerbCases.kindelPastPerfect3plEE,
            language: Lang.EE,
            plurality: Plurality.P,
            person: 3,
            tense: TenseVerbEE.pastPerfect,
            mood: VerbMoodEE.indicativeEE,
            isVerbProperty: false
        }
    ],
}