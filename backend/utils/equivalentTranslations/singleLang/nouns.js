
// NB! It is important that any language-case (key-value) pair is on the third level of the JSON object,
// because the algorithm won't keep going down indefinitely

const nounGroupedCategoriesSingleLanguage = {
    "Spanish": {
        "Multiple-Choice": {
            // TODO: should this be a list of exercises?
            gender: {
                "questionWord": "singularES",
                "correctValue": "genderES",
                // TODO: should this be: ['N', 'F', 'N'] = > then we cast the value using enum?
                "otherValues": ['el', 'la', 'el/la'], // we'll filter the options != to correct value
                // "otherValues": [GenderDE.M, GenderDE.F, GenderDE.N],
            },
        },
        "Text-Input": {
            // TODO: look into other cases to practice within noun-ES
            // categoryName: {
            //     "questionWord": "",
            //     "correctValue": "",
            // },
        },
    },
    "German": {
        "Multiple-Choice": {
            gender: {
                "questionWord": "singularNominativDE",
                "correctValue": "genderDE",
                // TODO: should this be: ['N', 'F', 'N'] = > then we cast the value using enum?
                "otherValues": ['der', 'die', 'das'], // we'll filter the options != to correct value
                // "otherValues": [GenderDE.M, GenderDE.F, GenderDE.N],
            },
        },
        "Text-Input": {
            // TODO: look into other cases to practice within noun-DE
            // categoryName: {
            //     "questionWord": "",
            //     "correctValue": "",
            // },
        },
    },
    "Estonian": {
        "Multiple-Choice": {
            // TODO: look into other cases to practice within noun-EE
            // categoryName: {
            //     "questionWord": "",
            //     "correctValue": "",
            //     "otherValues": [],
            // },
        },
        "Text-Input": {
            shortForm: {
                "questionWord": "singularNimetavEE",
                "correctValue": "shortFormEE",
            },
        },
    },
    "English": {
        "Multiple-Choice": {
            // TODO: look into other cases to practice within noun-EE
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
    // TODO: look into cases to practice within noun-EN? (irregular plural?)
}

module.exports = {
    nounGroupedCategoriesSingleLanguage,
}