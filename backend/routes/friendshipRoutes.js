const express = require('express')
const router = express.Router()
const { createFriendship, updateFriendship, deleteFriendship, getUserFriendshipsByParticipantId,
    deleteFriendshipRequest, acceptFriendshipRequest
} = require('../controllers/friendshipController.ts')
const {protect} = require('../middleware/authMiddleware.ts')

router.get('/getFriendships', protect, getUserFriendshipsByParticipantId)
router.post('/', protect, createFriendship)
// NB! delete-routes order matters. Should remain like this, to avoid going prematurely to 'deleteFriendship'
router.delete('/deleteRequestAndNotifications/:id', protect, deleteFriendshipRequest)
router.delete('/:id', protect, deleteFriendship)
router.put('/acceptRequestAndDeleteNotifications/:id', protect, acceptFriendshipRequest)
router.put('/:id', protect, updateFriendship)


module.exports = router