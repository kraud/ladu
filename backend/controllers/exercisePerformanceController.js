const asyncHandler = require('express-async-handler')
const mongoose= require("mongoose")
const ExercisePerformance = require('../models/exercisePerformanceModel')

/**
 *
 * @param userId String with user _id
 * @param word Word model "instance"
 */
const getPerformanceByWorId = async (userId, word) => {
    // Array de ExercisePerformance
    let wordObjectId = word._id
    let userObjectId =  mongoose.Types.ObjectId(userId)
    return ExercisePerformance.find({user: userObjectId, word: wordObjectId})
        .then(async performances => {
            return performances; // Procesar el resultado aquí si se necesita
        });
}


// @desc    Set Word
// @route   POST /api/saveExerciseResult
// @access  Private
const saveTranslationPerformance = asyncHandler(async (req, res) => {

    // Body del servicio:
    // performanceId: req.performanceId
    // Si tenemos performanceId => buscamos y actualizamos de acuerdo al resultado actual.
    // Sino => creamos nuevo:
    // user: req.user
    // translationId: req.translationId
    // word: req.word
    // caseName: req.case
    // record: true/false
    // lastDate: today

    let filtros = {}
    if (req.body.performanceId !== undefined) {
      filtros = {
          _id: new mongoose.Types.ObjectId(req.body.performanceId),
      }
    } else {
        filtros = {
            // wordId no es mas necesario ya que se arregló clonado de tags. translationId es unico
            translationId: req.body.translationId,
            user: req.user._id,
        }
    }

    const exercisePerformanceResult = await ExercisePerformance.find(filtros)
    const exercisePerformance = exercisePerformanceResult[0]

    if(exercisePerformance === undefined){ // no performance stored for this translation => we create it
        const knowledge = calculateNewPercentageOfKnowledge(0,[req.body.record])

        const exercisePerformance = await ExercisePerformance.create({
            user: req.user._id,
            translationId: req.body.translationId,
            translationLanguage: req.body.translationLanguage,
            word: req.body.word, //<= ObjectId
            statsByCase: [{
                caseName: req.body.caseName,
                record: [req.body.record],
                lastDate: new Date(),
                knowledge: knowledge
            }],
            averageTranslationKnowledge: knowledge, // only one value for now, so average translation is the same as current case
            lastDateModifiedTranslation: new Date() // always current date
        })
        return res.status(200).json(exercisePerformance)
    } else {
        //updating existing performance
        let statByCaseName = exercisePerformance.statsByCase.find(stat => stat.caseName === req.body.caseName);
        if (statByCaseName) {
            if (statByCaseName.record.length === 4) {
                statByCaseName.record.splice(0, 1) //deletes oldest record
                statByCaseName.record.push(req.body.record)
            } else {
                statByCaseName.record.push(req.body.record)
            }
            statByCaseName.knowledge = calculateNewPercentageOfKnowledge(statByCaseName.knowledge, statByCaseName.record)
            statByCaseName.lastDate = new Date()
        } else {
            statByCaseName = {
                caseName: req.body.caseName,
                record: [req.body.record],
                lastDate: new Date(),
                knowledge: calculateNewPercentageOfKnowledge(0,[req.body.record])
            }
            exercisePerformance.statsByCase.push(statByCaseName)
        }
        // after modifying the existing case inside the translation, we must also update the translation-average knowledge
        let newTranslationAverage = 0
        exercisePerformance.statsByCase.forEach((caseStat) => {
            // we age the values to be averaged, because we want the average to be representative of the status
            // of the whole translation at the time of the last update/set of a translation-case
            newTranslationAverage += calculateAging(caseStat.knowledge, caseStat.lastDate)
        })
        newTranslationAverage = newTranslationAverage/(exercisePerformance.statsByCase.length)
        exercisePerformance.averageTranslationKnowledge = newTranslationAverage // we take the average-aged knowledge of each stored case
        exercisePerformance.lastDateModifiedTranslation =  new Date()

        const reviseCounterThreshold = 5

        // When aswering correctly we check if modifier is Revise. If value reaches threshold modifier is removed
        if (req.body.record && exercisePerformance.performanceModifier === "Revise") {
            const newReviseCounter = exercisePerformance.reviseCounter + 1
            if (newReviseCounter >= reviseCounterThreshold) {
                exercisePerformance.performanceModifier = undefined
                exercisePerformance.reviseCounter = 0
            } else {
                exercisePerformance.reviseCounter = newReviseCounter
            }
        }

        try{
            exercisePerformance.save()
            return res.status(200).json(exercisePerformance)
        } catch (error){
            console.log(error)
            return res.status(500).json(error)
        }
    }
})


const savePerformanceAction = asyncHandler(async (req, res) => {
    // Body del servicio:
    // performanceId: req.performanceId
    // action: "forget" | "master"  => acción a realizar sobre la performance.

    if (req.body.performanceId === undefined) {
        return res.status(500).json("Performance not found")
    }

    const exercisePerformance = await ExercisePerformance.findOne({_id: new mongoose.Types.ObjectId(req.body.performanceId)})

    if (exercisePerformance === undefined){
        return res.status(500).json("Performance not found")
    }

    let modifier = undefined

    if (req.body.action !== undefined) {
        modifier = (req.body.action === "master") ? "Mastered" : "Revise"
    }

    try {
        exercisePerformance.performanceModifier = modifier
        exercisePerformance.reviseCounter = 0
        exercisePerformance.save()
        return res.status(200).json(exercisePerformance)
    } catch (error) {
        console.log(error)
        return res.status(500).json(error)
    }
})

//Function to calculate the aging of the actual percentage of knowledge.
//percentageOfKnowledge is the current percentage and lastDate must be a Date.
const calculateAging = (percentageOfKnowledge, lastDate) => {
    const currentDate = new Date();
    const difOfDays = Math.floor((currentDate - lastDate)/ (1000 * 60 * 60 * 24));
    return percentageOfKnowledge * Math.exp((-0.01 * difOfDays))
}

//Function to calculate the new percentage of knowledge after making an exercise.
//arrayResults have the new result and previousPercentageOfKnowledge is after to aging.
function calculateNewPercentageOfKnowledge(previousPercentageOfKnowledge, arrayResults){
    if(arrayResults.length > 0){
        const averageOfArray = (arrayResults.filter(Boolean).length / 4) * 100;
        if(previousPercentageOfKnowledge > 0){
            return ((0.5 * previousPercentageOfKnowledge ) + (3.5 * averageOfArray))/4
        }
        else{
            return averageOfArray
        }
    }
    return previousPercentageOfKnowledge
}

/**
 * Given an array of exercises for a Word, maps each exercise with it's exercisePerformance (matching translation and caseName) and knowledge.
 *
 * knowledge (o caseMatchingStats.knowledge) se refiere al conocimiento que se tiene espcíficamente de la traducción **Y** el caseName
 * @param word
 * @param translationsPerformanceArray
 */
const findMatches = (word, translationsPerformanceArray) => {
    return word.exercises
        .map(exercise => {
            const itemB = exercise.matchingTranslations.itemB;
            if (itemB && itemB.translationId && (translationsPerformanceArray !== undefined) && (translationsPerformanceArray.length > 0)) {
                let isMastered = false
                let isRevise = false
                // stat is object of ExercisePerformance
                const stat = translationsPerformanceArray.find((translationPerformanceCandidate) => {
                    if (translationPerformanceCandidate.translationId.toString() === itemB.translationId.toString()) {
                        if (translationPerformanceCandidate.performanceModifier !== undefined) {
                            isMastered = (translationPerformanceCandidate.performanceModifier === 'Mastered')
                            isRevise = (translationPerformanceCandidate.performanceModifier === 'Revise')
                        }
                        // this is the relevant translationPerformance data for this exercise
                        return true;
                    }
                    return false;
                })
                if (stat && !isMastered && !isRevise) {
                    // Filter statsByCase, to find one that matches with the one in itemB
                    const caseMatchingStats = stat.statsByCase.find(statCase => statCase.caseName === itemB.case);
                    if(caseMatchingStats){
                        // TODO: define a better name for the 'knowledge' property. It reflects the knowledge of a specific case in a translation, which is part of a word.
                        //  We need to avoid confusing it with average-knowledge related to translations and/or words
                        const newKnowledge = calculateAging(caseMatchingStats.knowledge, caseMatchingStats.lastDate)
                        return {...exercise, knowledge: newKnowledge, performance: stat, wordId: word._id}
                    }
                    // There's an exercisePerformance for the given translation but not for the caseName => knowledge = 0
                    return {...exercise, knowledge: 0, performance: stat, wordId: word._id }
                }
                else {
                    // translation has a modifier
                    if(isMastered || isRevise) {
                        if(isMastered){
                            return {...exercise, knowledge: 100, performance: stat, wordId: word._id}
                        } else if(isRevise) {
                            return {...exercise, knowledge: 0, performance: stat, wordId: word._id}
                        }
                    }
                }
            }
            return {...exercise, knowledge:0, performance: undefined, wordId: word._id};
        })
        .filter(result => result !== null).flat();
}
module.exports = {
    getPerformanceByWorId,
    saveTranslationPerformance,
    savePerformanceAction,
    calculateAging,
    calculateNewPercentageOfKnowledge,
    findMatches,
}