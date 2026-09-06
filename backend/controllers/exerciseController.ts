/**
 * Exercise Controller — Drizzle ORM (PostgreSQL)
 *
 * Migration notes (MongoDB → PostgreSQL):
 *   - The `Word.aggregate()` with `$lookup` for exercisePerformances is
 *     replaced by separate queries + application-level joining.
 *   - `getWordsIdFromFollowedTagsByUserId` is imported from tagController.ts
 *     (which was migrated earlier and has the Drizzle version).
 *   - All grouped-category data files (nouns, verbs) are unchanged — they
 *     contain no DB references.
 *
 * Route usage is declared in ../routes/exerciseRoutes.js (still CJS).
 */

const { and, eq, inArray, or, sql } = require('drizzle-orm');
const { db } = require('../src/db');
const {
    exercisePerformanceCases,
    exercisePerformances,
    words,
} = require('../src/db/schema');
const {
    calculateAging,
    calculateNewPercentageOfKnowledge,
    findMatches,
} = require('./exercisePerformanceController');

const { nounGroupedCategoriesMultiLanguage } = require('../utils/equivalentTranslations/multiLang/nouns');
const { verbGroupedCategoriesMultiLanguage } = require('../utils/equivalentTranslations/multiLang/verbs');
const { nounGroupedCategoriesSingleLanguage } = require('../utils/equivalentTranslations/singleLang/nouns');
const { verbGroupedCategoriesSingleLanguage } = require('../utils/equivalentTranslations/singleLang/verbs');
const asyncHandler = require('express-async-handler');

// Shared word-assembly helpers (translations, cases, tags).
const { fetchWordsWithRelations } = require('../services/wordService');

// Re-exported from tagController's Drizzle version
const { getWordsIdFromFollowedTagsByUserId } = require('./tagController.ts');

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

type PerfRow = typeof exercisePerformances.$inferSelect;
type CaseRow = typeof exercisePerformanceCases.$inferSelect;

interface CaseEntry {
    caseName: string;
    word: string;
}

interface WordWithData {
    _id: string;
    user: string;
    partOfSpeech: string;
    clue: string | null;
    isCloned: boolean;
    originalCreatorId: string | null;
    translations: Array<{
        _id: string;
        language: string;
        cases: Array<{ word: string; caseName: string }>;
    }>;
    exercisePerformances: any[];
    createdAt: Date;
    updatedAt: Date;
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/**
 * Shuffle array in-place (Fisher-Yates).
 */
function shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

/**
 * Fetch words with their translations and cases, assembled into the old
 * Mongoose aggregate shape expected by the exercise-generation functions.
 *
 * Delegates to the shared fetchWordsWithRelations from wordService which
 * eliminates the duplicate join logic that was previously inlined here.
 * An empty exercisePerformances array is added to match the expected shape.
 */
const fetchWordsWithData = async (
    wordIds: string[],
): Promise<WordWithData[]> => {
    const wordResponses = await fetchWordsWithRelations(wordIds);
    return wordResponses.map((w) => ({
        _id: w._id,
        user: w.user,
        partOfSpeech: w.partOfSpeech,
        clue: w.clue,
        isCloned: w.isCloned,
        originalCreatorId: w.originalCreator,
        translations: w.translations,
        exercisePerformances: [],
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
    }));
};

/**
 * Fetch exercise performance records for a set of words, assembled into the
 * legacy Mongoose document shape (with nested statsByCase).
 */
const fetchPerformancesForWords = async (
    wordIds: string[],
    userId: string,
): Promise<any[]> => {
    if (wordIds.length === 0) return [];

    const perfRows = await db
        .select()
        .from(exercisePerformances)
        .where(
            and(
                inArray(exercisePerformances.wordId, wordIds),
                eq(exercisePerformances.userId, userId),
            ),
        );

    if (perfRows.length === 0) return [];

    const perfIds = perfRows.map((p) => p.id);
    const caseRows = await db
        .select()
        .from(exercisePerformanceCases)
        .where(inArray(exercisePerformanceCases.exercisePerformanceId, perfIds));

    const casesByPerfId = new Map<string, any[]>();
    for (const c of caseRows) {
        const bucket = casesByPerfId.get(c.exercisePerformanceId);
        if (bucket) bucket.push(c);
        else casesByPerfId.set(c.exercisePerformanceId, [c]);
    }

    return perfRows.map((p) => ({
        _id: p.id,
        user: p.userId,
        translationId: p.translationId,
        translationLanguage: p.translationLanguage,
        word: p.wordId,
        statsByCase: (casesByPerfId.get(p.id) || []).map((c) => ({
            caseName: c.caseName,
            record: c.record,
            lastDate: c.lastDate,
            knowledge: c.knowledge,
        })),
        averageTranslationKnowledge: p.averageTranslationKnowledge,
        lastDateModifiedTranslation: p.lastDateModifiedTranslation,
        performanceModifier: p.performanceModifier,
        reviseCounter: p.reviseCounter,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
    }));
};

// ===========================================================================
// EXERCISE-GENERATION HELPERS (ported from the JS original)
// ===========================================================================

const getFormattedExerciseForMultiLang = (type: string, itemA: any, itemB: any, partOfSpeech: string) => {
    switch (type) {
        case 'Multiple-Choice':
            return {
                partOfSpeech,
                type: 'Multiple-Choice',
                multiLang: true,
                matchingTranslations: {
                    itemA: { language: itemA.language, case: itemA.case, value: itemA.value },
                    itemB: { language: itemB.language, case: itemB.case, value: itemB.value, translationId: itemB.translationId, otherValues: [] },
                },
            };
        case 'Text-Input':
            return {
                partOfSpeech,
                type: 'Text-Input',
                multiLang: true,
                matchingTranslations: {
                    itemA: { language: itemA.language, case: itemA.case, value: itemA.value },
                    itemB: { language: itemB.language, case: itemB.case, translationId: itemB.translationId, value: itemB.value },
                },
            };
        case 'Random':
            return (Math.floor(Math.random() * 10) % 2 === 1)
                ? getFormattedExerciseForMultiLang('Multiple-Choice', itemA, itemB, partOfSpeech)
                : getFormattedExerciseForMultiLang('Text-Input', itemA, itemB, partOfSpeech);
        default:
            return {
                partOfSpeech,
                type: 'Other',
                multiLang: true,
                matchingTranslations: {
                    itemA: { language: itemA.language, case: itemA.case, value: itemA.value },
                    itemB: { language: itemB.language, case: itemB.case, value: itemB.value },
                },
            };
    }
};

const getFormattedExerciseForSingleLang = (type: string, itemA: any, itemB: any, partOfSpeech: string) => {
    switch (type) {
        case 'Multiple-Choice':
            return {
                partOfSpeech,
                type: 'Multiple-Choice',
                multiLang: false,
                matchingTranslations: {
                    itemA: { language: itemA.language, case: itemA.case, value: itemA.value },
                    itemB: { language: itemB.language, case: itemB.case, value: itemB.value, translationId: itemB.translationId, otherValues: itemB.otherValues },
                },
            };
        case 'Text-Input':
            return {
                partOfSpeech,
                type: 'Text-Input',
                multiLang: false,
                matchingTranslations: {
                    itemA: { language: itemA.language, case: itemA.case, value: itemA.value },
                    itemB: { language: itemB.language, case: itemB.case, value: itemB.value, translationId: itemB.translationId },
                },
            };
        default:
            return {
                partOfSpeech,
                type: 'Other',
                multiLang: false,
                matchingTranslations: {
                    itemA: { language: itemA.language, case: itemA.case, value: itemA.value },
                    itemB: { language: itemB.language, case: itemB.case, value: itemB.value },
                },
            };
    }
};

const getUniqueLanguagePairs = (languages: string[]): string[][] => {
    const pairs: string[][] = [];
    for (let i = 0; i < languages.length; i++) {
        for (let j = i + 1; j < languages.length; j++) {
            pairs.push([languages[i], languages[j]]);
        }
    }
    return pairs;
};

const getGroupedCategories = (partOfSpeech: string, multiLang: boolean) => {
    switch (partOfSpeech) {
        case 'Noun':
            return multiLang ? nounGroupedCategoriesMultiLanguage : nounGroupedCategoriesSingleLanguage;
        case 'Verb':
            return multiLang ? verbGroupedCategoriesMultiLanguage : verbGroupedCategoriesSingleLanguage;
        default:
            return undefined;
    }
};

const calculateIfNotRelevantCase = (potentialCase: string): boolean => {
    return (
        potentialCase.startsWith('gender') ||
        potentialCase.startsWith('gradable') ||
        potentialCase.startsWith('regularity') ||
        potentialCase.startsWith('auxVerb') ||
        potentialCase.startsWith('caseType') ||
        potentialCase.startsWith('prefix')
    );
};

const isCorrectOptionValueFromThisTranslation = (
    fullListOfCases: CaseEntry[],
    originalCase: string,
    originalValue: string,
): boolean => {
    return fullListOfCases.some(
        (c) => c.caseName === originalCase && c.word === originalValue,
    );
};

const calculateSingleLanguageExercises = (
    validLanguages: string[],
    wordData: WordWithData,
    exerciseType: string,
    nativeLanguage: string,
): any[] => {
    const calculatedExercises: any[] = [];
    const groupedCategories = getGroupedCategories(wordData.partOfSpeech, false);

    if (groupedCategories === undefined) return calculatedExercises;

    (validLanguages.filter((l) => l !== nativeLanguage)).forEach((validLanguage) => {
        const exercisesByRequestedType = exerciseType === 'Random'
            ? groupedCategories[validLanguage]
            : { [exerciseType]: (groupedCategories[validLanguage])[exerciseType] };

        for (const typeOfExercise in exercisesByRequestedType) {
            const exerciseList = exercisesByRequestedType[typeOfExercise];
            for (const exerciseIdx in exerciseList) {
                const qw = wordData.translations
                    .find((t) => t.language === validLanguage)
                    ?.cases.find((c) => c.caseName === exerciseList[exerciseIdx].questionWord);
                const cv = wordData.translations
                    .find((t) => t.language === validLanguage)
                    ?.cases.find((c) => c.caseName === exerciseList[exerciseIdx].correctValue);
                if (qw && cv) {
                    const dataItemA = { language: validLanguage, case: exerciseList[exerciseIdx].questionWord, value: qw.word };
                    const dataItemB = {
                        language: validLanguage,
                        case: exerciseList[exerciseIdx].correctValue,
                        value: cv.word,
                        translationId: wordData.translations.find((t) => t.language === validLanguage)?._id,
                        otherValues: typeOfExercise === 'Multiple-Choice' ? exerciseList[exerciseIdx].otherValues : [],
                    };
                    calculatedExercises.push(getFormattedExerciseForSingleLang(typeOfExercise, dataItemA, dataItemB, wordData.partOfSpeech));
                }
            }
        }
    });

    return calculatedExercises;
};

const calculateMultiLanguageExercises = (
    validLanguages: string[],
    wordData: WordWithData,
    exerciseType: string,
): any[] => {
    const calculatedExercises: any[] = [];
    const languagePairs = getUniqueLanguagePairs(validLanguages);
    const groupedCategories = getGroupedCategories(wordData.partOfSpeech, true);

    if (groupedCategories === undefined) return calculatedExercises;

    for (const group in groupedCategories) {
        const groupCategories = groupedCategories[group];
        for (const caseType in groupCategories) {
            const casesByLanguage = groupCategories[caseType];
            for (const [langA, langB] of languagePairs) {
                if (casesByLanguage[langA] && casesByLanguage[langB]) {
                    const itemA = wordData.translations
                        .find((t) => t.language === langA)
                        ?.cases.find((c) => c.caseName === casesByLanguage[langA]);
                    const itemBTrans = wordData.translations.find((t) => t.language === langB);
                    const itemB = wordData.translations
                        .find((t) => t.language === langB)
                        ?.cases.find((c) => c.caseName === casesByLanguage[langB]);

                    if (itemA && itemB) {
                        const dataItemA = { language: langA, case: casesByLanguage[langA], value: itemA.word };
                        const dataItemB = { language: langB, case: casesByLanguage[langB], value: itemB.word, translationId: itemBTrans?._id };
                        calculatedExercises.push(getFormattedExerciseForMultiLang(exerciseType, dataItemA, dataItemB, wordData.partOfSpeech));
                    }
                }
            }
        }
    }

    return calculatedExercises;
};

const findExercisesByEquivalentTranslations = (
    wordData: WordWithData,
    languages: string[],
    exerciseType: string,
    multiLang: string,
    nativeLanguage?: string,
): any[] => {
    const availableLanguages = wordData.translations.map((t) => t.language);
    const randomOrderLanguages = [...languages];
    shuffleArray(randomOrderLanguages);
    const validLanguages = randomOrderLanguages.filter((l) => availableLanguages.includes(l));

    switch (multiLang) {
        case 'Multi-Language':
            return calculateMultiLanguageExercises(validLanguages, wordData, exerciseType);
        case 'Single-Language':
            return calculateSingleLanguageExercises(validLanguages, wordData, exerciseType, nativeLanguage || '');
        case 'Random': {
            const multiResult = calculateMultiLanguageExercises(validLanguages, wordData, exerciseType);
            const singleResult = calculateSingleLanguageExercises(validLanguages, wordData, exerciseType, nativeLanguage || '');
            return [...multiResult, ...singleResult];
        }
        default:
            return [];
    }
};

const calculateWordAverageKnowledge = (
    translationPerformancesList: any[],
    userLanguages: string[],
): number => {
    const languagesInTranslations = translationPerformancesList.map(
        (p) => p.translationLanguage,
    );
    const validLanguages = languagesInTranslations.filter(
        (lang) => userLanguages.includes(lang),
    );

    let sum = 0;
    translationPerformancesList.forEach((perf) => {
        if (validLanguages.includes(perf.translationLanguage)) {
            if (perf.performanceModifier === 'Mastered') {
                sum += 100;
                return;
            } else if (perf.performanceModifier === 'Revise') {
                sum += 0;
                return;
            }
            sum += calculateAging(
                perf.averageTranslationKnowledge,
                perf.lastDateModifiedTranslation,
            );
        }
    });

    return validLanguages.length > 0 ? sum / validLanguages.length : sum;
};

// ===========================================================================
// EXERCISE SELECTION HELPERS
// ===========================================================================

async function getRequiredAmountOfExercises(
    exercisesByWord: any[],
    amountOfExercises: number,
    userId: string,
    isExerciseSelectionRandom: boolean,
): Promise<any[]> {
    const requireMultiple = amountOfExercises > exercisesByWord.length;
    const requireFewer = amountOfExercises < exercisesByWord.length;

    let availableExercisesByWord = [...exercisesByWord];
    let filteredExercises: any[] = [];

    const randomlySelectExerciseByWord = async (
        exercisesListByWord: any[],
    ): Promise<any[]> => {
        const selectedExercises: any[] = [];
        for (const word of exercisesListByWord) {
            const translationsPerformanceArray = word.exercisePerformancesByTranslation;
            const allExercises = findMatches(word, translationsPerformanceArray);
            if (!isExerciseSelectionRandom) {
                allExercises.sort((a: any, b: any) => a.knowledge - b.knowledge);
            } else {
                shuffleArray(allExercises);
            }
            const selected = allExercises[0];
            word.exercises = word.exercises.filter((rawExercise: any) => {
                return !(
                    rawExercise.partOfSpeech === selected.partOfSpeech &&
                    rawExercise.type === selected.type &&
                    rawExercise.multiLang === selected.multiLang &&
                    rawExercise.matchingTranslations.itemA.case === selected.matchingTranslations.itemA.case &&
                    rawExercise.matchingTranslations.itemB.case === selected.matchingTranslations.itemB.case
                );
            });
            selectedExercises.push(selected);
        }
        return selectedExercises;
    };

    const randomlySelectExercisesMultipleWords = async (
        available: any[],
        neededAmount: number,
    ): Promise<any[]> => {
        let selected: any[] = [];
        let wordsInRandomOrder = [...available];
        while (selected.length < neededAmount) {
            if (isExerciseSelectionRandom) shuffleArray(wordsInRandomOrder);
            const listSelected = await randomlySelectExerciseByWord(wordsInRandomOrder);
            selected.push(...listSelected.slice(0, neededAmount - selected.length));
            wordsInRandomOrder = wordsInRandomOrder.filter((w) => w.exercises.length > 0);
            if (wordsInRandomOrder.length === 0) break;
        }
        return selected;
    };

    if (requireMultiple) {
        filteredExercises = await randomlySelectExercisesMultipleWords(availableExercisesByWord, amountOfExercises);
    } else if (requireFewer) {
        if (isExerciseSelectionRandom) shuffleArray(availableExercisesByWord);
        filteredExercises = await randomlySelectExerciseByWord(availableExercisesByWord);
        filteredExercises = filteredExercises.slice(0, amountOfExercises);
    } else {
        filteredExercises = await randomlySelectExerciseByWord(availableExercisesByWord);
    }

    return filteredExercises;
}

const getValuesForMultiLangAndMultipleChoiceExerciseByDifficulty = (
    exerciseDifficulty: number,
    matchingWord: WordWithData,
    correctOptionCase: string,
    correctOptionValue: string,
    correctOptionLanguage: string,
    partOfSpeech: string,
    requiredAmount: number,
): string[] => {
    let shuffledTranslations = [...matchingWord.translations];
    shuffleArray(shuffledTranslations);
    let returnValues: string[] = [];

    switch (exerciseDifficulty) {
        case 0: {
            let breakFromCurrentWord = false;
            shuffledTranslations.forEach((trans) => {
                const sameOrigin = isCorrectOptionValueFromThisTranslation(
                    trans.cases, correctOptionCase, correctOptionValue,
                );
                if (!breakFromCurrentWord && !sameOrigin) {
                    const allCases = [...trans.cases];
                    const filtered = allCases.filter((c) => !calculateIfNotRelevantCase(c.caseName));
                    if (filtered.length > 0) {
                        shuffleArray(filtered);
                        returnValues.push(filtered[0].word);
                        breakFromCurrentWord = true;
                    }
                }
            });
            break;
        }
        case 1: {
            const relevantMatch = shuffledTranslations.find((t) => t.language === correctOptionLanguage);
            if (relevantMatch) {
                const sameOrigin = isCorrectOptionValueFromThisTranslation(
                    relevantMatch.cases, correctOptionCase, correctOptionValue,
                );
                if (!sameOrigin) {
                    const allCases = [...relevantMatch.cases];
                    const filtered = allCases.filter((c) => !calculateIfNotRelevantCase(c.caseName));
                    if (filtered.length > 0) {
                        shuffleArray(filtered);
                        returnValues.push(filtered[0].word);
                    }
                }
            }
            break;
        }
        case 2: {
            if (matchingWord.partOfSpeech === partOfSpeech) {
                const relevantMatch = shuffledTranslations.find((t) => t.language === correctOptionLanguage);
                if (relevantMatch) {
                    const sameOrigin = isCorrectOptionValueFromThisTranslation(
                        relevantMatch.cases, correctOptionCase, correctOptionValue,
                    );
                    if (!sameOrigin) {
                        const allCases = [...relevantMatch.cases];
                        const filtered = allCases.filter((c) => !calculateIfNotRelevantCase(c.caseName));
                        if (filtered.length > 0) {
                            shuffleArray(filtered);
                            returnValues.push(filtered[0].word);
                        }
                    }
                }
            }
            break;
        }
        case 3: {
            if (matchingWord.partOfSpeech === partOfSpeech) {
                const relevantMatch = shuffledTranslations.find((t) => t.language === correctOptionLanguage);
                if (relevantMatch) {
                    const sameOrigin = isCorrectOptionValueFromThisTranslation(
                        relevantMatch.cases, correctOptionCase, correctOptionValue,
                    );
                    if (partOfSpeech === 'Verb' && sameOrigin) {
                        const allCases = [...relevantMatch.cases];
                        const filtered = allCases.filter(
                            (c) => !calculateIfNotRelevantCase(c.caseName) && correctOptionValue !== c.word,
                        );
                        shuffleArray(filtered);
                        const indexEnd = filtered.length < requiredAmount ? undefined : requiredAmount;
                        filtered.slice(0, indexEnd).forEach((c) => returnValues.push(c.word));
                    } else if (
                        !sameOrigin &&
                        partOfSpeech !== 'Verb'
                    ) {
                        const allCases = [...relevantMatch.cases];
                        const filtered = allCases.filter(
                            (c) => !calculateIfNotRelevantCase(c.caseName) && correctOptionValue !== c.word,
                        );
                        shuffleArray(filtered);
                        if (filtered.length > 0) returnValues.push(filtered[0].word);
                    }
                }
            }
            break;
        }
    }

    return returnValues;
};

const getOtherValuesForMultiLangAndMultipleChoiceExercise = (
    correctOptionLanguage: string,
    correctOptionValue: string,
    correctOptionCase: string,
    allMatchingWords: WordWithData[],
    dataOrigin: string,
    requiredAmount: number,
    partOfSpeech: string,
    difficulty: number,
): string[] => {
    const exerciseDifficulty = difficulty !== undefined ? difficulty : 0;

    switch (dataOrigin) {
        case 'matching-words': {
            const shuffledWords = [...allMatchingWords];
            shuffleArray(shuffledWords);
            let optionsFound: string[] = [];
            shuffledWords.forEach((word) => {
                if (requiredAmount > optionsFound.length) {
                    const accepted = getValuesForMultiLangAndMultipleChoiceExerciseByDifficulty(
                        exerciseDifficulty,
                        word,
                        correctOptionCase,
                        correctOptionValue,
                        correctOptionLanguage,
                        partOfSpeech,
                        requiredAmount,
                    );
                    if (accepted.length > 0) optionsFound.push(...accepted);
                }
            });
            return optionsFound;
        }
        case 'all-available-words':
            return [];
        default:
            return [];
    }
};

const getMissingDataForMCExercises = (
    incompleteExercises: any[],
    allMatchingWords: WordWithData[],
    dataOrigin: string,
    difficulty: number,
): any[] => {
    const exercisesWithFullData: any[] = [];

    incompleteExercises.forEach((exercise) => {
        if (exercise.type === 'Multiple-Choice' && exercise.multiLang) {
            const requiredValues = getOtherValuesForMultiLangAndMultipleChoiceExercise(
                exercise.matchingTranslations.itemB.language,
                exercise.matchingTranslations.itemB.value,
                exercise.matchingTranslations.itemB.case,
                allMatchingWords,
                dataOrigin,
                2,
                exercise.partOfSpeech,
                difficulty,
            );
            if (requiredValues.length > 0) {
                exercisesWithFullData.push({
                    ...exercise,
                    matchingTranslations: {
                        ...exercise.matchingTranslations,
                        itemB: { ...exercise.matchingTranslations.itemB, otherValues: requiredValues },
                    },
                });
            }
        } else {
            exercisesWithFullData.push(exercise);
        }
    });

    return exercisesWithFullData;
};

// ===========================================================================
// ENDPOINTS
// ===========================================================================

// @desc    Creates exercises for a user based on parameters
// @route   GET /api/exercises/getUserExercises
// @access  Private
const getExercises = asyncHandler(async (req: any, res: any) => {
    const userId = req.user.id;
    const parameters = {
        ...req.query.parameters,
        amountOfExercises: parseInt(req.query.parameters.amountOfExercises, 10),
        difficultyMC: req.query.parameters.difficultyMC !== undefined
            ? parseInt(req.query.parameters.difficultyMC, 10)
            : undefined,
    };
    const isExerciseSelectionRandom = parameters.wordSelection === 'Random';

    // Get word IDs (own words + followed-tag words, or preselected)
    const preSelectedWordsIncluded = parameters.preSelectedWords !== undefined && parameters.preSelectedWords.length > 0;

    let targetWordIds: string[];

    if (preSelectedWordsIncluded) {
        targetWordIds = parameters.preSelectedWords;
    } else {
        const followedWordIds = await getWordsIdFromFollowedTagsByUserId(userId);

        const myWordRows = await db
            .select({ id: words.id })
            .from(words)
            .where(eq(words.userId, userId));

        const myWordIds = myWordRows.map((w) => w.id);
        targetWordIds = [...new Set([...myWordIds, ...followedWordIds])];
    }

    // Fetch words
    const allWordRows = await fetchWordsWithData(targetWordIds);

    // Filter by partOfSpeech
    const matchingWordData = allWordRows.filter((w) =>
        parameters.partsOfSpeech.includes(w.partOfSpeech),
    );

    // If not preselected, random sample of 50
    let sampledWordData: WordWithData[];
    if (!preSelectedWordsIncluded && matchingWordData.length > 50) {
        shuffleArray(matchingWordData);
        sampledWordData = matchingWordData.slice(0, 50);
    } else {
        sampledWordData = matchingWordData;
    }

    const sampledWordIds = sampledWordData.map((w) => w._id);

    // Fetch exercise performances for these words
    const performances = await fetchPerformancesForWords(sampledWordIds, userId);

    // Attach performances to matching words
    const perfByWordId = new Map<string, any[]>();
    for (const p of performances) {
        const bucket = perfByWordId.get(p.word);
        if (bucket) bucket.push(p);
        else perfByWordId.set(p.word, [p]);
    }
    for (const w of sampledWordData) {
        w.exercisePerformances = perfByWordId.get(w._id) || [];
    }

    // Generate exercises per word
    let exercisesByWord: any[] = [];
    sampledWordData.forEach((matchingWord) => {
        const matchingExercisesPerWord = findExercisesByEquivalentTranslations(
            matchingWord,
            parameters.languages,
            parameters.type,
            parameters.multiLang,
            parameters.nativeLanguage,
        );

        if (matchingExercisesPerWord.length > 0) {
            exercisesByWord.push({
                _id: matchingWord._id,
                exercises: matchingExercisesPerWord,
                exercisePerformancesByTranslation: matchingWord.exercisePerformances,
                exercisePerformanceAverageByWord: !isExerciseSelectionRandom
                    ? calculateWordAverageKnowledge(matchingWord.exercisePerformances, req.user.languages)
                    : 0,
            });
        }
    });

    if (!isExerciseSelectionRandom) {
        exercisesByWord.sort(
            (a, b) => a.exercisePerformanceAverageByWord - b.exercisePerformanceAverageByWord,
        );
    }

    let filteredExercises = await getRequiredAmountOfExercises(
        exercisesByWord,
        parameters.amountOfExercises,
        userId,
        isExerciseSelectionRandom,
    );

    if (
        ['Multiple-Choice', 'Random'].includes(parameters.type) &&
        parameters.multiLang !== 'Single-Language'
    ) {
        const exercisesWithMCData = getMissingDataForMCExercises(
            filteredExercises,
            sampledWordData,
            'matching-words',
            parameters.difficultyMC,
        );
        res.status(200).json(exercisesWithMCData);
    } else {
        res.status(200).json(filteredExercises);
    }
});

// ===========================================================================
// EXPORTS
// ===========================================================================

module.exports = {
    getExercises,
};
