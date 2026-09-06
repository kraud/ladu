const express = require('express')
const router = express.Router()
const {getExercises} = require('../controllers/exerciseController.ts')
const {saveTranslationPerformance, savePerformanceAction} = require ('../controllers/exercisePerformanceController.ts')
const {protect} = require('../middleware/authMiddleware.ts')

router.get('/getUserExercises', protect, getExercises)
router.post('/saveTranslationPerformance', protect, saveTranslationPerformance)
router.post('/savePerformanceAction', protect, savePerformanceAction)

module.exports = router