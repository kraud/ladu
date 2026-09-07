
export enum NounCases {
    // ENGLISH
    regularityEN = "regularityEN",
    singularEN = "singularEN" ,
    pluralEN = "pluralEN",

    // SPANISH
    regularityES = "regularityES",
    genderES = "genderES",
    singularES = "singularES",
    pluralES = "pluralES",

    // GERMAN
    regularityDE = "regularityDE",
    genderDE = "genderDE",
    singularNominativDE = "singularNominativDE",
    pluralNominativDE = "pluralNominativDE",

    singularAkkusativDE = "singularAkkusativDE",
    pluralAkkusativDE = "pluralAkkusativDE",

    singularGenitivDE = "singularGenitivDE",
    pluralGenitivDE = "pluralGenitivDE",

    singularDativDE = "singularDativDE",
    pluralDativDE = "pluralDativDE",

    // ESTONIAN

    regularityEE = "regularityEE",
    singularNimetavEE = "singularNimetavEE",
    pluralNimetavEE = "pluralNimetavEE",

    singularOmastavEE = "singularOmastavEE",
    pluralOmastavEE = "pluralOmastavEE",

    singularOsastavEE = "singularOsastavEE",
    pluralOsastavEE = "pluralOsastavEE",

    shortFormEE = "shortFormEE",
}

export enum AdverbCases {
    // ENGLISH
    adverbEN = "adverbEN",
    comparativeEN = "comparativeEN",
    superlativeEN = "superlativeEN",

    // SPANISH
    adverbES = "adverbES",
    comparativeES = "comparativeES",
    superlativeES = "superlativeES",

    // GERMAN
    gradableDE = "gradableDE",
    adverbDE = "adverbDE",
    comparativeDE = "comparativeDE",
    superlativeDE = "superlativeDE",
}

export enum AdjectiveCases {
    // ENGLISH
    positiveEN = "positiveEN",
    comparativeEN = "comparativeEN",
    superlativeEN = "superlativeEN",

    // SPANISH
    maleSingularES = "maleSingularES",
    malePluralES = "malePluralES",
    femaleSingularES = "femaleSingularES",
    femalePluralES = "femalePluralES",

    neutralSingularES = "neutralSingularES",
    neutralPluralES = "neutralPluralES",

    // GERMAN
    positiveDE = "positiveDE",
    komparativDE = "komparativDE",
    superlativDE = "superlativDE",

    // ESTONIAN
    algvorreEE = "algvorreEE",
    keskvorreEE = "keskvorreEE",
    ulivorreEE = "ulivorreEE",

    // NB! singularNivetav is the same as algvorre
    pluralNimetavEE = "pluralNimetavEE",

    singularOmastavEE = "singularOmastavEE",
    pluralOmastavEE = "pluralOmastavEE",

    singularOsastavEE = "singularOsastavEE",
    pluralOsastavEE = "pluralOsastavEE",
}

export enum VerbCases {

    // ============== ENGLISH: ==============
        // Pronouns:
        // I: 1st person singular (1s)
        // you: 2nd person singular/plural (2s/2pl)
        // he/she/it: 3rd person singular (male-female-neutral) (3s)
        // we: 1nd person plural (1pl)
        // they: 3rd person plural (3pl)
    // Naming convention: category - tense - pronoun - language

    regularityEN = "regularityEN",
    // SIMPLE: --------------
    // Same for every pronoun except 3s m/f/n
    simplePresent1sEN = "simplePresent1sEN", // DEFAULT CASE
    simplePresent2sEN = "simplePresent2sEN",
    simplePresent3sEN = "simplePresent3sEN", // ONLY VARIANT
    simplePresent1plEN = "simplePresent1plEN",
    simplePresent3plEN = "simplePresent3plEN",

    // * regular verbs: 'root'+ed && irregular verbs: !== 'root'
    //  * in both cases all past-fields ALWAYS equal (TODO: double check)
    simplePast1sEN = "simplePast1sEN",
    simplePast2sEN = "simplePast2sEN",
    simplePast3sEN = "simplePast3sEN",
    simplePast1plEN = "simplePast1plEN",
    simplePast3plEN = "simplePast3plEN",

    simpleFuture1sEN = "simpleFuture1sEN",
    simpleFuture2sEN = "simpleFuture2sEN",
    simpleFuture3sEN = "simpleFuture3sEN",
    simpleFuture1plEN = "simpleFuture1plEN",
    simpleFuture3plEN = "simpleFuture3plEN",

    simpleConditional1sEN = "simpleConditional1sEN",
    simpleConditional2sEN = "simpleConditional2sEN",
    simpleConditional3sEN = "simpleConditional3sEN",
    simpleConditional1plEN = "simpleConditional1plEN",
    simpleConditional3plEN = "simpleConditional3plEN",

    // PROGRESSIVE: --------------
    // Same for every pronoun. Ends in -ing (same as perfect progressive)
    // 'prefix': (Present: to-be present), (Past: to-be past), (Future: 'will be'), (Conditional: 'would be')
    progressivePPFCAllEN = "progressivePPFCAllEN",

    // PERFECT: --------------
    // Same for every pronoun.
    // 'prefix': (Present: have present), (Past: had past), (Future: 'will have'), (Conditional: 'would have')
    perfectPPFCAllEN = "perfectPPFCAllEN",

    // PERFECT PROGRESSIVE: --------------
    // Same for every pronoun.  Ends in -ing (same as progressive)
    // 'prefix': (Present: have been), (Past: had been), (Future: 'will have been'), (Conditional: 'would have been')
    perfectProgressivePPFCAllEN = "perfectProgressivePPFCAllEN",


    // ============== SPANISH: ==============
        // Pronouns:
        // yo: 1st person singular (1s)
        // tú/vos: 2nd person singular (2s)
        // él/ella: 3rd person singular (male-female-neutral) (3s)
        // nosotros/as: 1nd person plural (1pl)
        // vosotros/as || ustedes: 2nd person plural (2pl)
        // ellos/as: 3rd person plural (3pl)
    regularityES = "regularityES",

    infinitiveNonFiniteSimpleES = 'infinitiveNonFiniteSimpleES',
    gerundNonFiniteSimpleES = 'gerundNonFiniteSimpleES',
    participleNonFiniteSimpleES = 'participleNonFiniteSimpleES',

    // both compound forms are the same
    infinitiveNonFiniteCompound = 'infinitiveNonFiniteCompound', // "haber"...+
    gerundNonFiniteCompound = 'gerundNonFiniteCompound', // "habiendo"...+

    // Naming convention: mode - type(simple/compound) - time - pronoun - language
    // INDICATIVE: --------------
    indicativePresent1sES = "indicativePresent1sES",
    indicativePresent2sES = "indicativePresent2sES",
    indicativePresent3sES = "indicativePresent3sES",
    indicativePresent1plES = "indicativePresent1plES",
    indicativePresent2plES = "indicativePresent2plES",
    indicativePresent3plES = "indicativePresent3plES",

    indicativeImperfectPast1sES = "indicativeImperfectPast1sES",
    indicativeImperfectPast2sES = "indicativeImperfectPast2sES",
    indicativeImperfectPast3sES = "indicativeImperfectPast3sES",
    indicativeImperfectPast1plES = "indicativeImperfectPast1plES",
    indicativeImperfectPast2plES = "indicativeImperfectPast2plES",
    indicativeImperfectPast3plES = "indicativeImperfectPast3plES",

    indicativePerfectSimplePast1sES = "indicativePerfectSimplePast1sES",
    indicativePerfectSimplePast2sES = "indicativePerfectSimplePast2sES",
    indicativePerfectSimplePast3sES = "indicativePerfectSimplePast3sES",
    indicativePerfectSimplePast1plES = "indicativePerfectSimplePast1plES",
    indicativePerfectSimplePast2plES = "indicativePerfectSimplePast2plES",
    indicativePerfectSimplePast3plES = "indicativePerfectSimplePast3plES",

    indicativeFuture1sES = "indicativeFuture1sES",
    indicativeFuture2sES = "indicativeFuture2sES",
    indicativeFuture3sES = "indicativeFuture3sES",
    indicativeFuture1plES = "indicativeFuture1plES",
    indicativeFuture2plES = "indicativeFuture2plES",
    indicativeFuture3plES = "indicativeFuture3plES",

    indicativeConditional1sES = "indicativeConditional1sES",
    indicativeConditional2sES = "indicativeConditional2sES",
    indicativeConditional3sES = "indicativeConditional3sES",
    indicativeConditional1plES = "indicativeConditional1plES",
    indicativeConditional2plES = "indicativeConditional2plES",
    indicativeConditional3plES = "indicativeConditional3plES",

    // SUBJECTIVE: --------------

    // IMPERATIVE: --------------
    imperative1sES = "imperative1sES",
    imperative2sES = "imperative2sES",
    imperative3sES = "imperative3sES",
    imperative1plES = "imperative1plES",
    imperative2plES = "imperative2plES",
    imperative3plES = "imperative3plES",


    // ============== ESTONIAN: ==============
        // Pronouns:
        // Mina (ma): 1st person singular (1s)
        // Sina (Sa): 2nd person singular (2s)
        // Tema (Ta): 3rd person singular (neutral) (3s)
        // Meie (me): 1nd person plural (1pl)
        // Teie  (Te): 2nd person plural (2pl)
        // Nad (nad): 3rd person plural (3pl)

    regularityEE = 'regularityEE',
    // KINDEL: --------------
    infinitiveMaEE = 'infinitiveMaEE',
    infinitiveDaEE = 'infinitiveDaEE',

    // present (positive)
    // TODO: missing present (negative: ei+nud variant - same for all pronouns same except 'other'
    kindelPresent1sEE = 'kindelPresent1sEE',
    kindelPresent2sEE = 'kindelPresent2sEE',
    kindelPresent3sEE = 'kindelPresent3sEE',
    kindelPresent1plEE = 'kindelPresent1plEE',
    kindelPresent2plEE = 'kindelPresent2plEE',
    kindelPresent3plEE = 'kindelPresent3plEE',
    // simple past (positive)
    // TODO: missing simple past (negative: ei+nud variant - same for all pronouns same except 'other'
    kindelSimplePast1sEE = 'kindelSimplePast1sEE',
    kindelSimplePast2sEE = 'kindelSimplePast2sEE',
    kindelSimplePast3sEE = 'kindelSimplePast3sEE',
    kindelSimplePast1plEE = 'kindelSimplePast1plEE',
    kindelSimplePast2plEE = 'kindelSimplePast2plEE',
    kindelSimplePast3plEE = 'kindelSimplePast3plEE',
    // past perfect (positive)
    // TODO: missing past perfect (negative: ei+nud variant - same for all pronouns same except 'other'
    kindelPastPerfect1sEE = 'kindelPastPerfect1sEE',
    kindelPastPerfect2sEE = 'kindelPastPerfect2sEE',
    kindelPastPerfect3sEE = 'kindelPastPerfect3sEE',
    kindelPastPerfect1plEE = 'kindelPastPerfect1plEE',
    kindelPastPerfect2plEE = 'kindelPastPerfect2plEE',
    kindelPastPerfect3plEE = 'kindelPastPerfect3plEE',


    // ============== GERMAN: ==============
        // Pronouns:
        // Ich: 1st person singular (1s)
        // Du: 2nd person singular (2s)
        // Er/Sie/ist: 3rd person singular (m/f/n) (3s)
        // Wir: 1nd person plural (1pl)
        // Ihr: 2nd person plural (2pl)
        // Sie: 3rd person plural (3pl)

    infinitiveDE = 'infinitiveDE',
    auxVerbDE = 'auxVerbDE',
    caseTypeDE = 'caseTypeDE',
    prefixDE = 'prefixDE',
    regularityDE = 'regularityDE',

    // INDICATIVE: --------------
    // Present: different for almost all pronouns
    indicativePresent1sDE = 'indicativePresent1sDE',
    indicativePresent2sDE = 'indicativePresent2sDE',
    indicativePresent3sDE = 'indicativePresent3sDE',
    indicativePresent1plDE = 'indicativePresent1plDE',
    indicativePresent2plDE = 'indicativePresent2plDE',
    indicativePresent3plDE = 'indicativePresent3plDE',
    // (present) Perfect: 'habe'-present-conjugated & ge+'stem'+t => same for all pronouns
    indicativePerfect1sDE = 'indicativePerfect1sDE',
    indicativePerfect2sDE = 'indicativePerfect2sDE',
    indicativePerfect3sDE = 'indicativePerfect3sDE',
    indicativePerfect1plDE = 'indicativePerfect1plDE',
    indicativePerfect2plDE = 'indicativePerfect2plDE',
    indicativePerfect3plDE = 'indicativePerfect3plDE',
    // Simple future (1)
    indicativeSimpleFuture1sDE = 'indicativeSimpleFuture1sDE',
    indicativeSimpleFuture2sDE = 'indicativeSimpleFuture2sDE',
    indicativeSimpleFuture3sDE = 'indicativeSimpleFuture3sDE',
    indicativeSimpleFuture1plDE = 'indicativeSimpleFuture1plDE',
    indicativeSimpleFuture2plDE = 'indicativeSimpleFuture2plDE',
    indicativeSimpleFuture3plDE = 'indicativeSimpleFuture3plDE',
    // Simple past (präteritum)
    indicativeSimplePast1sDE = 'indicativeSimplePast1sDE',
    indicativeSimplePast2sDE = 'indicativeSimplePast2sDE',
    indicativeSimplePast3sDE = 'indicativeSimplePast3sDE',
    indicativeSimplePast1plDE = 'indicativeSimplePast1plDE',
    indicativeSimplePast2plDE = 'indicativeSimplePast2plDE',
    indicativeSimplePast3plDE = 'indicativeSimplePast3plDE',
}
export enum VerbCaseTypeDE {
    accusativeDE = 'accusativeDE',
    dativeDE = 'dativeDE', // limited list ~50 verbs
    // accusativeDativeDE = 'accusativeDativeDE',
    genitiveDE = 'genitiveDE', // rare - mostly in formal writing?
}

export enum PrefixesVerbDE {
    ab = 'ab',
    an = 'an',
    auf = 'auf',
    aus = 'aus',
    bei = 'bei',
    da = 'da',
    dar = 'dar',
    durch = 'durch',
    ein = 'ein',
    fern = 'fern',
    fest = 'fest',
    fort = 'fort',
    gegen = 'gegen',
    her = 'her',
    hin = 'hin',
    los = 'los',
    mit = 'mit',
    nach = 'nach',
    nieder = 'nieder',
    um = 'um',
    vor = 'vor',
    weg = 'weg',
    wieder = 'wieder',
    zu = 'zu',
    zusammen = 'zusammen',
    zuryck = 'zurück', // NB! Careful with this one. Can cause issues.
}

// Complete list of Pronouns for German (to be used later in future features)
export enum PronounDE {
    // SIMPLIFIED:
        // Singular (sg)
    Sg1 = 'ich',
    Sg2 = 'du',
    Sg3 = 'er/sie/es',
        // Plural (pl)
    Pl1 = 'wir',
    Pl2 = 'ihr',
    Pl3 = 'sie',

    // NOMINATIVE
        // Singular (sg)
    NomSg1DE = 'ich',
    NomSg2DE = 'du',
    NomSg2FDE = 'Sie', // Formal
    NomSg3DE = 'er/sie/es',
    NomSg3MDE = 'er', // Male
    NomSg3FDE = 'sie', // Female
    NomSg3NDE = 'es', // Neutral
        // Plural (pl)
    NomPl1DE = 'wir',
    NomPl2DE = 'ihr',
    NomPl2FDE = 'Sie', // Formal
    NomPl3DE = 'sie',

    // ACCUSATIVE
        // Singular (sg)
    AccSg1DE = 'mich',
    AccSg2DE = 'dich',
    AccSg2FDE = 'Sie', // Formal
    AccSg3DE = 'ihn/sie/es',
    AccSg3MDE = 'ihn', // Male
    AccSg3FDE = 'sie', // Female
    AccSg3NDE = 'es', // Neutral
        // Plural (pl)
    AccPl1DE = 'uns',
    AccPl2DE = 'euch',
    AccPl2FDE = 'Sie', // Formal
    AccPl3DE = 'sie',

    // DATIVE
        // Singular (sg)
    DatSg1DE = 'mir',
    DatSg2DE = 'dir',
    DatSg2FDE = 'Ihnen', // Formal
    DatSg3DE = 'ihm/ihr/ihm',
    DatSg3MDE = 'ihm', // Male
    DatSg3FDE = 'ihr', // Female
    DatSg3NDE = 'ihm', // Neutral
        // Plural (pl)
    DatPl1DE = 'uns',
    DatPl2DE = 'euch',
    DatPl2FDE = 'Ihnen', // Formal
    DatPl3DE = 'ihnen',
}

export enum VerbRegularity {
    regular = 'regular',
    irregular = 'irregular'
}

export enum VerbMoodDE {
    indicativeDE = 'indicative',
    subjunctiveDE = 'subjunctive',
    imperativeDE = 'imperative',
}

export enum VerbMoodEN {
    indicativeEN = 'indicative',
    subjunctiveEN = 'subjunctive',
    imperativeEN = 'imperative',
    conditionalEN = 'conditional',
}

export enum VerbMoodES {
    indicativeES = 'indicative',
    subjunctiveES = 'subjunctive',
    imperativeES = 'imperative',
    conditionalES = 'conditional',
}

export enum VerbMoodEE {
    indicativeEE = 'indicative',
    subjunctiveEE = 'subjunctive',
    conditionalEE = 'conditional',
    jussiveEE = 'jussive',
}

export enum VerbTensesIndicativeDE {
    presentDE = 'presentDE', // Präsens
    simplePastDE = 'simplePastDE', // Präteritum
    presentPerfectDE = 'presentPerfectDE', // Perfekt
    pastPerfectDE = 'pastPerfectDE', // Plusquamperfekt
    simpleFutureDE = 'simpleFutureDE', // Futur I
    futurePerfectDE = 'futurePerfectDE' // Futur II
}

export enum Lang {
    ES = "Spanish",
    EN = "English",
    DE = "German",
    EE = "Estonian",
}

export enum GenderDE {
    M = "der", // MALE
    F = "die", // FEMALE
    N = "das" // NEUTRAL
}

export enum GenderES {
    M = "el", // MALE
    F = "la", // FEMALE
    N = "el/la" // NEUTRAL
}

export enum AuxVerbDE {
    H = "haben",
    S = "sein",
    W = "werden"
}

export enum Plurality {
    S = "Singular",
    P = "Plural",
}

export enum PartOfSpeech {
    noun = "Noun",
    verb = "Verb",
    adjective = "Adjective",
    adverb = "Adverb",
    preposition = "Preposition",
    conjunction = "Conjunction",
    pronoun = "Pronoun",
    interjection = "Interjection",
    properNoun = "Proper noun",
    numerals = "Numerals",
}

export enum DeclensionNoun {
    nominative = "Nominative",
    accusative = "Accusative",
    genitive = "Genitive",
    dative = "Dative",
    partitive = "Partitive",
}

export enum TenseVerbEN {
    pastSimple = "Past-Simple",
    pastPerfect = "Past-Perfect",
    pastContinuous = "Past-Continuous",
    pastPerfectContinuous = "Past-Perfect-Continuous",

    presentSimple = "Present-Simple",
    presentPerfect = "Present-Perfect",
    presentContinuous = "Present-Continuous",
    presentPerfectContinuous = "Present-Perfect-Continuous",

    futureSimple = "Future-Simple",
    futurePerfect = "Future-Perfect",
    futureContinuous = "Future-Continuous",
    futurePerfectContinuous = "Future-Perfect-Continuous",

    conditionalSimple = "Conditional-Simple",
}

export enum TenseVerbES {
    present = "Present",
    imperfectPast = "Imperfect-Past",
    perfectSimplePast = "Perfect-Simple-Past",
    future = "Future",
    conditional = "Conditional",
}

export enum TenseVerbDE {
    present = "Present",
    perfect = "Perfect",
    simpleFuture = "Simple-Future",
    simplePast = "Simple-Past", // Präteritum
}

export enum TenseVerbEE {
    present = "Present",
    simplePast = "Simple-Past", // kindel past
    pastPerfect = "Past-Perfect",
    conditionalPresent = "Conditional-Present", // tingiv present
    indirectPresent = "Indirect-Present", // kaudne present
    indirectPast = "Indirect-Past", // kaudne past
    imperative = "Imperative", // käskiv present
}


export enum MetricsType {
    WORDS,
    TRANSLATIONS
}

export enum ExerciseTypeSelection {
    'Multiple-Choice' = 'Multiple-Choice',
    'Text-Input' = 'Text-Input',
    'Random' = 'Random'
}

export enum CardTypeSelection {
    'Multi-Language' = 'Multi-Language',
    'Single-Language' = 'Single-Language',
    'Random' = 'Random'
}

export enum WordSortingSelection {
    'Exercise-Performance' = 'Exercise-Performance',
    'Random' = 'Random'
}

export enum NativeLanguageExerciseSelection {
    'Include' = 'Include',
    'Ignore' = 'Ignore'
}

// ========== PRONOUNS

// Spanish Pronouns
export enum SpanishPronouns {
    "1S" = "yo",
    "2S" = "tú",
    "3S" = "él/ella",
    "1P" = "nosotros/as",
    "2P" = "vosotros/as",
    "3P" = "ellos/as",
}

// English Pronouns
export enum EnglishPronouns {
    "1S" = "I",
    "2S" = "you",
    "3S" = "he/she/it",
    "1P" = "we",
    "2P" = "you",
    "3P" = "they",
}

// German Pronouns
export enum GermanPronouns {
    "1S" = "ich",
    "2S" = "du",
    "3S" = "er/sie/es",
    "1P" = "wir",
    "2P" = "ihr",
    "3P" = "sie",
}

// Estonian Pronouns
export enum EstonianPronouns {
    "1S" = "ma", // "mina"
    "2S" = "sa", // "sina"
    "3S" = "ta", // "tema"
    "1P" = "me", // "meie"
    "2P" = "te", // "teie"
    "3P" = "nad", // "nemad"
}