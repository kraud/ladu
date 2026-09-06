const express = require('express')
const router = express.Router()
const {
    searchTags, getUserTags, getTagById,
    createTag, deleteTag, updateTag,
    getAmountByTag, getOtherUserTags, getTagDataByRequest,
    addExternalTag, checkIfTagLabelAvailable,
    addTagsInBulkToWords, followTag, getTagsFollowedByUser,
    deleteUserFollowingTag
} = require('../controllers/tagController.ts')
const {protect} = require('../middleware/authMiddleware.ts')

router.get('/getTags', protect, getUserTags)
router.get('/getOtherUserTags', protect, getOtherUserTags)
router.get('/getFollowedTagsIdByUserId', protect, getTagsFollowedByUser)
router.get('/searchTags', protect, searchTags)
router.get('/filterTags', protect, getTagDataByRequest) // TODO: this should be removed? Double check
router.get('/:id', protect, getTagById)
router.post('/addExternalTag', protect, addExternalTag )//Clones a tag and it's words
router.post('/followTag', protect, followTag)
router.post('/addTagInBulkToWords', protect, addTagsInBulkToWords)
router.post('/checkIfTagLabelAvailable', protect, checkIfTagLabelAvailable)
router.get('/getAmountByTag/:id', protect, getAmountByTag)
router.post('/', protect, createTag)
router.delete('/unfollowTag/:id', protect, deleteUserFollowingTag)
router.delete('/:id', protect, deleteTag)
router.put('/:id', protect, updateTag)

module.exports = router