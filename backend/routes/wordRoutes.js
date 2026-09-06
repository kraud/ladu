const express = require('express')
const router = express.Router()
const {
    getWords, setWord, updateWord, deleteWord, getWordsSimplified, getWordById, filterWordByAnyTranslation,
    getWordDataByRequest, getAllWordDataByWord, deleteManyWords, getWordsByFollowedTag
} = require('../controllers/wordController.ts')
const {protect} = require('../middleware/authMiddleware.ts')

router.get('/', protect, getWords)

router.get('/getWordsRelatedToFollowedTag', protect, getWordsByFollowedTag)

router.get('/simple', protect, getWordsSimplified)

router.get('/searchWord', protect, filterWordByAnyTranslation)

router.get('/getAllWordDataByWord', protect, getAllWordDataByWord) // TODO: this should be removed? Double check

router.get('/:id', protect, getWordById)

router.post('/', protect, setWord)

router.put('/:id', protect, updateWord)

// NB! order of delete is important! if reversed, the path always matches for deleteWord, and we can't deleteMany
router.delete('/deleteMany', protect, deleteManyWords)
router.delete('/:id', protect, deleteWord)

module.exports = router