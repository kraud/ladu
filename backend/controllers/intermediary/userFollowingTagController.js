const asyncHandler = require('express-async-handler')

const UserFollowingTag = require('../../models/intermediary/userFollowingTagModel')
const TagWord = require('../../models/intermediary/tagWordModel')

// @desc    Set userFollowingTag
// @route   POST --
// @access  Private
const createUserFollowingTag = asyncHandler(async (req, res) => {

    const userFollowTag = await UserFollowingTag.create({
        tagId: req.body.tagId,
        followerUserId: req.body.followerUserId,
    })
    res.status(200).json(userFollowTag)
})

// @desc    Set many userFollowingTag simultaneously
// @route   POST --
// @access  Private
const createManyUserFollowingTag = asyncHandler(async (req, res) => {

    const userFollowingTag = await UserFollowingTag.insertMany(req.body.userFollowingTags)
        .then(function () {
            res.status(200).json(userFollowingTag)
        }).catch(function (error) {
            console.log(error)     // Failure
            res.status(400).json(userFollowingTag)
            throw new Error("Tag-Word insertMany failed")
        });
})

// @desc    Get userFollowingTag by TagID
// @route   GET --
// @access  Private
const getAllUSerFollowingTagsRelatedToTagId = asyncHandler(async (req, res) => {
    const userFollowingTag = await UserFollowingTag.find({ tagId: req.body.tagId})
    res.status(200).json(userFollowingTag)
})

// @desc    Get userFollowingTag by userID
// @route   POST --
// @access  Private
const getAllUSerFollowingTagsRelatedToUserId = asyncHandler(async (req, res) => {
    const userFollowingTag = await UserFollowingTag.find({ wordId: req.body.wordId})
    res.status(200).json(userFollowingTag)
})

// @desc    Delete userFollowingTag
// @route   DELETE --
// @access  Private
const deleteTagWord = asyncHandler(async (req, res) => {
    const userFollowingTag = await UserFollowingTag.findById(req.params.id)

    if(!userFollowingTag){
        res.status(400)
        throw new Error("User-following-tag not found")
    }

    // Check for user
    if(!req.user){
        res.status(401)
        throw new Error('User not found')
    }

    await userFollowingTag.deleteOne()
    res.status(200).json(userFollowingTag)
})

// NB! For internal use. Not available through routes
const getWordsIdFromFollowedTagsByUserId = async (userId) => {
    return UserFollowingTag.distinct('tagId', {followerUserId: userId})
        .then((matchingTagsIdResponse) => {
            return TagWord.distinct('wordId', {tagId: {$in: matchingTagsIdResponse}})
                .then((matchingWordsIdResponse) => {
                    return(matchingWordsIdResponse)
                })
        })
}

// NB! For internal use. Not available through routes
const getTagsIdFromFollowedTagsByUserId = async (userId) => {
    return UserFollowingTag.distinct('tagId', {followerUserId: userId})
        .then((matchingTagsIdResponse) => {
            return(matchingTagsIdResponse)
        })
}

module.exports = {
    createUserFollowingTag,
    createManyUserFollowingTag,
    getAllUSerFollowingTagsRelatedToTagId,
    getAllUSerFollowingTagsRelatedToUserId,
    deleteTagWord,
    getWordsIdFromFollowedTagsByUserId,
    getTagsIdFromFollowedTagsByUserId
}