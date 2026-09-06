var mongoose = require('mongoose');
const asyncHandler = require("express-async-handler");
const Tag = require("../models/tagModel");
const Word = require("../models/wordModel");
const WordTag = require("../models/intermediary/tagWordModel");
const TagWord = require("../models/intermediary/tagWordModel");
const Friendship = require("../models/friendshipModel");
const UserFollowingTag = require('../models/intermediary/userFollowingTagModel')
const {getTagsIdFromFollowedTagsByUserId} = require("./intermediary/userFollowingTagController");
const {queryParamToBool} = require("./userController");


// @desc    Search for tags with a regex matching (partially or fully) a request query (string) with the tag label
// @route   GET /api/tags
// @access  Private
const searchTags = asyncHandler(async (req, res) => {

    // TODO: add another parameter to ask to include FOLLOWED Tags?
    // Hotfix. includeOtherUsersTags it's a string and anything !== "" is truthy => we calculate boolean
    const includeOtherUserTags = queryParamToBool(req.query.includeOtherUsersTags)
    const includeFollowedTags = queryParamToBool(req.query.includeFollowedTags)

    // other-users-tags, that the current user follows.
    const matchingTagsId = await getTagsIdFromFollowedTagsByUserId(req.user.id)

    const getPrivateOrPublicQuery = async () => {
        if (includeOtherUserTags) { // this includes all possible types: 'private'/'public'/'friends-only'
            // all documents where userIds is an array that contains the string in "req.user.id" as one of its elements:
            const matchingQuery = await Friendship.find({
                userIds: req.user.id,
                status: 'accepted'
            }, {userIds: 1, _id: 0}).then(async (matchingFriendships) => {
                const friendUserIds = matchingFriendships.map(friendshipItem => {
                    if (friendshipItem.userIds[0] === req.user.id) {
                        return (friendshipItem.userIds[1])
                    } else {
                        return (friendshipItem.userIds[0])
                    }
                })
                return ([
                    {"label": {$regex: `${req.query.query}`, $options: "i"}},
                    {
                        $or: [
                            {author: req.user.id}, // option 1: current user is the author
                            {public: 'Public'}, // option 2: tag is public
                            { // option 3: tag is for friends only, and author is friend of current user
                                $and: [
                                    {public: 'Friends-Only'},
                                    {author: {$in: friendUserIds}}
                                ]
                            },
                            { // option 4: user currently follows this tag
                                "_id": {$in: matchingTagsId}
                            }
                        ]
                    }
                ])
            })
            return (matchingQuery)
        } else {
            return ([
                // this only includes Tag-type: 'private' and made by the current user
                {"label": {$regex: `${req.query.query}`, $options: "i"}},
                {
                    $or: [
                        {"author": mongoose.Types.ObjectId(req.user.id)},
                        // + Tags FOLLOWED by the current user
                        (includeFollowedTags) && {
                            "_id": {$in: matchingTagsId}
                        }
                    ]
                }
            ])
        }
    }
    const dynamicQuery = await getPrivateOrPublicQuery()
    // first we get all tag arrays from stored words, where at least 1 matches the query
    const tags = await getTagDataByRequest(undefined, dynamicQuery)

    // NB! search function must return SearchResult-list type data.
    let searchResultTags = tags.map(tagData => {
        return {
            id: tagData._id,
            label: tagData.label,
            type: "tag",
            completeTagInfo: tagData,
        }
    })
    searchResultTags.sort((a, b) => a.label.localeCompare(b.label))
    res.status(200).json(searchResultTags)
})

// @desc    Get all tags where user id matches author
// @route   GET /api/tags
// @access  Private
const getUserTags = asyncHandler(async (req, res) => {
    const request = {
        query: {
            author: req.user.id
        }
    }
    const tagsData = await getTagDataByRequest(request)
    res.status(200).json(tagsData)
})

// @desc    Returns the ids matching all the tags that the userId follows
// @route   GET /api/tags
// @access  Private
const getTagsFollowedByUser = asyncHandler(async (req, res) => {
    // Check for user
    if(!req.query.userId){
        res.status(401)
        throw new Error('User-query not found')
    }

    // other-users-tags, that the current user follows.
    const matchingTagsId = await getTagsIdFromFollowedTagsByUserId(req.query.userId)
    const matchingTagsFullData = await getTagDataByRequest(undefined, [{"_id": {$in: matchingTagsId}}])
    res.status(200).json(matchingTagsFullData)
})

// @desc    Get all tags where user id matches the one in the request
// @route   GET /api/tags
// @access  Private
// TODO: can be re-implemented using 'getTagDataByRequest'?
const getOtherUserTags = asyncHandler(async (req, res) => {

    const usersAreFriends = await Friendship.find({
        "userIds" : { $in : [req.query.userId, req.user.id] }
    })

    let request
    if(usersAreFriends){
        request = {
            author: req.query.otherUserId,
            public: {$in: ['Public', 'Friends-Only']}
        }
    } else {
        request = {
            author: req.query.otherUserId,
            public: 'Public'
        }
    }

    const tags = await Tag.find(request)
    res.status(200).json(tags)
})

// @desc    Get tag by tagId
// @route   GET /api/tags
// @access  Private
const getTagById = asyncHandler(async (req, res) => {
    const singleTagData = await Tag.aggregate([
        // filtering related to data present in word => apply here
        {
            $match: {
                $and:[
                    {"_id": mongoose.Types.ObjectId(req.params.id)},
                ]
            }
        },
        // filtering related to data present in tagWord => apply here
        { '$lookup': {
            'from': WordTag.collection.name,
            'let': { 'id': '$_id', 'tagAuthor': '$author' }, // from Tag
            'pipeline': [
                {'$match': {
                        '$expr': {
                            '$and': [
                                {'$eq': ['$$id', '$tagId']},  // tagId from WordTag
                            ]
                        }
                    }},
                { '$lookup': {
                        'from': Word.collection.name,
                        'let': { 'wordId': '$wordId' }, // from WordTag
                        'pipeline': [
                            { '$match': {
                                    '$expr': { '$eq': [ '$_id', '$$wordId' ] }
                                }}
                        ],
                        'as': 'words'
                    }},
                { '$unwind': '$words' },
                { '$replaceRoot': { 'newRoot': '$words' } }
            ],
            'as': 'words'
        }}
    ])
    res.status(200).json(singleTagData[0])
})

// @desc    Assigns the selected tags to all the selected words simultaneously
// @route   POST /api/tags
// @access  Private
const addTagsInBulkToWords = asyncHandler(async (req, res) => {
    // allows any tag to be selected, and we'll only add them to those words that don't have them yet
    const tagIds = req.body.newTagsToApply // string[]
    const wordsIds = req.body.selectedWords // string[]

    // For each selected Tag, we cycle through their relevant TagWord documents, and new ones from wordsIds (avoiding duplicates)
    Promise.all(tagIds.map(async (tagIdToAssign) => {
        return TagWord.find(
            {tagId: tagIdToAssign},
            {_id: 0, tagId: 0, createdAt: 0, updatedAt: 0, __v: 0} // this will only return wordId
        )
            .then(async (matchingWordsIdData) => {
                const allWordIdsRelatedToTag = matchingWordsIdData.map((wordIdData) => {
                    return((wordIdData.wordId).toString()) // toString() transforms ObjectId() to string
                })
                let tagWordsToBeCreated = []
                wordsIds.forEach((wordId) => { // some selected words might already be related to this tag, so we filter them first
                    if(!allWordIdsRelatedToTag.includes(wordId)){ // if tag already has a relation with the wordId, we don't have to create it
                        tagWordsToBeCreated.push({
                            wordId: wordId,
                            tagId: tagIdToAssign
                        })
                    }
                })
                // now we create all the missing TagWord relationships related to this tag
                return TagWord.insertMany(tagWordsToBeCreated)
            })
    })).then(async (responseFromCreatingAllNewTagWords) => {
        res.status(200).json(responseFromCreatingAllNewTagWords)
    })
})

// @desc    Creates a UserFollowingTag document related to a user and a tag whose author is a different user.
//          This gives access to that user to all the words stored in that tag.
// @route   POST /api/tags
// @access  Private
const followTag = asyncHandler(async (req, res) => {
    // Check for user
    if(!req.body.userId){
        res.status(401)
        throw new Error('User not found')
    }
    // Check for tag
    if(!req.body.tagId){
        res.status(401)
        throw new Error('Tag not found')
    }

    const userFollowingTag = await UserFollowingTag.create({
        tagId: req.body.tagId,
        followerUserId: req.body.userId,
    })
    res.status(200).json(userFollowingTag)
})

// @desc    Copies the tag and words data into this account (alongside the TagWord documents).
// @route   POST /api/tags
// @access  Private
const addExternalTag = asyncHandler(async (req, res) => {
    const tagId = req.body.tagId
    // From the tagId we get all the matching TagWord items
    TagWord.find({tagId: tagId}, {_id: 0, createdAt: 0, updatedAt: 0, __v: 0})
        .then(async (tagWordList) => {
            const tagData = await Tag.findById(tagId, {_id: 0, createdAt: 0, updatedAt: 0, __v: 0})
            // from the TagWordItems we extract all the wordIds
            const wordIdList = tagWordList.map((tagWordItem) => {
                return(tagWordItem.wordId)
            })
            // we then create the new cloned tag, from the original's data
            return await Tag.create({
                ...(tagData.toObject()),
                author: mongoose.Types.ObjectId(req.user.id) // the only change is that the tag now has a new author
            }).then(async (tagCloneData) => {
                // once the cloned tag has been created, we get all the word data by filtering through their ids.
                return await Word.find(
                    {_id: {$in: wordIdList}},
                    {_id: 0, 'translations._id': 0, createdAt: 0, updatedAt: 0, __v: 0}
                ).then(async (completeOriginalWordData) => {
                    // we then create the new cloned words, from the original's data
                    return await Word.insertMany(
                        // before inserting, we must modify the word-data so the current user is set as the creator
                        (completeOriginalWordData).map((originalWordItem) => {
                            return({
                                ...originalWordItem.toObject(),
                                user: mongoose.Types.ObjectId(req.user.id),
                                isCloned: true,
                                originalCreator: originalWordItem.toObject().id
                            })
                        })
                    ).then((newClonedWordData) => {
                        // now we create the corresponding TagWord items using the cloned Tag and Words ids.
                        const newTagWordList = newClonedWordData.map((clonedWordItem) => {
                            return({
                                wordId: (clonedWordItem.toObject())._id,
                                tagId: (tagCloneData.toObject())._id,
                            })
                        })
                        return TagWord.insertMany(newTagWordList).then((tagWordResponse) => {
                            res.status(200).json({
                                clonedTag: tagCloneData,
                                clonedWords: newClonedWordData,
                                clonedTagWords: tagWordResponse
                            })
                        })
                    })
                })
            })
        })
})

// @desc    Returns boolean. Value depends on tag's label availability for the specified user.
// @route   POST /api/tags
// @access  Private
const checkIfTagLabelAvailable = asyncHandler(async (req, res) => {
    const labelUserData = req.body

    Tag.find({
        "label": labelUserData.tagLabel,
        "author": mongoose.Types.ObjectId(labelUserData.userId),
    }).then((findResponse) => {
        let response = {
            isAvailable: true
        }
        if((findResponse.length > 0) && (findResponse[0].label === labelUserData.tagLabel)){
            response = {
                isAvailable: false,
                tagId: findResponse[0].id
            }
        }
        res.status(200).json(response)
    })
})

// @desc    Create Tag
// @route   POST /api/tags
// @access  Private
const createTag = asyncHandler(async (req, res) => {
    if(!req.body.label){
        res.status(400)
        throw new Error("Please specify label for tag")
    }
    if(!req.body.author){
        res.status(400)
        throw new Error("Missing tag author")
    }
    if(!(['Public', 'Private', 'Friends-Only'].includes(req.body.public))){
        res.status(400)
        throw new Error("Invalid public status")
    }
    Tag.create({
        author: req.body.author,
        label: req.body.label,
        public: req.body.public,
        description: req.body.description,
    })
        .then((value) => {
            if(req.body.words.length >0){
                const tagWordsItems = req.body.words.map((wordData) => {
                    return ({
                        tagId: value._id,
                        wordId: wordData._id
                    })
                })
                TagWord.insertMany(tagWordsItems)
                    .then((returnData) => {
                        res.status(200).json({
                            ...value.toObject(),
                            words: req.body.words,
                        })
                    }).catch(function (error) {
                        res.status(400).json(value)
                        throw new Error("Tag-Word insertMany failed")
                    })
            } else {
                res.status(200).json({
                    ...value,
                    words: [],
                })
            }
        })
        .catch(function (error) {
            res.status(400)
            throw new Error("Tag create failed")
        })
})

// @desc    Delete Tag
// @route   DELETE /api/tags/:id
// @access  Private
const deleteTag = asyncHandler(async (req, res) => {
    const tag = await Tag.findById(req.params.id)

    if(!tag){
        res.status(400)
        throw new Error("Tag not found")
    }

    // Check for user
    if(!req.user){
        res.status(401)
        throw new Error('User not found')
    }

    // Make sure the logged-in user matches the word user
    if(tag.author.toString() !== req.user.id){
        res.status(401)
        throw new Error('User not authorized to delete this tag (does not match author).')
    }

    tag.deleteOne()
        .then(async (tagDeletionData) => {
            const removeQuery = {tagId: req.params.id}
            TagWord.deleteMany(removeQuery)
                .then((tagWordDeletionData) => {
                    res.status(200).json(tag)
                })
                .catch(function (error) {
                    res.status(400).json(error)
                    throw new Error("Tag-Word (from tag) deleteMany failed")
                })
        })
})

// @desc    Delete userFollowingTag (unfollow tag)
// @route   DELETE /api/tags/unfollowTag/:id
// @access  Private
const deleteUserFollowingTag = asyncHandler(async (req, res) => {
    const tagId = req.params.id
    const userId = req.body.userId

    if(!tagId){
        res.status(400)
        throw new Error("Missing tag id")
    }

    // Check for user
    if(!userId){
        res.status(401)
        throw new Error('Missing user id')
    }

    const userFollowingTag = await UserFollowingTag.findOne({
        tagId: tagId,
        followerUserId: userId
    })

    const deleteResponse = await userFollowingTag.deleteOne()
    res.status(200).json(deleteResponse)
})

// @desc    Update Tag
// @route   PUT /api/tags/:id
// @access  Private
const updateTag = asyncHandler(async (req, res) => {
    const tag = await Tag.findById(req.params.id)

    if(!tag){
        res.status(400)
        throw new Error("Tag not found")
    }

    // Check for user
    if(!req.user){
        res.status(401)
        throw new Error('User not found')
    }

    // Make sure the logged-in user matches the goal user
    if(tag.author.toString() !== req.user.id){
        res.status(401)
        throw new Error('User not authorized')
    }

    // once updating TagWord is done we update the info inside Tag
    const updatedDataToStore = {
        author: req.body.author,
        label: req.body.label,
        public: req.body.public,
        description: req.body.description,
    }
    // iterate over words and check for new tag-word relationships => create/remove tagWord documents accordingly
    // if in words there are words associated with this tag, we must check if they are the same as currently stored in TagWord
    // if words is empty we must check if there are words stored related to this tag and delete them
    const updatedWordsList = (req.body.words).map((wordFullData) => {
        return((wordFullData._id).toString()) // TODO: check if toString can be removed
    }) // all wordsIds. Some might be new, all might already be stored, or it could be missing some previously stored.
    // we retrieve the currently stored list of words related to this tag
    const request = {
        query: {
            id: req.params.id // id for the current Tag
        }
    }

    getTagDataByRequest(request) // req.query should have id (for the tag)
        // only 1 possible tag with the id inside query => tagWithWordData will be an array of 1 item
        .then(async (tagWithWordData) => {
            // inside tagWithWordData[0] there is property called 'words', with a list of Word elements (check interface in FE)
            const tagStoredWordsId = tagWithWordData[0].words.map((word) => {
                return((word._id).toString())
            })
            let wordsToBeRemoved = []
            tagStoredWordsId.forEach((storedWordId) => {
                if(!(updatedWordsList.includes(storedWordId))){
                    wordsToBeRemoved.push(storedWordId)
                }  // if updatedWordsList DOES include storedWordId => we don't need to save it again
            })
            let wordsToBeAdded = []
            updatedWordsList.forEach((updatedWordId) => {
                if(!(tagStoredWordsId.includes(updatedWordId))){
                    wordsToBeAdded.push(updatedWordId)
                }  // if tagStoredWordsId DOES include updatedWordId => we don't need to save it again
            })

            // FIRST ELEMENT ALWAYS IS THE WORDS TO BE DELETED
            // SECOND ELEMENT ALWAYS IS THE WORDS TO BE ADDED
            const rawModificationLIst = [wordsToBeRemoved, wordsToBeAdded] // some (or both) items in the array might still be an empty array itself
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
                                        {tagId: req.params.id},
                                        {wordId: {$in: listOfChanges}}
                                    ]
                                }
                                return TagWord.deleteMany(removeQuery)
                            }
                            // SECOND ELEMENT IN modificationsList IS ALWAYS THE WORDS TO BE ADDED
                            case 1: {
                                // we call TagWord to add all items from (wordsToBeRemoved)+TagId
                                const tagWordsItems = listOfChanges.map((wordId) => {
                                    return ({
                                        tagId: req.params.id,
                                        wordId: wordId,
                                    })
                                })
                                return TagWord.insertMany(tagWordsItems)
                            }
                            default: {
                                return // no possible case where array will be longer than 2 elements
                            }
                        }
                    }
                })).then(async (completeModificationsResponse) => {
                    Tag.findByIdAndUpdate(req.params.id, updatedDataToStore, {new: true})
                        .then((updatedTag) => {
                            const updatedDataWithWordsFullData = {
                                // updateTag returned by findByIdAndUpdate includes a lot of data used for debugging (?)
                                // Using toObject() we can access only the data we're interested in
                                ...updatedTag.toObject(),
                                // this is not stored alongside Tag data. So we add it here so return data matches what came in request body
                                words: req.body.words
                            }
                            res.status(200).json(updatedDataWithWordsFullData)
                    })
                })
            } else {
                // no changes needed for stored words related to this tag
                // NB! this needs to be repeated here because inside IF it runs inside 'then', after updating TagWord
                const updatedTag = await Tag.findByIdAndUpdate(req.params.id, updatedDataToStore, {new: true})
                res.status(200).json(updatedTag)
            }
        })
})

// @desc    Get Amount of items for a Tags
// @route   GET /api/tagsAmount
// @access  Private
const getAmountByTag = asyncHandler(async (req, res) => {
    const tag = await Tag.findById(req.params.id)

    if(!tag){
        res.status(400)
        throw new Error("Tag ID does not match any existing tag.")
    }
    if(!(tag.wordsId)){
        res.status(400)
        throw new Error("Tag ID does not have words associated to it.")
    }
    res.status(200).json(tag.wordsId.length)
})

// @desc    Get tag data + words, and request can specify fields to filter Tag by
// @route   GET --
// @access  Private
// TODO: remove from tagRoutes? This is an internal-use function now
const getTagDataByRequest = async (req, tagForceRequest) => {
    // req.body might allow filtering tag by: id, author, label, description, public
    const getMatchQuery = (queryData) => {
        let matchQuery = []
        if(queryData.id !== undefined){
            matchQuery.push({
                "_id": mongoose.Types.ObjectId(queryData.id)
            })
        }
        if(queryData.author !== undefined){
            matchQuery.push({
                "author": mongoose.Types.ObjectId(queryData.author)
            })
        }
        if(queryData.label !== undefined){
            matchQuery.push({
                "label": {$regex: `${queryData.label}`, $options: "i"},
            })
        }
        if(queryData.description !== undefined){
            matchQuery.push({
                "description": {$regex: `${queryData.description}`, $options: "i"},
            })
        }
        // NB! this only applies for public === 'Public'
        // For public === 'Friends-Only' => create new type and force this case to include 'FriendsId' list
        // to also include it inside matchQuery item
        if(queryData.public !== undefined){
            matchQuery.push({
                "public": queryData.public
            })
        }
        // TODO: look into other query options, like wordId(s)?
        return(matchQuery)
    }

    // since 'getTagDataByRequest' is not wrapped with asyncHandler, we have to manage/catch errors manually.
    try {
        const allTagData = await Tag.aggregate([
            // filtering related to data present in word => apply here
            {
                $match: {
                    $and: (tagForceRequest !== undefined)
                        ? tagForceRequest // more complex request can be made to override the getMatchQuery process
                        : getMatchQuery(req.query)
                }
            },
            // filtering related to data present in tagWord => apply here
            { '$lookup': {
                'from': WordTag.collection.name,
                'let': { 'id': '$_id', 'tagAuthor': '$author' }, // from Tag
                'pipeline': [
                    {'$match': {
                        '$expr': {
                            '$and': [
                                {'$eq': ['$$id', '$tagId']},  // tagId from WordTag
                            ]
                        }
                    }},
                    { '$lookup': {
                        'from': Word.collection.name,
                        'let': { 'wordId': '$wordId' }, // from WordTag
                        'pipeline': [
                            { '$match': {
                                    '$expr': { '$eq': [ '$_id', '$$wordId' ] }
                                }}
                        ],
                        'as': 'words'
                    }},
                    { '$unwind': '$words' },
                    { '$replaceRoot': { 'newRoot': '$words' } }
                ],
                'as': 'words'
            }}
        ])
        return(allTagData)
    } catch (error){
        throw new Error("Tag auxiliary function 'getTagDataByRequest' failed")
    }
}

module.exports = {
    searchTags,
    getUserTags,
    getTagById,
    createTag,
    deleteTag,
    updateTag,
    getAmountByTag,
    getOtherUserTags,
    getTagDataByRequest,
    addExternalTag,
    checkIfTagLabelAvailable,
    addTagsInBulkToWords,
    followTag,
    getTagsFollowedByUser,
    deleteUserFollowingTag
}