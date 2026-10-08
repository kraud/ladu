const express = require('express')
const router = express.Router()
const { lookup } = require('../controllers/dictionaryController.ts')
const { protect } = require('../middleware/authMiddleware.ts')

router.get('/:language/:partOfSpeech/:query', protect, lookup)

module.exports = router
