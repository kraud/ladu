const asyncHandler = require('express-async-handler')

const TagWord = require('../../models/intermediary/tagWordModel')

// @desc    Set tagWord
// @route   POST --
// @access  Private
const createTagWord = asyncHandler(async (req, res) => {

    const tagWord = await TagWord.create({
        tagId: req.body.tagId,
        wordId: req.body.wordId,
    })
    res.status(200).json(tagWord)
})

// @desc    Set many tagWord simultaneously
// @route   POST --
// @access  Private
const createManyTagWord = asyncHandler(async (req, res) => {

    const tagWords = await TagWord.insertMany(req.body.tagWords)
        .then(function () {
            res.status(200).json(tagWords)
        }).catch(function (error) {
            console.log(error)     // Failure
            res.status(400).json(tagWords)
            throw new Error("Tag-Word insertMany failed")
        });
})

// @desc    Get tagWord by TagID
// @route   GET --
// @access  Private
const getAllTagWordsRelatedToTagId = asyncHandler(async (req, res) => {
    const tagWord = await TagWord.find({ tagId: req.body.tagId})
    res.status(200).json(tagWord)
})

// @desc    Get tagWord by wordID
// @route   POST --
// @access  Private
const getAllTagWordsRelatedToWordId = asyncHandler(async (req, res) => {
    const tagWord = await TagWord.find({ wordId: req.body.wordId})
    res.status(200).json(tagWord)
})

// @desc    Delete tagWord
// @route   DELETE --
// @access  Private
const deleteTagWord = asyncHandler(async (req, res) => {
    const tagWord = await TagWord.findById(req.params.id)

    if(!tagWord){
        res.status(400)
        throw new Error("Tag-Word not found")
    }

    // Check for user
    if(!req.user){
        res.status(401)
        throw new Error('User not found')
    }

    await tagWord.deleteOne()
    res.status(200).json(tagWord)
})

module.exports = {
    createTagWord,
    getAllTagWordsRelatedToTagId,
    getAllTagWordsRelatedToWordId,
    deleteTagWord,
    createManyTagWord
}