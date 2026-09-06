
// NB! It is important that any language-case (key-value) pair is on the third level of the JSON object,
// because the algorithm won't keep going down indefinitely

const verbGroupedCategoriesSingleLanguage = {
    "Spanish": {
        "Multiple-Choice": {
            regularity: {
                "questionWord": "infinitiveNonFiniteSimpleES",
                "correctValue": "regularityES",
                "otherValues": ['regular', 'irregular'],
                // "otherValues": [VerbRegularity.regular, VerbRegularity.irregular],
            },
        },
        "Text-Input": {
            participle: {
                "questionWord": "infinitiveNonFiniteSimpleES",
                "correctValue": "participleNonFiniteSimpleES",
            },
            gerund: {
                "questionWord": "infinitiveNonFiniteSimpleES",
                "correctValue": "gerundNonFiniteSimpleES",
            },
        },
    },
    "English": {
        "Multiple-Choice": {
            regularity: {
                "questionWord": "simplePresent1sEN",
                "correctValue": "regularityEN",
                "otherValues": ['regular', 'irregular'],
                // "otherValues": [VerbRegularity.regular, VerbRegularity.irregular],
            },
        },
        "Text-Input": {
            // categoryName: {
            //     "questionWord": "",
            //     "correctValue": "",
            // },
        },
    },
    "German": {
        "Multiple-Choice": {
            auxVerb: {
                "questionWord": "infinitiveDE",
                "correctValue": "auxVerbDE",
                "otherValues": ['haben', 'sein'],
                // "otherValues": [AuxVerbDE.H, AuxVerbDE.S],
            },
        },
        "Text-Input": {
            // categoryName: {
            //     "questionWord": "",
            //     "correctValue": "",
            // },
        },
    },
    "Estonian": {
        "Multiple-Choice": {
            // categoryName: {
            //     "questionWord": "",
            //     "correctValue": "",
            //     "otherValues": [],
            // },
        },
        "Text-Input": {
            // categoryName: {
            //     "questionWord": "",
            //     "correctValue": "",
            // },
        },
    },
}

module.exports = {
    verbGroupedCategoriesSingleLanguage,
}