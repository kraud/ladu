const express = require('express')
const router = express.Router()
const { lookup, suggest, translate, suggestSenses, senseOfKey } = require('../controllers/dictionaryController.ts')
const { protect } = require('../middleware/authMiddleware.ts')

// '/translate/:fromLanguage' must come before '/:language/:partOfSpeech' (it would match that path).
router.get('/translate/:fromLanguage', protect, suggestSenses)
// 'translate/sense/Noun' also fits the 3-segment lookup route '/:language/:partOfSpeech/:query': keep it above that one.
router.get('/translate/sense/:partOfSpeech', protect, senseOfKey)
router.get('/translate/:fromLanguage/:partOfSpeech/:query', protect, translate)
router.get('/:language/:partOfSpeech', protect, suggest)
router.get('/:language/:partOfSpeech/:query', protect, lookup)

module.exports = router
