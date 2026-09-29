const express = require('express')
const router = express.Router()
const {generate, saveAnswer, setModifier} = require('../controllers/exerciseController.ts')
const {protect} = require('../middleware/authMiddleware.ts')

router.post('/generate', protect, generate)
router.post('/answers', protect, saveAnswer)
router.put('/performances/:translationId/modifier', protect, setModifier)

module.exports = router
