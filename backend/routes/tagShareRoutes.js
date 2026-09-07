const express = require('express')
const router = express.Router()
const { acceptTagShare, declineTagShare } = require('../controllers/tagController.ts')
const {protect} = require('../middleware/authMiddleware.ts')

router.post('/:id/accept', protect, acceptTagShare)
router.post('/:id/decline', protect, declineTagShare)

module.exports = router
