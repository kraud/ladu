
// NB! It is important that any language-case (key-value) pair is on the third level of the JSON object,
// because the algorithm won't keep going down indefinitely
const verbGroupedCategoriesMultiLanguage = {
    present: {
        firstSingular: {
            "English": "simplePresent1sEN",
            "Spanish": "indicativePresent1sES",
            "German": "indicativePresent1sDE",
            "Estonian": "kindelPresent1sEE",
        },
        secondSingular: {
            "English": "simplePresent2sEN",
            "Spanish": "indicativePresent2sES",
            "German": "indicativePresent2sDE",
            "Estonian": "kindelPresent2sEE",
        },
        thirdSingular: {
            "English": "simplePresent3sEN",
            "Spanish": "indicativePresent3sES",
            "German": "indicativePresent3sDE",
            "Estonian": "kindelPresent3sEE",
        },
        firstPlural: {
            "English": "simplePresent1plEN",
            "Spanish": "indicativePresent1plES",
            "German": "indicativePresent1plDE",
            "Estonian": "kindelPresent1plEE",
        },
        thirdPlural: {
            "English": "simplePresent3plEN",
            "Spanish": "indicativePresent3plES",
            "German": "indicativePresent3plDE",
            "Estonian": "kindelPresent3plEE",
        }
    },
    past: {
        firstSingular: {
            "English": "simplePast1sEN",
            "Spanish": "indicativePerfectSimplePast1sES",
            "German": "indicativeSimplePast1sDE",
            "Estonian": "kindelSimplePast1sEE",
        },
        secondSingular: {
            "English": "simplePast2sEN",
            "Spanish": "indicativePerfectSimplePast2sES",
            "German": "indicativeSimplePast2sDE",
            "Estonian": "kindelSimplePast2sEE",
        },
        thirdSingular: {
            "English": "simplePast3sEN",
            "Spanish": "indicativePerfectSimplePast3sES",
            "German": "indicativeSimplePast3sDE",
            "Estonian": "kindelSimplePast3sEE",
        },
        firstPlural: {
            "English": "simplePast1plEN",
            "Spanish": "indicativePerfectSimplePast1plES",
            "German": "indicativeSimplePast1plDE",
            "Estonian": "kindelSimplePast1plEE",
        },
        thirdPlural: {
            "English": "simplePast3plEN",
            "Spanish": "indicativePerfectSimplePast3plES",
            "German": "indicativeSimplePast3plDE",
            "Estonian": "kindelSimplePast3plEE",
        }
    },
    future: {
        firstSingular: {
            "English": "simpleFuture1sEN",
            "Spanish": "indicativeFuture1sES",
            "German": "indicativeSimpleFuture1sDE",
        },
        secondSingular: {
            "English": "simpleFuture2sEN",
            "Spanish": "indicativeFuture2sES",
            "German": "indicativeSimpleFuture2sDE",
        },
        thirdSingular: {
            "English": "simpleFuture3sEN",
            "Spanish": "indicativeFuture3sES",
            "German": "indicativeSimpleFuture3sDE",
        },
        firstPlural: {
            "English": "simpleFuture1plEN",
            "Spanish": "indicativeFuture1plES",
            "German": "indicativeSimpleFuture1plDE",
        },
        thirdPlural: {
            "English": "simpleFuture3plEN",
            "Spanish": "indicativeFuture3plES",
            "German": "indicativeSimpleFuture3plDE",
        }
    }
}

module.exports = {
    verbGroupedCategoriesMultiLanguage,
}