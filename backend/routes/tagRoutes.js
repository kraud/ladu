const express = require('express')
const router = express.Router()
const {
    listTags, getTagById,
    createTag, updateTag, deleteTag,
    followTag, unfollowTag,
    linkTagsToWords, unlinkTagsFromWords,
    addExternalTag, shareTag,
} = require('../controllers/tagController.ts')
const {protect} = require('../middleware/authMiddleware.ts')

// Literal-segment routes before the `/:id` family, so `/links` etc. can
// never be swallowed by a param route.
router.get('/', protect, listTags)
router.post('/', protect, createTag)
router.post('/links', protect, linkTagsToWords)
router.post('/links/remove', protect, unlinkTagsFromWords)
router.post('/addExternalTag', protect, addExternalTag) // Clones a tag and its words — Slice 3 rebuilds this (phase-4-tags.md)

router.get('/:id', protect, getTagById)
router.patch('/:id', protect, updateTag)
router.delete('/:id', protect, deleteTag)
router.post('/:id/follow', protect, followTag)
router.delete('/:id/follow', protect, unfollowTag)
router.post('/:id/share', protect, shareTag)

module.exports = router
