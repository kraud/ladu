const express = require('express')
const router = express.Router()
const { getUserFriendships, createFriendship, acceptFriendship, declineFriendship, deleteFriendship } = require('../controllers/friendshipController.ts')
const {protect} = require('../middleware/authMiddleware.ts')

router.get('/', protect, getUserFriendships)
router.post('/', protect, createFriendship)
router.post('/:id/accept', protect, acceptFriendship)
router.post('/:id/decline', protect, declineFriendship)
router.delete('/:id', protect, deleteFriendship)

module.exports = router
