const mongoose = require('mongoose')
const asyncHandler = require("express-async-handler")
const {getWordsIdFromFollowedTagsByUserId} = require("./intermediary/userFollowingTagController")
const {findMatches, calculateAging} = require("./exercisePerformanceController")
const Word = require("../models/wordModel")
const {nounGroupedCategoriesMultiLanguage} = require("../utils/equivalentTranslations/multiLang/nouns");
const {verbGroupedCategoriesMultiLanguage} = require("../utils/equivalentTranslations/multiLang/verbs");
const {nounGroupedCategoriesSingleLanguage} = require("../utils/equivalentTranslations/singleLang/nouns");
const {verbGroupedCategoriesSingleLanguage} = require("../utils/equivalentTranslations/singleLang/verbs");

// Format returned by 'findEquivalentTranslations'
// interface EquivalentTranslationValues {
// 	multiLang: true, // boolean
// 	type: 'Multiple-Choice' | 'Text-Input' | 'Random',
// 	partOfSpeech: PartOfSpeech,
// 	matchingTranslations : {
// 		itemA: {
// 			language: Lang,
// 			case: caseEnum-according-to-PoS,
// 			value: string,
// 		},
// 		itemB: {
// 			language: Lang,
// 			case: caseEnum-according-to-PoS,
// 			value: string,
// 			otherValues: string[],
// 		}
// 	}
// }


// Helper function to shuffle array in-place
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

async function getRequiredAmountOfExercises(
    exercisesByWord, // exercises are grouped by word [] and include exercisePerformance data, related to all the included translations
    amountOfExercises,
    userId,
    isExerciseSelectionRandom
) {
    const requireMultipleExercisesPerWord = amountOfExercises > exercisesByWord.length
    const requireFewerExercisesPerWord = amountOfExercises < exercisesByWord.length

    let availableExercisesByWord = [...exercisesByWord] // Clone to avoid mutating the original
    let filteredExercises = []

    // Helper function to randomly select one exercise from each word group
    async function randomlySelectExerciseByWord(exercisesListByWord, userId) {
        const selectedExercises = []
        for (const word of exercisesListByWord) {
            let translationsPerformanceArray = word.exercisePerformancesByTranslation
            // We match each exercise with its corresponding exercisePerformance data, so we can sort it by their average-translation-knowledge
            // TODO: podríamos solo enviar "word", porque translationsPerformanceArray ya está incluido en "word"?
            const allExercises = findMatches(word, translationsPerformanceArray)
            if(!isExerciseSelectionRandom){
                allExercises.sort((a, b) => a.knowledge - b.knowledge)
            } else {
                // if NOT sorted by knowledge, we must shuffle all possible exercises and select one
                shuffleArray(allExercises)
            }
            const selectedExercise = allExercises[0]
            // We retain all exercises that do NOT match the one we just selected
            word.exercises = word.exercises.filter((rawExercise) => {
                return(
                    !(
                        (rawExercise.partOfSpeech === allExercises[0].partOfSpeech) &&
                        (rawExercise.type === allExercises[0].type) &&
                        (rawExercise.multiLang === allExercises[0].multiLang) &&
                        (rawExercise.matchingTranslations.itemA.case === allExercises[0].matchingTranslations.itemA.case) &&
                        (rawExercise.matchingTranslations.itemB.case === allExercises[0].matchingTranslations.itemB.case)
                    )
                )
            })
            selectedExercises.push(selectedExercise)
        }
        return selectedExercises
    }

    // Helper function for selecting exercises multiple times if needed
    async function randomlySelectExercisesMultipleWords(availableExercisesByWord, neededAmount, userId) {
        let selectedExercises = []
        let wordsInRandomOrder = [...availableExercisesByWord] // Clone the array
        while (selectedExercises.length < neededAmount) {
            if(isExerciseSelectionRandom){
                shuffleArray(wordsInRandomOrder) // Shuffle the array of exercises for randomness
            }
            const listSelectedExerciseByWord = await randomlySelectExerciseByWord(wordsInRandomOrder, userId)
            selectedExercises.push(
                ...listSelectedExerciseByWord.slice(0, neededAmount - selectedExercises.length) // Ensure we don't overshoot
            )
            wordsInRandomOrder = wordsInRandomOrder.filter(word => word.exercises.length > 0) // Keep only words with remaining exercises
            if (wordsInRandomOrder.length === 0) break // Stop if no exercises left
        }
        return selectedExercises
    }

    // Main logic
    if (requireMultipleExercisesPerWord) {
        // Select one exercise per word first, then loop through randomly until reaching the required amount
        filteredExercises = await randomlySelectExercisesMultipleWords(availableExercisesByWord, amountOfExercises, userId)
    } else if (requireFewerExercisesPerWord) {
        // Select random exercises from randomly picked words, stopping when the required amount is reached
        if(isExerciseSelectionRandom){
            shuffleArray(availableExercisesByWord) // Randomly shuffle word list
        }
        filteredExercises = await randomlySelectExerciseByWord(availableExercisesByWord, userId)
        filteredExercises = filteredExercises.slice(0, amountOfExercises)// Take as many as needed
    } else {
        // One exercise per word, equal number of exercises and words
        filteredExercises = await randomlySelectExerciseByWord(availableExercisesByWord, userId)
    }
    return filteredExercises
}

const getMCExerciseMultiLang = (itemA, itemB, partOfSpeech) => {
    return({
        partOfSpeech: partOfSpeech,
        type: "Multiple-Choice",
        multiLang: true,
        matchingTranslations: {
            itemA: {
                language: itemA.language,
                case: itemA.case,
                value: itemA.value,
            },
            itemB: {
                language: itemB.language,
                case: itemB.case,
                value: itemB.value,
                translationId: itemB.translationId,
                otherValues: []
            }
        }
    })
}
const getTIExerciseMultiLang = (itemA, itemB, partOfSpeech) => {
    return({
        partOfSpeech: partOfSpeech,  // Ensure partOfSpeech is used
        type: "Text-Input",
        multiLang: true,
        matchingTranslations: {
            itemA: {
                language: itemA.language,
                case: itemA.case,
                value: itemA.value,
            },
            itemB: {
                language: itemB.language,
                case: itemB.case,
                translationId: itemB.translationId,
                value: itemB.value
            }
        }
    })
}

const getMCExerciseSingleLang = (itemA, itemB, partOfSpeech) => {
    return({
        partOfSpeech: partOfSpeech,
        type: "Multiple-Choice",
        multiLang: false,
        matchingTranslations: {
            itemA: {
                language: itemA.language,
                case: itemA.case,
                value: itemA.value,
            },
            itemB: {
                language: itemB.language,
                case: itemB.case,
                value: itemB.value,
                translationId: itemB.translationId,
                otherValues: itemB.otherValues // for Single-Lang these options are hardcoded
            }
        }
    })
}

const getTIExerciseSingleLang = (itemA, itemB, partOfSpeech) => {
    return({
        partOfSpeech: partOfSpeech,
        type: "Text-Input",
        multiLang: false,
        matchingTranslations: {
            itemA: {
                language: itemA.language,
                case: itemA.case,
                value: itemA.value,
            },
            itemB: {
                language: itemB.language,
                case: itemB.case,
                value: itemB.value,
                translationId: itemB.translationId,
            }
        }
    })
}

const runRandomFunction = (functionA, functionB) => {
    // get random number between 0-10 and check if even or odd
    const randomValue = (Math.floor(Math.random() * 10))%2
    if(randomValue === 1){
        return(functionA)
    } else {
        return(functionB)
    }
}

// This returns a single exercise object, with the correct fields, according to:
// type: 'Multiple-Choice' (should include array for other -incorrect- options) or 'Text-Input' (will only include values for question and answer to be typed)
const getFormattedExerciseForMultiLang = (type, itemA, itemB, partOfSpeech) => {
    // Currently, the difference between the types is only 2 fields, but We create it this way
    // in case the format for the different type of exercises change a lot in the future
    switch(type) {
        case('Multiple-Choice'): {
            return(getMCExerciseMultiLang(itemA, itemB, partOfSpeech))
        }
        case('Text-Input'): {
            return(getTIExerciseMultiLang(itemA, itemB, partOfSpeech))
        }
        // TODO: potential additional type: 50%-50%?
        case('Random'): {
            return(
                runRandomFunction(
                    getMCExerciseMultiLang(itemA, itemB, partOfSpeech),
                    getTIExerciseMultiLang(itemA, itemB, partOfSpeech)
                )
            )
        }

        default: { // 'Other?'
            return({
                partOfSpeech: partOfSpeech,
                type: "Other",
                multiLang: true,
                matchingTranslations: {
                    itemA: {
                        language: itemA.language,
                        case: itemA.case,
                        value: itemA.value,
                    },
                    itemB: {
                        language: itemB.language,
                        case: itemB.case,
                        value: itemB.value,
                    }
                }
            })
        }
    }
}

// This returns a single exercise object, with the correct fields, according to:
// type: 'Multiple-Choice' (should include array for other -incorrect- options) or 'Text-Input' (will only include values for question and answer to be typed)
const getFormattedExerciseForSingleLang = (type, itemA, itemB, partOfSpeech) => {
    // Currently, the difference between the types is only 2 fields, but We create it this way
    // in case the format for the different type of exercises change a lot in the future
    switch(type) {
        case('Multiple-Choice'): {
            return(getMCExerciseSingleLang(itemA, itemB, partOfSpeech))
        }
        case('Text-Input'): {
            return(getTIExerciseSingleLang(itemA, itemB, partOfSpeech))
        }
        // NB! single-lang exercises are not designed to work as both Multiple-Choice or Text-Input,
        //  so for 'random-type' we create all the exercises possible from the fixed cases, and random selection is made later.


        default: { // 'Other?'
            return({
                partOfSpeech: partOfSpeech,
                type: "Other",
                multiLang: false,
                matchingTranslations: {
                    itemA: {
                        language: itemA.language,
                        case: itemA.case,
                        value: itemA.value,
                    },
                    itemB: {
                        language: itemB.language,
                        case: itemB.case,
                        value: itemB.value,
                    }
                }
            })
        }
    }
}

// Helper function to generate unique pairs of languages.
// This must be done at a word-level because each one might have a different set of available languages,
// depending on the translations assigned to it.
function getUniqueLanguagePairs(languages) {
    const pairs = [];
    for (let i = 0; i < languages.length; i++) {
        for (let j = i + 1; j < languages.length; j++) {
            pairs.push([languages[i], languages[j]]);
        }
    }
    return pairs
}


function calculateSingleLanguageExercises(
    validLanguages,
    wordData,
    exerciseType,
    nativeLanguage
) {
    let calculatedExercises = []
    const groupedCategories = getGroupedCategories(wordData.partOfSpeech, false)

    if(groupedCategories !== undefined) { // will only be 'undefined' for PoS that have no exercise-file defined
        // Iterate over each valid language
        (validLanguages.filter(potentialLanguages => {
            return(potentialLanguages !== nativeLanguage)
        })).forEach((validLanguage) => {
            const exercisesByRequestedType = (exerciseType === 'Random')
            // if random => we must create exercises for all types and then filter at the end randomly =>
            ? groupedCategories[validLanguage]
            // if not random => we only get exercises for the type
            : {[exerciseType]: (groupedCategories[validLanguage])[exerciseType]} // NB! This might break for-loop logic, because we're already "one level down"

            // Iterate over the types ('multipleChoice', 'textInput') of exercises stored for this combination of PoS+language
            for (const typeOfExercise in exercisesByRequestedType) {
                const exerciseList = exercisesByRequestedType[typeOfExercise]

                for (const exercise in exerciseList) {
                    const qw = wordData.translations
                        .find(t => t.language === validLanguage)
                        ?.cases.find(c => c.caseName === exerciseList[exercise].questionWord)
                    const cv_trans = wordData.translations.find(t => t.language === validLanguage);
                    const cv = wordData.translations
                        .find(t => t.language === validLanguage)
                        ?.cases.find(c => c.caseName === exerciseList[exercise].correctValue)
                    if(
                        (qw !== undefined) &&
                        (cv !== undefined)
                    ) {
                        const dataItemA = {
                            language: validLanguage,
                            case: exerciseList[exercise].questionWord,
                            value: qw.word,
                        }
                        const dataItemB = {
                            language: validLanguage,
                            case: exerciseList[exercise].correctValue,
                            value: cv.word,
                            translationId: cv_trans._id,
                            otherValues: (typeOfExercise === 'Multiple-Choice')
                                ? exerciseList[exercise].otherValues
                                : []
                        }
                        calculatedExercises.push(
                            getFormattedExerciseForSingleLang(
                                typeOfExercise,
                                dataItemA,
                                dataItemB,
                                wordData.partOfSpeech || ""
                            )
                        )
                    }
                }
            }
        })
    }


    return(calculatedExercises)
}

function calculateMultiLanguageExercises(
    validLanguages,
    wordData,
    exerciseType
) {
    let calculatedExercises = []
    // Now we calculate all the possible unique pairs of the intersection-languages
    const languagePairs = getUniqueLanguagePairs(validLanguages)
    const groupedCategories = getGroupedCategories(wordData.partOfSpeech, true)

    if(groupedCategories !== undefined) { // will only be 'undefined' for PoS that have no exercise-file defined
        // Iterate over each linguistic group (e.g., singular/plural for nouns, present/past for verbs)
        for (const group in groupedCategories) {
            const groupCategories = groupedCategories[group]

            // Iterate over each case within the group (e.g., nominative, accusative)
            for (const caseType in groupCategories) {
                const casesByLanguage = groupCategories[caseType]

                // Now check each pair of languages for matching cases
                for (const [langA, langB] of languagePairs) {
                    if (casesByLanguage[langA] && casesByLanguage[langB]) {
                        const itemA = wordData.translations
                            .find(t => t.language === langA)
                            ?.cases.find(c => c.caseName === casesByLanguage[langA])
                        const itemBTrans = wordData.translations
                            .find(t => t.language === langB);
                        const itemB = wordData.translations
                            .find(t => t.language === langB)
                            ?.cases.find(c => c.caseName === casesByLanguage[langB])

                        // If both languages have a matching word for this case, add to results
                        if (itemA && itemB) {
                            const dataItemA = {
                                language: langA,
                                case: casesByLanguage[langA],
                                value: itemA.word
                            }
                            const dataItemB = {
                                language: langB,
                                case: casesByLanguage[langB],
                                value: itemB.word,
                                translationId: itemBTrans._id,
                            }
                            calculatedExercises.push(
                                getFormattedExerciseForMultiLang(
                                    exerciseType,
                                    dataItemA,
                                    dataItemB,
                                    wordData.partOfSpeech || ""
                                )
                            )
                        }
                    }
                }
            }
        }
    }

    return(calculatedExercises)
}

// This functions receives:
// a single word, with all of its translations
// a list of the languages that are relevant to the user
// the corresponding grouped-categories relevant to the PoS of the word.
// This functions returns all the possible exercises between the translations associated with this word
function findExercisesByEquivalentTranslations(
    wordData,
    languages,
    exerciseType, //  'Multiple-Choice' | 'Text-Input' | 'Random',
    multiLang, //  'Multi-Language' | 'Single-Language' | 'Random',
    nativeLanguage // undefined | Lang
) {

    // First, we get ALL stored languages per word
    const availableLanguages = wordData.translations.map(t => t.language)
    // Get the intersection of the user-required languages and the languages stored in wordData.translations
    let randomOrderLanguages = [...languages] // we shuffle languages here, so each word will have better chances of different languages
    shuffleArray(randomOrderLanguages)
    const validLanguages = randomOrderLanguages.filter(lang => availableLanguages.includes(lang))
    let calculatedExercises = []

    switch(multiLang) {
        case('Multi-Language'): {
            calculatedExercises = calculateMultiLanguageExercises(
                validLanguages,
                wordData,
                exerciseType,
                calculatedExercises
            )
            break
        }
        case('Single-Language'): {
            calculatedExercises = calculateSingleLanguageExercises(
                validLanguages,
                wordData,
                exerciseType,
                nativeLanguage
            )
            break
        }
        // we create exercises for both situations, and then the exercise-selection will be made at random
        // TODO: debate if this should be random in the sense that we'll do one OR the other?
        case('Random'): {
            calculatedExercises = calculateMultiLanguageExercises(
                validLanguages,
                wordData,
                exerciseType
            )
            calculatedExercises = [
                ...calculatedExercises,
                ...calculateSingleLanguageExercises(
                    validLanguages,
                    wordData,
                    exerciseType,
                    nativeLanguage
                )
            ]
            break
        }
        default: {
            break
        }
    }

    return calculatedExercises
}

const getGroupedCategories = (partOfSpeech, multiLang) => {
    switch(partOfSpeech) {
        case('Noun'): {
            if(multiLang){
                return(nounGroupedCategoriesMultiLanguage)
            } else {
                return(nounGroupedCategoriesSingleLanguage)
            }
        }
        case('Verb'): {
            if(multiLang){
                return(verbGroupedCategoriesMultiLanguage)
            } else {
                return(verbGroupedCategoriesSingleLanguage)
            }
        }
        default: {
            return(undefined)
        }
    }
}

// Some cases stored in a TranslationItem.cases are not relevant to a Multiple-Choice exercise (like those related to noun-gender, or verb-regularity for example),
// so we use this function to filter them according to different parameters
// potentialCase: string
const calculateIfNotRelevantCase = (potentialCase) => {
    let ignore = false
    if(
        (potentialCase.startsWith('gender')) // nouns[ES || DE]
        ||
        (potentialCase.startsWith('gradable')) // adverbs[DE]
        ||
        (potentialCase.startsWith('regularity')) // verbs[EN || ES ]
        ||
        (potentialCase.startsWith('auxVerb')) // verbs[DE]
        ||
        (potentialCase.startsWith('caseType')) // verbs[DE]
        ||
        (potentialCase.startsWith('prefix')) // verbs[DE]
    ){
        ignore = true
    }
    return(ignore)
}

const isCorrectOptionValueFromThisTranslation = (fullListOfCases, originalCase, originalValue) => {
    return(
        fullListOfCases.some((caseRelatedToTranslation) => {
            return(
                (caseRelatedToTranslation.caseName === originalCase) &&
                (caseRelatedToTranslation.word === originalValue)
            )
        })
    )
}

// Depending on the selected difficulty, the exercises will be more or less complex. The logic is very similar between them,
// and the exact variations are still not completely defined, so (for now) each difficulty includes the whole logic-process,
// but this (will) might get simplified in the future if/once the logic is settled, and we can check if there's overlap and room to reduce duplicated code
const getValuesForMultiLangAndMultipleChoiceExerciseByDifficulty = (
    exerciseDifficulty, // difficulty of the Multiple-Choice options
    matchingWord, // current word (from filtered-by-parameters list)
    correctOptionCase, // itemB.case
    correctOptionValue, // itemB.value
    correctOptionLanguage, // itemB.language
    partOfSpeech, // PoS of the exercise
    requiredAmount, // how many options we need to find in total for this Multiple-Choice exercise
) => {
    let shuffledTranslations = [...matchingWord.translations]
    shuffleArray(shuffledTranslations)
    let returnValues = []

    switch(exerciseDifficulty){
        case(0): {
            // Difficulty level 0: Options will include any language and any PoS
            let breakFromCurrentWord = false; // this will prevent using more than 1 translation data per word
            (shuffledTranslations).forEach((matchingWordTranslation) => {
                // to avoid including the 'correct-option' in the other options
                // and to avoid including any other case from the translation related to correctOptionValue
                const sameTranslationOriginAsCorrectOptionValue = isCorrectOptionValueFromThisTranslation(matchingWordTranslation.cases, correctOptionCase, correctOptionValue)
                // TODO: add another boolean here to check if translation is related to info value (itemA.value). We would need additional parameters.
                if(!breakFromCurrentWord && !sameTranslationOriginAsCorrectOptionValue) {
                    const allCases = [...matchingWordTranslation.cases]
                    // we filter not relevant cases here (gender, regularity, etc.)
                    let allCasesRandomOrderAndFiltered = allCases.filter((caseToCheck) => {
                        // if they match any of the criteria to ignore => we won't consider that item
                        return(!calculateIfNotRelevantCase(caseToCheck.caseName))
                    })
                    // if there is at least 1 case that can be used, we add it to return values and break from this word
                    if(allCasesRandomOrderAndFiltered.length > 0){
                        shuffleArray(allCasesRandomOrderAndFiltered)
                        returnValues.push(allCasesRandomOrderAndFiltered[0].word)
                        // We use these two flags to guarantee that we'll get, at most, 1 MC-value per word
                        breakFromCurrentWord = true // this should break from the list of translations on this word
                    }
                }
            })
            break
        }
        case(1): {
            // Difficulty level 1: Multiple-Choice will only include results of the same Language
            const relevantTranslationMatch = shuffledTranslations.find((randomTranslation) => {
                return(randomTranslation.language === correctOptionLanguage)
            })
            if(relevantTranslationMatch !== undefined) { // word must have a translation in the target language => if NOT, we discard the word
                // to avoid including the 'correct-option' in the other options
                // and to avoid including any other case from the translation related to correctOptionValue
                const sameTranslationOriginAsCorrectOptionValue = isCorrectOptionValueFromThisTranslation(relevantTranslationMatch.cases, correctOptionCase, correctOptionValue)
                // TODO: add another boolean here to check if translation is related to info value (itemA.value). We would need additional parameters.
                if(!sameTranslationOriginAsCorrectOptionValue) {
                    const allCases = [...relevantTranslationMatch.cases]
                    // we filter not relevant cases here (gender, regularity, etc.)
                    let allCasesRandomOrderAndFiltered = allCases.filter((caseToCheck) => {
                        // if they match any of the criteria to ignore => we won't consider that item
                        return(!calculateIfNotRelevantCase(caseToCheck.caseName))
                    })
                    // if there is at least 1 case that can be used, we add it to return values and break from this word
                    if(allCasesRandomOrderAndFiltered.length > 0){
                        shuffleArray(allCasesRandomOrderAndFiltered)
                        returnValues.push(allCasesRandomOrderAndFiltered[0].word)
                    }
                }
            }
            break
        }
        case(2): {
            // Difficulty level 2: Multiple-Choice will only include results of the same PoS and same Language.
            if(matchingWord.partOfSpeech === partOfSpeech) { // If Word PoS does not match target translation PoS => discard word
                const relevantTranslationMatch = shuffledTranslations.find((randomTranslation) => {
                    return(randomTranslation.language === correctOptionLanguage)
                })
                if(relevantTranslationMatch !== undefined) { // word must have a translation in the target language => if NOT, we discard the word
                    // to avoid including the 'correct-option' in the other options
                    // and to avoid including any other case from the translation related to correctOptionValue
                    const sameTranslationOriginAsCorrectOptionValue = isCorrectOptionValueFromThisTranslation(relevantTranslationMatch.cases, correctOptionCase, correctOptionValue)
                    // TODO: add another boolean here to check if translation is related to info value (itemA.value). We would need additional parameters.
                    if(!sameTranslationOriginAsCorrectOptionValue) {
                        const allCases = [...relevantTranslationMatch.cases]
                        // we filter not relevant cases here (gender, regularity, etc.)
                        let allCasesRandomOrderAndFiltered = allCases.filter((caseToCheck) => {
                            // if they match any of the criteria to ignore => we won't consider that item
                            return(!calculateIfNotRelevantCase(caseToCheck.caseName))
                        })
                        // if there is at least 1 case that can be used, we add it to return values and break from this word
                        if(allCasesRandomOrderAndFiltered.length > 0){
                            shuffleArray(allCasesRandomOrderAndFiltered)
                            returnValues.push(allCasesRandomOrderAndFiltered[0].word)
                        }
                    }
                }
            }
            break
        }
        case(3): {
            // Difficulty level 3: Options will ONLY come from same sameTranslationOriginAsCorrectOptionValue. Only apply to verbs. (TODO: review if more PoS are possible)
            if(matchingWord.partOfSpeech === partOfSpeech) { // word must have a translation in the target language => if NOT, we discard the word
                const relevantTranslationMatch = shuffledTranslations.find((randomTranslation) => {
                    return(randomTranslation.language === correctOptionLanguage)
                })
                if(relevantTranslationMatch !== undefined) { // word must have a translation in the target language => if NOT, we discard the word
                    // to force only including other cases from the translation related to correctOptionValue
                    const sameTranslationOriginAsCorrectOptionValue = isCorrectOptionValueFromThisTranslation(relevantTranslationMatch.cases, correctOptionCase, correctOptionValue)
                    // if Verb => we need to get multiple values from SAME translation => opposite as every other PoS, which takes at most only 1 value from each translation
                    if((partOfSpeech === 'Verb') && (sameTranslationOriginAsCorrectOptionValue)){ // level 3 logic only applies to verbs (for now) (marchingWord.partOfSpeech will always match because we filtered that earlier)
                        const allCases = [...relevantTranslationMatch.cases]
                        // we filter not relevant cases here (gender, regularity, etc.) and other cases from correctOptionValue-translation
                        let allCasesRandomOrderAndFiltered = allCases.filter((caseToCheck) => {
                            return(
                                !calculateIfNotRelevantCase(caseToCheck.caseName) &&
                                ((correctOptionValue) !== (caseToCheck.word)) // OR avoid selecting the same value as the original value displayed as info (itemA.label)
                            ) // if they match any of the criteria to ignore => we won't consider that item
                        })
                        shuffleArray(allCasesRandomOrderAndFiltered)
                        // slice params: start & end (end not included) are indexes in array => if fewer available cases compared to required amount, we get them all
                        const indexEnd = (allCasesRandomOrderAndFiltered.length < requiredAmount)
                            ? undefined // if end undefined => slice extends to the end of the array.
                            : requiredAmount;
                        (allCasesRandomOrderAndFiltered.slice(0, indexEnd)).forEach((randomCase) => { // we slice the list here since we know how many items we want
                            returnValues.push(randomCase.word)
                        })
                    } else {
                        // similar logic as level 2 => Applies to all words that are not Verbs (fow now)
                        if(
                            (!sameTranslationOriginAsCorrectOptionValue) && // we check that translation is not match from correct-option
                            (partOfSpeech !== 'Verb' ) // This logic in Level 3, should only apply for NON 'Verbs'
                        ) {
                            const allCases = [...relevantTranslationMatch.cases]
                            // we filter not relevant cases here (gender, regularity, etc.) and other cases from correctOptionValue-translation
                            let allCasesRandomOrderAndFiltered = allCases.filter((caseToCheck) => {
                                return(
                                    !calculateIfNotRelevantCase(caseToCheck.caseName) && // to avoid checking irrelevant cases (gender, regularity, etc.)
                                    // OR avoid selecting the same value as the original value displayed as info (itemA.label)
                                    ((correctOptionValue) !== (caseToCheck.word))
                                ) // if they match any of the criteria to ignore => we won't consider that item
                            })
                            shuffleArray(allCasesRandomOrderAndFiltered)
                            if(allCasesRandomOrderAndFiltered.length > 0){
                                returnValues.push(allCasesRandomOrderAndFiltered[0].word)
                            }
                        }
                    }
                }
            }
            break
        }
    }
    return(returnValues)
}

// This will always find other words that match the language for a Multiple-Choice-type exercise, IF THE OPTIONS EXIST. If not, the list will return as many options as available.
const getOtherValuesForMultiLangAndMultipleChoiceExercise = (
    correctOptionLanguage, // itemB.language
    correctOptionValue, // itemB.value
    correctOptionCase, // itemB.case
    allMatchingWords, // all words filtered by parameters
    dataOrigin, // will specify if we need 'allMatchingWords', or if we'll use all-user words in DB as source (NOT implemented yet)
    requiredAmount, // how many options we need to find
    partOfSpeech, // PoS of the exercise (therefore also of the original
    difficulty // difficulty of the Multiple-Choice options
) => {
    const exerciseDifficulty = (difficulty !== undefined) ?difficulty :0
    switch (dataOrigin){
        case('matching-words'): {
            // we use 'allMatchingWords' as source of other options
            const shuffledMatchingWords = [...allMatchingWords]

            shuffleArray(shuffledMatchingWords) // this should guarantee that we won't be getting the same words in the "other-options" for different exercises
            let optionsFound = []
            shuffledMatchingWords.forEach((matchingWord) => {
                if(requiredAmount > optionsFound.length){
                    const acceptedValues = getValuesForMultiLangAndMultipleChoiceExerciseByDifficulty(
                        exerciseDifficulty, // can be made random with a parameter?
                        matchingWord,
                        correctOptionCase,
                        correctOptionValue,
                        correctOptionLanguage,
                        partOfSpeech,
                        requiredAmount
                    )
                    if(acceptedValues.length > 0) {
                        optionsFound.push(...acceptedValues)
                    }
                }
            })
            return(optionsFound)
        }
        case('all-available-words'): {
            // we use 'allMatchingWords' as source of other options
            // TODO: implement logic making query to BE for the required data for this exercise
            return([])
        }
    }
}

const getMissingDataForMCExercises = (incompleteExercises, allMatchingWords, dataOrigin, difficulty) => {

    // incomplete exercises, that we'll iterate over and improve the ones that are missing data (Multiple-Choice).
    // Not all items will be Multiple-Choice, in case user selected 'All' type, where each item is either 'Text-Input' or 'Multiple-Choice' at random.
    let exercisesWithFullData = []
    incompleteExercises.forEach((exercise) => {
        if(
            (exercise.type === 'Multiple-Choice') &&
            (exercise.multiLang) // (single-language)+(multiple-choice) will skip this, because we set hardcoded data when creating the exercise
        ){
            const requiredValues = getOtherValuesForMultiLangAndMultipleChoiceExercise(
                exercise.matchingTranslations.itemB.language,
                    exercise.matchingTranslations.itemB.value,
                    exercise.matchingTranslations.itemB.case,
                    allMatchingWords,
                    dataOrigin,
                    2, // TODO: this should be a parameter
                    exercise.partOfSpeech,
                    difficulty
            )
            if(requiredValues.length > 0){ // if no value matching the request was found, we remove the exercise from the return list
                exercisesWithFullData.push({
                    ...exercise,
                    matchingTranslations: {
                        ...exercise.matchingTranslations,
                        itemB: {
                            ...exercise.matchingTranslations.itemB,
                            otherValues: requiredValues
                        }
                    }
                })
            }
        } else { // if it's not Multiple-Choice => exercise is complete => store it in list
            exercisesWithFullData.push(exercise)
        }
    })
    return(exercisesWithFullData)
}

// interface translationPerformance {
    // user: req.user._id,
    // translationId: req.body.translationId,
    // word: req.body.word, //<= ObjectId
    // statsByCase: [{
    //     caseName: req.body.caseName, // string
    //     record: [req.body.record], // boolean[]
    //     lastDate: new Date(),
    //     knowledge: knowledge
    // }],
    // performanceModifier: String // 'Mastered' | 'Revise',
    // translationLanguage: Lang,
    // averageTranslationKnowledge: knowledge, // only one value for now, so average translation is the same as current case
    // lastDateModifiedTranslation: new Date() // always current date
// }

const calculateWordAverageKnowledge = (translationPerformancesList, userLanguages) => {
    // Average is calculated by average of translation-knowledge divided by amount of languages RELEVANT to the user
    // First, we overlap translations-languages and user-selected languages
    const languagesInTranslations = translationPerformancesList.map((translationPerformanceItem) => {
        return(translationPerformanceItem.translationLanguage)
    })
    const validLanguages = languagesInTranslations.filter((lang) => {
        return(
            (userLanguages).includes(lang)
        )
    })

    // Then we sum all aged-knowledge per translation and we divide it by validLanguages.length
    let newWordAverageKnowledge = 0
    translationPerformancesList.forEach((translationPerformance) => {
        if(validLanguages.includes(translationPerformance.translationLanguage)){
            // NB! if (performanceModifier !== undefined) => we ignore the real translationKnowledge and we don't age it either
            if (translationPerformance.performanceModifier === 'Mastered') {
                newWordAverageKnowledge += 100
                return // continue
            } else if (translationPerformance.performanceModifier === 'Revise') {
                newWordAverageKnowledge += 0
                return // continue
            }
            // NB! if (performanceModifier === undefined) => we proceed normally
            newWordAverageKnowledge += calculateAging(translationPerformance.averageTranslationKnowledge, translationPerformance.lastDateModifiedTranslation)
        }
    })
    if(validLanguages.length > 0){
        return(newWordAverageKnowledge/(validLanguages.length))
    } else {
        return(newWordAverageKnowledge)
    }
}

// PARAMETERS:
// export type ExerciseParameters = {
//     languages: Lang[],
//     partsOfSpeech: PartOfSpeech[],
//     amountOfExercises: number,
//     multiLang: CardTypeSelection, // 'Multi-Language' | 'Single-Language' | 'Random',
//     // type: ExerciseTypeSelection, //  'Multiple-Choice' | 'Text-Input' | 'Random',
//     mode: 'Single-Try' | 'Multiple-Tries'
//     preSelectedWords?: any[] // simple-word data
//     wordSelection: WordSortingSelection // determines if we use exercise-performance info to sort words/translations before selecting exercises
//     nativeLanguage?: Lang
// } & (MCType | TIType | RandomType)
//
// export type MCType = {
//     type: "Multiple-Choice",
//     difficultyMC: number
// }
// export type TIType = {
//     type: "Text-Input",
//     difficultyTI: number
// }
// export type RandomType = {
//     type: 'Random',
//     difficultyTI: number,
//     difficultyMC: number
// }

// @desc    Creates exercises for a user based on parameters specified by them on FE
// @route   GET /api/exercises
// @access  Private
const getExercises = asyncHandler(async (req, res) => {
    let userId = req.user.id
    const parameters = {
        ...req.query.parameters,
        amountOfExercises: parseInt(req.query.parameters.amountOfExercises, 10),
        difficultyMC: (req.query.parameters.difficultyMC !== undefined) ? parseInt(req.query.parameters.difficultyMC, 10) : undefined
    }
    const isExerciseSelectionRandom = (parameters.wordSelection === 'Random')

    // words related to other-users-tags, that the current user follows.
    // IF preselected words => DO NOT MAKE REQUEST
    const followedWordsId = await getWordsIdFromFollowedTagsByUserId(userId)

    // If the user pre-selected words to create exercises => we'll not check for any other words
    const getWordFilterQuery = (parametersIncludePreselectWords) => {
        if(parametersIncludePreselectWords){
            const id_list = parameters.preSelectedWords.map(preSelectedWord => {return(mongoose.Types.ObjectId(preSelectedWord))})
            return({
                _id: {
                    $in: id_list
                }
            })
        } else {
            return({
                $or: [
                    {"user": mongoose.Types.ObjectId(userId)},
                    {"_id": {$in: followedWordsId}}
                ]
            })
        }
    }
    const preSelectedWordsIncludedInParameters = (parameters.preSelectedWords !== undefined) && (parameters.preSelectedWords.length > 0)
    // word query should also filter by those that have at last 2 translations from the required by user (*)
    // (maybe 1 is ok too, if they are from Lang+PoS combo that can create exercises from single translation?)
    const wordFiltersObject = {
        $and:[
            getWordFilterQuery(preSelectedWordsIncludedInParameters),
            {
                partOfSpeech: {
                    $in: parameters.partsOfSpeech
                }
            }
            // could we check here if there is overlap of at least 1 language with the ones in parameters and filter accordingly?
        ]
    }
    const matchingWordData = await Word.aggregate([
        {
            $match: wordFiltersObject,
        },
        ...(!preSelectedWordsIncludedInParameters)
            ?[
                {$sample: { size: 50 }}
            ]
            : [],
        {
            $lookup: {
                from: 'exerciseperformances', // Nombre de la colección correspondiente a ExercisePerformance
                let: {wordId: '$_id'},
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    {$eq: ['$word', '$$wordId']},
                                    {$eq: ['$user', mongoose.Types.ObjectId(userId)]},
                                ],
                            },
                        },
                    },
                ],
                as: 'exercisePerformances',
                // TODO: review if Mongo can calculate average-word-knowledge with pre-defined internal functions, instead of server-side JS
            },
        }
    ])
    // TODO: calculate per-word average-aged knowledge using (averageTranslationKnowledge and lastDateModifiedTranslation)

    let exercisesByWord = []
    matchingWordData // if words not pre-selected => this list could be too big, we should pre-filter by only candidates with real exercise-potential first(*)?
        .forEach((matchingWord) => {
            const matchingExercisesPerWord = findExercisesByEquivalentTranslations(
                matchingWord,
                parameters.languages,
                parameters.type,
                parameters.multiLang,
                parameters.nativeLanguage,
            )
            // If we found exercises for that word, we save them, and we'll filter them later
            if(matchingExercisesPerWord.length > 0){
                exercisesByWord.push({
                    _id: matchingWord._id,
                    exercises: matchingExercisesPerWord, // EquivalentTranslationValues[]
                    exercisePerformancesByTranslation: matchingWord.exercisePerformances,
                    exercisePerformanceAverageByWord: (!isExerciseSelectionRandom)
                        ? calculateWordAverageKnowledge(matchingWord.exercisePerformances, req.user.languages) // average translation-aged-performance (from averageTranslationKnowledge and lastDateModifiedTranslation
                        : 0
                })
            }
        })
    if(!isExerciseSelectionRandom){
        exercisesByWord.sort((a, b) => a.exercisePerformanceAverageByWord - b.exercisePerformanceAverageByWord)
    }
    let filteredExercises = await getRequiredAmountOfExercises(exercisesByWord, parameters.amountOfExercises, userId, isExerciseSelectionRandom)
    // filteredExercises -->
    if(
        (['Multiple-Choice', 'Random'].includes(parameters.type)) &&
        // Single-Language have hardcoded options in Multiple-Choice (so we only need to get missing data when {type: Multiple-Choice OR Random})
        (parameters.multiLang !== 'Single-Language') // This way, we only add missing exercises in "Multi-Language" and "Random" (we'll have to check each exercise to see if they are ML or SL).
    ){
        const exercisesWithMCData = getMissingDataForMCExercises(
            filteredExercises,
            matchingWordData,
            // TODO: this should be optional if the user wants to only use words that match the parameters, or the full list of words they have stored in their account
            'matching-words', // 'matching-words' | 'all-available-words' TODO: should be a parameter
            parameters.difficultyMC
        )
        res.status(200).json(exercisesWithMCData)
    } else { // type: 'Text-Input' => no need to add additional options
        res.status(200).json(filteredExercises)
    }
})

module.exports = {
    getExercises,
}