const express = require('express')
const router = express.Router()
const {getCapacity, createOnboarding, skipOnboarding} = require('../controllers/onboardingController.ts')
const {protect} = require('../middleware/authMiddleware.ts')

router.post('/capacity', protect, getCapacity)
router.post('/skip', protect, skipOnboarding)
router.post('/', protect, createOnboarding)

module.exports = router
