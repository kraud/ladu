const express = require('express')
const router = express.Router()
const {listConfigs, createConfig, getConfigWords, updateConfig, deleteConfig} = require('../controllers/practiceConfigController.ts')
const {protect} = require('../middleware/authMiddleware.ts')

router.get('/configs', protect, listConfigs)
router.post('/configs', protect, createConfig)
router.get('/configs/:id/words', protect, getConfigWords)
router.put('/configs/:id', protect, updateConfig)
router.delete('/configs/:id', protect, deleteConfig)

module.exports = router
