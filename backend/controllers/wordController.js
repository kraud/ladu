const asyncHandler = require('express-async-handler')

const Word = require('../models/wordModel')
const Tag = require('../models/tagModel')
const mongoose = require("mongoose");
const TagWord = require("../models/intermediary/tagWordModel");
const {getWordsIdFromFollowedTagsByUserId} = require("./intermediary/userFollowingTagController");

// @desc    Get Words
// @route   GET /api/words
// @access  Private
const getWords = asyncHandler(async (req, res) => {
    const words = await Word.find({ user: req.user.id})
    res.status(200).json(words)
})

// @desc    Get list of wordsId corresponding to a tag, followed by a user that is NOT the creator of the tag
// @route   GET --
// @access  Private
const getWordsByFollowedTag = asyncHandler(async (req, res) => {
    const matchingWordsId = await getWordsIdFromFollowedTagsByUserId(req.params.id)
    res.status(200).json(matchingWordsId)
})

// @desc    Get Words with simplified data
// @route   GET /api/words/simple
// @access  Private
const getWordsSimplified = asyncHandler(async (req, res) => {

    // adds to originalResults the words related to other-users-tags, that the current user follows.
    const matchingWordsId = await getWordsIdFromFollowedTagsByUserId(req.user.id)

    const getFilterQuery = (filter) => {
        switch(filter.type) {
            case 'gender': {
                return [
                    {
                        "translations.cases": {
                            $elemMatch: {
                                "word": {$in: filter.filterValue},
                                "caseName": {$regex: "^gender"}, // TODO: add check for other fields like "gradable" in adverb
                            }
                        }
                    },
                    { $or: [
                        {"user": mongoose.Types.ObjectId(req.user.id)},
                        {"_id": {$in: matchingWordsId}}
                    ]}
                ]
            }
            // **** NB! This is not being used! ****
            // We currently use an alternative workaround filtering by tagsId in TagWord
            // A query like this, implemented in pipeline would be a better solution.
            case 'tag': {
                // NB! in this case, filter.tagIds for type === "tag" will be an array of strings
                // so each filter further restricts the results when included
                // TODO: restrictiveArray implementation would require check across multiple TagWord documents simultaneously (WIP)
                if(filter.restrictiveArray !== undefined && filter.restrictiveArray.length > 0){
                    return {
                        // "tags": { $all: filter.tagIds},// This would force to only get items that have all the tags in filter.value
                        user: req.user.id
                    }
                } else {
                    // NB! in this case, filter.value for type === "tag" will be a single string
                    // so each filter gives additive results when included
                    if (filter.additiveItem !== undefined) {
                        return {
                            '$expr': {
                                '$and': [
                                    // TODO: I think sending variables to be used inside a pipeline+lookup+match=etc is not supported?
                                    //  check issues:
                                    //  https://stackoverflow.com/questions/73851363/why-cant-i-use-a-variable-for-pipeline-in-a-lookup-in-an-aggregation
                                    //  and https://stackoverflow.com/questions/56671129/declaring-variables-in-mongodb-using-lookup-with-let-and-pipeline
                                    //  for more info.
                                    // {'$_id': `${mongoose.Types.ObjectId(filter.additiveItem._id)}`},
                                    // { '$eq': [ '$_id', `${filter.additiveItem._id}` ] },
                                    { '$eq': [ '$_id', '$$tagId' ] },
                                ]
                            }
                        }
                    }
                    break
                }
            }
            // **** ****
            case 'PoS': {
                return [{
                        $or: [
                            {"user": mongoose.Types.ObjectId(req.user.id)},
                            {"_id": {$in: matchingWordsId}}
                        ]
                    },
                    {"partOfSpeech": {$in: filter.filterValue}},
                ]
            }
            default: { // NO FILTER?
                return {
                    $or: [
                        {"user": mongoose.Types.ObjectId(req.user.id)},
                        {"_id": {$in: matchingWordsId}}
                    ]
                }
            }
        }
    }
    const getRequiredFieldsData = (translation, partOfSpeech) => {
        //Fields depend on Part of Speech + Language
        switch (partOfSpeech){
            case ("Noun"): {
                switch (translation.language){
                    case ("Estonian"): {
                        return({
                            dataEE: (translation.cases.find(wordCase => (wordCase.caseName === 'singularNimetavEE'))).word,
                        })
                    }
                    case ("English"): {
                        return({
                            dataEN: (translation.cases.find(wordCase => (wordCase.caseName === 'singularEN'))).word,
                        })
                    }
                    case ("Spanish"): {
                        return({
                            genderES: (translation.cases.find(wordCase => (wordCase.caseName === 'genderES'))).word,
                            dataES: (translation.cases.find(wordCase => (wordCase.caseName === 'singularES'))).word,
                        })
                    }
                    case ("German"): {
                        return({
                            genderDE: (translation.cases.find(wordCase => (wordCase.caseName === 'genderDE'))).word,
                            dataDE: (translation.cases.find(wordCase => (wordCase.caseName === 'singularNominativDE'))).word,
                        })
                    }
                    default: {
                        res.status(400)
                        throw new Error("Language not found for this part of speech (Noun)")
                    }
                }
            }
            case ("Adverb"): {
                switch (translation.language){
                    case ("English"): {
                        return({
                            dataEN: (translation.cases.find(wordCase => (wordCase.caseName === 'adverbEN'))).word,
                        })
                    }
                    case ("Spanish"): {
                        return({
                            dataES: (translation.cases.find(wordCase => (wordCase.caseName === 'adverbES'))).word,
                        })
                    }
                    case ("German"): {
                        return({
                            dataDE: (translation.cases.find(wordCase => (wordCase.caseName === 'adverbDE'))).word,
                        })
                    }

                    default: {
                        res.status(400)
                        throw new Error("Language not found for this part of speech (Adverb)")
                    }
                }
            }
            case ("Adjective"): {
                switch (translation.language){
                    case ("English"): {
                        return({
                            dataEN: (translation.cases.find(wordCase => (wordCase.caseName === 'positiveEN'))).word,
                        })
                    }
                    case ("Spanish"): {
                        return(((translation.cases.find(wordCase => (wordCase.caseName === 'maleSingularES'))) !== undefined)
                            ?
                                ({
                                    dataES: (translation.cases.find(wordCase => (wordCase.caseName === 'maleSingularES'))).word,
                            })
                            :
                                ({
                                    dataES: (translation.cases.find(wordCase => (wordCase.caseName === 'neutralSingularES'))).word,
                            })
                        )
                    }
                    case ("German"): {
                        return({
                            dataDE: (translation.cases.find(wordCase => (wordCase.caseName === 'positiveDE'))).word,
                        })
                    }
                    case ("Estonian"): {
                        return({
                            dataEE: (translation.cases.find(wordCase => (wordCase.caseName === 'algvorreEE'))).word,
                        })
                    }
                    default: {
                        res.status(400)
                        throw new Error("Language not found for this part of speech (Adjective)")
                    }
                }
            }
            case ("Verb"): {
                switch (translation.language){
                    case ("English"): {
                        return({
                            dataEN: (translation.cases.find(wordCase => (wordCase.caseName === 'simplePresent1sEN'))).word,
                        })
                    }
                    case ("Spanish"): {
                        return({
                            dataES: (translation.cases.find(wordCase => (wordCase.caseName === 'infinitiveNonFiniteSimpleES'))).word,
                        })
                    }
                    case ("Estonian"): {
                        return({
                            dataEE: (translation.cases.find(wordCase => (wordCase.caseName === 'infinitiveMaEE'))).word,
                        })
                    }
                    case ("German"): {
                        return({
                            dataDE: (translation.cases.find(wordCase => (wordCase.caseName === 'infinitiveDE'))).word,
                        })
                    }
                    default: {
                        res.status(400)
                        throw new Error("Language not found for this part of speech (Verb)")
                    }
                }
            }
            default: {
                res.status(400)
                throw new Error("Part of speech not found")
            }
        }
    }
    const getFieldName = (language) => {
        switch(language){
            case 'Estonian': {
                return("registeredCasesEE")
            }
            case 'English': {
                return("registeredCasesEN")
            }
            case 'Spanish': {
                return("registeredCasesES")
            }
            case 'German': {
                return("registeredCasesDE")
            }
        }
    }

    const filters = (req.query.filters !== undefined) ?req.query.filters :[]

    // all filters of the same type must be merged into 1 filter, to avoid multiple requests to collection for each type
    let newSortedFilters = []
    filters.forEach((rawFilter) => {
        // there might be multiple gender/PoS/etc. filters in a single request,
        // and we must merge them together with their kind, so we have only 1 filter for each type
        let matchingFilterIndex = newSortedFilters.findIndex(sortedFilter => sortedFilter.type === rawFilter.type)
        // if there is no match inside the sorted filters, we add this one to the array
        if(matchingFilterIndex === -1){
            if(rawFilter.type === 'tag'){ // there will always be only 1 tag filter at a time
                newSortedFilters.push({
                    type: rawFilter.type,
                    filterValue: rawFilter.restrictiveArray // TODO: review tag-type filter and rename property
                })
            } else {
                newSortedFilters.push({
                    // other filter-related data will not be necessary
                    type: rawFilter.type,
                    filterValue: [rawFilter.filterValue]
                })
            }
        } else { // if there is already a filter for that type, we modify it to include
            let updatedFilter = {
                ...newSortedFilters[matchingFilterIndex],
                filterValue: [...newSortedFilters[matchingFilterIndex].filterValue, rawFilter.filterValue]
            }
            newSortedFilters.splice(matchingFilterIndex, 1)
            newSortedFilters = [...newSortedFilters, updatedFilter]
        }
    })
    let originalResults = []

    if(newSortedFilters.length > 0){
        for (const filter of newSortedFilters) {
            const request = {
                query: {
                    $or: [
                        {"user": req.user.id},
                        {"_id": {$in: matchingWordsId}}
                    ]
                }
            }
            if(filter.type === 'tag'){
               const otherAux = await getWordsByTagFiltering(
                    filter.filterValue
                ).then(response => {
                    originalResults.push({
                        type: filter.type,
                        searchResults: response
                    })
                })
            } else {
                // this should work for type 'gender' and 'PoS'.
                const wordWithTagData = await getWordDataByRequest(
                    request, // this will always be ignored if there's a (non-tag) filter, like in this case
                    getFilterQuery(filter)
                )
                originalResults.push({
                    type: filter.type,
                    searchResults: wordWithTagData
                })
            }
        }
    } else {
        const request = [
            {
                $or: [
                    {"user": mongoose.Types.ObjectId(req.user.id)},
                    {"_id": {$in: matchingWordsId}}
                ]
            }
        ]
        // NB! request is not a simple filter by fields, since it must also match 'matchingWordsId',
        //  so we use the force-request parameter in getWordDataByRequest
        const wordWithTagData = await getWordDataByRequest(undefined, request)
        originalResults.push({
            type: 'none',
            searchResults: wordWithTagData
        })
    }

    let wordsSimplified = []
    // we merge all the items with the same "type" into the same array
    let groupedResults = []
    let processedResults = []
    // if no filters => single array results will be spread
    if((originalResults.length === 1) && (originalResults[0].type === 'none')){
        processedResults = (originalResults[0].searchResults)
    } else {
        originalResults.forEach((originalResult) => {
            // first item will be added directly
            if(groupedResults.length === 0){
                groupedResults.push({
                    type: originalResult.type,
                    queryResults: originalResult.searchResults
                })
            } else {
                // if there is at least 1 item already on the list, we must check if the current queryResult's type is already added
                groupedResults.forEach((groupedResult, indexGrouped) => {
                    // if so, add this queryResult queryResults into that groupedResults item
                    if(originalResult.type === groupedResult.type){
                        groupedResults[indexGrouped] = {
                            ...groupedResult, // we keep the other fields (type and potentially others) as they were
                            queryResults: [
                                // potentially duplicated items between the 2 lists => will be filtered later
                                ...(groupedResult.queryResults),
                                ...(originalResult.searchResults),
                            ]
                        }
                    } else {
                        // if not AND this is the end of the groupedResults array
                        if(indexGrouped === (groupedResults.length-1)){
                            // then we add it to the groupedResults array at the end
                            groupedResults.push({
                                // indexQuery will always be 0 for this case?
                                type: originalResult.type, // TODO: no need for index here?
                                queryResults: originalResult.searchResults
                            })
                        }
                    }
                })
            }
        })
        // filter each type again to only include unique results
        let uniqueResults = groupedResults.map((groupedResult) => {
            let seen = new Set()
            const uniqueItems = groupedResult.queryResults.filter((groupedResult) => {
                const duplicate = seen.has((groupedResult._id).toString())
                seen.add((groupedResult._id).toString())
                return(!duplicate)
            })
            // we only return the result lists, since the filter type is not relevant anymore
            return(uniqueItems)
        })
        // we filter and spread uniqueResults, so it ONLY includes results present in all the arrays?
        // if only 1 type => no need to check overlap, we simply return list
        if(uniqueResults.length === 1) {
            processedResults = [...(uniqueResults[0])]
        } else if(uniqueResults.length > 1) {
            // if 2 or more => we check for all the overlapping ids
            let allIds = uniqueResults.map((uniqueItem, index) => {
                return(
                    uniqueItem.map((item) => {
                        return ((item._id).toString())
                    })
                )
            })
            const finalIds = (allIds[0]).filter(wordId => allIds.every(typeArray => typeArray.includes(wordId)))
            let checked = new Set()
            uniqueResults.forEach((uniqueItem) => {
                uniqueItem.forEach((item) => {
                    if (
                        (finalIds.includes((item._id).toString())) &&
                        !(checked.has((item._id).toString()))
                    ) {
                        checked.add((item._id).toString())
                        processedResults.push(item)
                    }
                })
            })
        }
    }
    const partsOfSpeech = new Set()
    // Filtering complete => setting up format to be displayed on table
    if((processedResults !== undefined) && (processedResults.length > 0)){
        processedResults.forEach((completeWord) => {
            const storedLanguages = new Set()
            // we must go through all the languages listed on "translations" and create simplified versions of each
            let simplifiedWord = {
                tags: completeWord.tags,
                partOfSpeech: completeWord.partOfSpeech,
                createdAt: completeWord.createdAt,
                updatedAt: completeWord.updatedAt,
                id: completeWord._id,
                user: completeWord.user,
            }
            partsOfSpeech.add(completeWord.partOfSpeech)
            // from each translated language, we only retrieve the necessary data
            completeWord.translations.forEach((translation) => {
                storedLanguages.add(translation.language)
                simplifiedWord = {
                    ...simplifiedWord,
                    ...(getRequiredFieldsData(translation, completeWord.partOfSpeech)),
                    [getFieldName(translation.language)]: translation.cases.length
                }
            })
            const simplifiedWordWithLanguages = {
                ...simplifiedWord,
                storedLanguages: Array.from(storedLanguages)
            }
            wordsSimplified.push(simplifiedWordWithLanguages)
        })
    }
    const result = {
        amount: wordsSimplified.length, // the total amount of words saved for this user
        partsOfSpeechIncluded: Array.from(partsOfSpeech),
        words: wordsSimplified // the data corresponding to those words, reduced to only the most necessary fields
    }
    res.status(200).json(result)
})

// @desc    Get Words
// @route   GET /api/words
// @access  Private
const getWordById = asyncHandler(async (req, res) => {
    const word = await Word.aggregate([
        // filtering related to data present in word => apply here
        {
            $match: {
                $and:[
                    // filter the Word to match the requested id
                    {"_id": mongoose.Types.ObjectId(req.params.id)},
                    // NB! this was changed, to accommodate follow-tag logic.
                    // Might eventually need to be refactored into an optional parameter
                    // {"user": mongoose.Types.ObjectId(req.user.id)}, // Make sure the logged-in user matches the word user
                ]
            }
        },
        // filtering related to data present in tagWord => apply here
        { '$lookup': {
            'from': TagWord.collection.name,
            'let': { 'wordAuthor': '$user' }, // from Word
            'pipeline': [
                {
                    '$match': {
                        '$and': [
                            {'$expr': {'$eq': ['$wordId', mongoose.Types.ObjectId(req.params.id)]}}, // wordId from Word,
                        ]
                    }
                },
                { '$lookup': {
                    'from': Tag.collection.name,
                    'let': { 'tagId': '$tagId' }, // from TagWord
                    'pipeline': [
                        { '$match': {
                                '$expr': { '$eq': [ '$_id', '$$tagId' ] }
                            }}
                    ],
                    'as': 'tags'
                }},
                { '$unwind': '$tags' },
                { '$replaceRoot': { 'newRoot': '$tags' } }
            ],
            'as': 'tags'
        }}
    ])

    if(!word[0]){
        res.status(400)
        throw new Error("Word not found")
    }

    // Check for user
    if(!req.user){
        res.status(401)
        throw new Error('User not found')
    }

    res.status(200).json(word[0])
})

// @desc    Set Word
// @route   POST /api/words
// @access  Private
const setWord = asyncHandler(async (req, res) => {
    if(!req.body.partOfSpeech){
        res.status(400)
        throw new Error("Please add part of speech")
    }
    if(!req.body.translations || req.body.translations.length < 2){
        res.status(400)
        throw new Error("Please add 2 or more translations")
    }
    Word.create({
        partOfSpeech: req.body.partOfSpeech,
        translations: req.body.translations, // TranslationItem array
        clue: req.body.clue,
        user: req.user.id
    })
        .then(newWordData => {
            if((req.body.tags !== undefined) && (req.body.tags.length >0)){
                const tagWordsItems = req.body.tags.map((tagItem) => {
                    return ({
                        tagId: tagItem._id,
                        wordId: (newWordData._id).toString(),
                    })
                })
                TagWord.insertMany(tagWordsItems)
                    .then((returnNewTagWordData) => {
                        res.status(200).json({
                            ...newWordData.toObject(),
                            tagWords: req.body.tags,
                        })
                    })
                    .catch((error) => {
                        res.status(400).json(error)
                        throw new Error("Tag-Word insertMany failed")
                    })
            }  else {
                res.status(200).json({
                    ...newWordData.toObject(),
                    tagWords: [],
                })
            }
        })
        .catch((error) => {
            res.status(400).json(error)
            throw new Error("Tag-Word insertMany failed")
        })
})

// @desc    Update Word
// @route   PUT /api/words/:id
// @access  Private
const updateWord = asyncHandler(async (req, res) => {
    const word = await Word.findById(req.params.id)

    if(!word){
        res.status(400)
        throw new Error("Word not found")
    }

    // Check for user
    if(!req.user){
        res.status(401)
        throw new Error('User not found')
    }

    // Make sure the logged-in user matches the word user
    if(word.user.toString() !== req.user.id){
        res.status(401)
        throw new Error('User not authorized')
    }

    // once updating TagWord is done we update the info inside Word
    const updatedDataToStore = {
        user: req.body.user,
        partOfSpeech: req.body.partOfSpeech,
        translations: req.body.translations,
        clue: req.body.clue,
    }

    // iterate over tags and check for new tag-word relationships => create/remove tagWord documents accordingly
    // if in tags there are tags associated with this word, we must check if they are the same as currently stored in TagWord
    // if tags is empty we must check if there are TagWords stored related to this word and delete them.
    // For this, we first retrieve the currently stored list of tags related to this word
    const updatedTagsList = (req.body.tags !== undefined)
        ? (req.body.tags).map((tagFullData) => {
            return((tagFullData._id).toString()) // TODO: check if toString can be removed
        }) // all tagsIds. Some might be new, all might already be stored, or it could be missing some previously stored.
        : []
    const request = {
        query: {
            id: req.params.id // id for the current Word
        }
    }

    getWordDataByRequest(request) // req.query should have id (for the tag)
        // only 1 possible tag with the id inside query => wordWithTagData will be an array of 1 item
        .then(async (wordWithTagData) => {
            // inside wordWithTagData[0] there is property called 'tags', with a list of Tag elements (check interface in FE)
            const wordStoredTagsId = wordWithTagData[0].tags.map((tag) => {
                return((tag._id).toString())
            })
            let tagsToBeRemoved = []
            wordStoredTagsId.forEach((storedTagId) => {
                if(!(updatedTagsList.includes(storedTagId))){
                    tagsToBeRemoved.push(storedTagId)
                }  // if updatedTagsList DOES include storedWordId => we don't need to save it again
            })
            let tagsToBeAdded = []
            updatedTagsList.forEach((updatedTagId) => {
                if(!(wordStoredTagsId.includes(updatedTagId))){
                    tagsToBeAdded.push(updatedTagId)
                }  // if wordStoredTagsId DOES include updatedTagId => we don't need to save it again
            })

            // FIRST ELEMENT ALWAYS IS THE TAGS TO BE DELETED
            // SECOND ELEMENT ALWAYS IS THE TAGS TO BE ADDED
            const rawModificationLIst = [tagsToBeRemoved, tagsToBeAdded] // some (or both) items in the array might still be an empty array itself
            const modificationsList = [] // we will store here only the modificationsArrays that have elements inside them
            rawModificationLIst.forEach((arrayWithModifications) => {
                if(arrayWithModifications.length > 0){
                    modificationsList.push(arrayWithModifications)
                } else {
                    modificationsList.push(null)
                }
            })
            // Promise.all should allow for parallel asynchronous request to be made and once all are done, it will continue
            if((modificationsList[0] !== null) || modificationsList[1] !== null){
                Promise.all(modificationsList.map(async (listOfChanges, index) => {
                    if(listOfChanges !== null) {
                        switch(index) {
                            // FIRST ELEMENT IN modificationsList IS ALWAYS THE WORDS TO BE DELETED
                            case 0: {
                                // we call TagWord to remove all items that match current TagId+(an item from wordsToBeRemoved)
                                const removeQuery = {
                                    $and: [
                                        {wordId: req.params.id},
                                        {tagId: {$in: listOfChanges}}
                                    ]
                                }
                                return TagWord.deleteMany(removeQuery)
                            }
                            // SECOND ELEMENT IN modificationsList IS ALWAYS THE WORDS TO BE ADDED
                            case 1: {
                                // we call TagWord to add all items from (tagsToBeRemoved)+WordId
                                const wordTagsItems = listOfChanges.map((tagId) => {
                                    return ({
                                        wordId: req.params.id,
                                        tagId: tagId,
                                    })
                                })
                                return TagWord.insertMany(wordTagsItems)
                            }
                            default: {
                                return // no possible case where array will be longer than 2 elements
                            }
                        }
                    }
                })).then(async (completeModificationsResponse) => {
                    Word.findByIdAndUpdate(req.params.id, updatedDataToStore, {new: true})
                        .then((updatedWord) => {
                            const updatedDataWithTagsFullData = {
                                // updateTag returned by findByIdAndUpdate includes a lot of data used for debugging (?)
                                // Using toObject() we can access only the data we're interested in
                                ...updatedWord.toObject(),
                                // this is not stored alongside Tag data. So we add it here so return data matches what came in request body
                                tags: req.body.tags
                            }
                            res.status(200).json(updatedDataWithTagsFullData)
                        })
                })
            } else {
                // no changes needed for stored tags related to this word
                // NB! this needs to be repeated here because inside IF it runs inside 'then', after updating TagWord
                const updatedWord = await Word.findByIdAndUpdate(req.params.id, updatedDataToStore, {new: true})
                res.status(200).json(updatedWord)
            }
        })
})

// @desc    Delete Words
// @route   DELETE /api/words/:id
// @access  Private
const deleteWord = asyncHandler(async (req, res) => {
    const word = await Word.findById(req.params.id)

    if(!word){
        res.status(400)
        throw new Error("Word not found")
    }

    // Check for user
    if(!req.user){
        res.status(401)
        throw new Error('User not found')
    }

    // Make sure the logged-in user matches the word user
    if(word.user.toString() !== req.user.id){
        res.status(401)
        throw new Error('User not authorized')
    }

    await word.deleteOne()
        .then(async (wordDeletionData) => {
            const removeQuery = {wordId: req.params.id}
            TagWord.deleteMany(removeQuery)
                .then((tagWordDeletionData) => {
                    res.status(200).json(word)
                })
                .catch(function (error) {
                    res.status(400).json(error)
                    throw new Error("Tag-Word (from word) deleteMany failed")
                })
        })
})

// @desc    Delete many Words by their Ids
// @route   DELETE /api/words/deleteMany
// @access  Private
const deleteManyWords = asyncHandler(async (req, res) => {

    // Check for user
    if(!req.user){
        res.status(401)
        throw new Error('User not found')
    }
    const wordObjectIds = req.body.wordsId.map(wordId => (mongoose.Types.ObjectId(wordId)))
    const request = {
        _id: {
            "$in": wordObjectIds
        }
    }
    Word.find(request).then((wordsToDelete) => {
        if(wordsToDelete !== undefined){
            if(wordsToDelete.length !== req.body.wordsId.length){
                res.status(400)
                throw new Error("Some words are missing")
            }
            // Make sure the logged-in user matches the word user
            let allowedToDelete = true
            wordsToDelete.forEach((wordToDelete) => {
                if((wordToDelete.user).toString() !== req.user.id){
                    allowedToDelete = false
                }
            })
            if(!allowedToDelete){
                res.status(401)
                throw new Error('User not authorized to delete at least one of the words')
            }

            Word.deleteMany(request)
                .then(async (wordDeletionData) => {
                    const removeQuery = {
                        wordId: {
                            "$in": wordObjectIds
                        }
                    }
                    TagWord.deleteMany(removeQuery)
                        .then((tagWordDeletionData) => {
                            res.status(200).json(tagWordDeletionData)
                        })
                        .catch(function (error) {
                            res.status(400).json(error)
                            throw new Error("DeleteManyWords function. Tag-Word (from word) deleteMany failed")
                        })
                })
                .catch(function (error) {
                    res.status(400).json(error)
                    throw new Error("DeleteManyWords function. Word deleteMany failed")
                })
        } else {
            res.status(400)
            throw new Error("There was an error when searching for the required words.")
        }
    })
})

// @desc    Get a list of Words that match a search query in any of its translations
// @route   Get /api/words/searchWord
// @access  Private
const filterWordByAnyTranslation = asyncHandler(async (req, res) => {
    // adds to originalResults the words related to other-users-tags, that the current user follows.
    const wordsFromFollowedTags = await getWordsIdFromFollowedTagsByUserId(req.user.id)

    if(!(req.query)){
        res.status(400)
        throw new Error("Missing search query text")
    }

    // Check for user
    if(!req.user){
        res.status(401)
        throw new Error('User not found')
    }

    await Word.find(
        {
            $and: [
                {
                    "translations.cases": {
                        $elemMatch: {
                            "word": {$regex: `${req.query.query}`, $options: "i"},
                            "caseName": {
                                $not: {$regex: "^gender", $options: "i"},
                                $not: {$regex: "^gradable", $options: "i"}
                            }, // To avoid filtering by fields that don't represent translation-data
                        }
                    }
                },
                // TODO: add conditional so we allow request to limit results to "own-words" (no followed-tag words)
                { $or: [
                    {"user": mongoose.Types.ObjectId(req.user)},
                    {"_id": {$in: wordsFromFollowedTags}}
                ]}
            ]
        }
    )
    // this will return an array of options, representing one or more translation PER word,
    // in case that more than one translation in a word matches the search query
    .then((data) => {
        if (data) {
            let simpleResults = []
            data.forEach((word) => {
                let fullWord = [] // word + language + id
                word.translations.forEach((translation) => {
                    // this should guarantee a single result per language
                    let found = false // we reset the flag state when iterating over a new language
                    translation.cases.forEach((wordCase) => {
                        if(
                            ((wordCase.word).toLowerCase()).includes((req.query.query).toLowerCase())
                            &&
                            !(wordCase.caseName.match(/^gender/i))
                            &&
                            !(wordCase.caseName.match(/^gradable/i))
                            &&
                            (!found) // TODO: change this to a specific case? to always display the "easiest" case if multiple do match
                        ){
                            fullWord.push({
                                id: word.id,
                                type: "word",
                                completeWordInfo: word,
                                // these are not redundant with completeWordInfo, since return options are BY TRANSLATION
                                language: translation.language,
                                label: wordCase.word,
                            })
                            found = true
                        }
                    })
                })
                simpleResults = [
                    ...simpleResults,
                    ...fullWord
                ]
            })
            // sort simpleResults by alphabetical order
            simpleResults.sort((a, b) => a.label.localeCompare(b.label))
            res.status(200).json(simpleResults)
        } else {
            res.status(404).json({
                text: "No matches for this search",
                error: err
            })
        }
    })
})

// @desc    Get All word+tag data
// @route   GET /api/TagWord
// @access  Private
const getWordDataByRequest = async (wordRequest, wordForceRequest) => {

    // since 'getTagDataByRequest' is not wrapped with asyncHandler, we have to manage/catch errors manually.
    try {
        const allWordData = await Word.aggregate([
            // filtering related to data present in word => apply here
            {
                $match: {
                    $and: (wordForceRequest !== undefined)
                        ? wordForceRequest // more complex request can be made to override the getMatchQuery process
                        : getMatchQuery(wordRequest.query)
                }
            },
            // filtering related to data present in tagWord => apply here
            { '$lookup': {
                'from': TagWord.collection.name,
                'let': { 'id': '$_id', 'wordAuthor': '$user' }, // from Word
                'pipeline': [
                    {'$match': {
                        '$expr': {
                            '$and': [
                                {'$eq': ['$$id', '$wordId']},  // wordId from TagWord
                            ]
                        }
                    }},
                    { '$lookup': {
                        'from': Tag.collection.name,
                        'let': { 'tagId': '$tagId' }, // from TagWord
                        'pipeline': [
                            { '$match':
                                {'$expr': { '$eq': [ '$_id', '$$tagId' ] }
                            }}
                        ],
                        'as': 'tags'
                    }},
                    { '$unwind': '$tags' },
                    { '$replaceRoot': { 'newRoot': '$tags' } }
                ],
                'as': 'tags'
            }}
        ])
        return(allWordData)
    } catch (error){
        console.log('error', error)
        throw new Error("Word auxiliary function 'getWordDataByRequest' failed")
    }
}

//  from the tag-filter, then perform word search by filtering through those wordsIds, which will return word+tag data
// NB! tagFilter for now will always be a 'restrictiveArray' type of tag-filter.
const getWordsByTagFiltering = async (tagFilters) => {

    //  When filtering by tag, first get all word-ids that have a TagWord with the tagIds
    const tagIds = tagFilters.map(tagFilter => {
        return (tagFilter._id)
    })
    // TODO: replace 'find' with 'distinct', to avoid having to filter unique items later
    const filteredWordsWithTagData = await TagWord.find(
        {
            "tagId" : {
                "$in": tagIds
            }
        },
        {
            _id: 0,
            wordId: 1,
        }
    ).then(async (tagWordResponse) => {
        // to avoid repeated ids we filter by doing: array => set => array
        const matchingWordIds = Array.from(
            new Set(
                tagWordResponse.map(item => {
                    return (item.wordId).toString()
                })
            )
        )
        try {
            const allWordData = await Word.aggregate([
                // filtering related to data present in word => apply here
                {
                    $match: {
                        _id: {
                            "$in": matchingWordIds.map(wordId =>  mongoose.Types.ObjectId(wordId))
                        }
                    }
                },
                // filtering related to data present in tagWord => apply here
                { '$lookup': {
                    'from': TagWord.collection.name,
                    'let': { 'id': '$_id', 'wordAuthor': '$user' }, // from Word
                    'pipeline': [
                        {'$match': {
                            '$expr': {
                                '$and': [
                                    {'$eq': ['$$id', '$wordId']},  // wordId from TagWord
                                ]
                            }
                        }},
                        { '$lookup': {
                            'from': Tag.collection.name,
                            'let': { 'tagId': '$tagId' }, // from TagWord
                            'pipeline': [
                                { '$match':
                                    {'$expr': { '$eq': [ '$_id', '$$tagId' ] }}
                                }
                            ],
                            'as': 'tags'
                        }},
                        { '$unwind': '$tags' },
                        { '$replaceRoot': { 'newRoot': '$tags' } }
                    ],
                    'as': 'tags'
                }}
            ])
            return allWordData
        } catch (error){
            console.log('error', error)
            throw new Error("Word auxiliary function 'getWordsByTagFiltering' failed")
        }
    })
    return filteredWordsWithTagData
}

// AUXILIARY FUNCTIONS:

const getMatchQuery = (queryData) => {
    let matchQuery = []
    if(queryData.id !== undefined){
        matchQuery.push({
            "_id": mongoose.Types.ObjectId(queryData.id)
        })
    }
    if(queryData.user !== undefined){
        matchQuery.push({
            "user": mongoose.Types.ObjectId(queryData.user)
        })
    }
    if(queryData.partOfSpeech !== undefined){
        matchQuery.push({
            "partOfSpeech": queryData.partOfSpeech
        })
    }
    if(queryData.clue !== undefined){
        matchQuery.push({
            "clue": {$regex: `${queryData.clue}`, $options: "i"},
        })
    }
    // TODO: look into other query options, like tagId(s)?
    return(matchQuery)
}

module.exports = {
    getWords,
    getWordsSimplified,
    getWordById,
    setWord,
    updateWord,
    deleteWord,
    filterWordByAnyTranslation,
    getWordDataByRequest,
    deleteManyWords,
    getWordsByFollowedTag
}