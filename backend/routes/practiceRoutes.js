const express = require('express')
const router = express.Router()
const {listConfigs, createConfig, getConfigWords, updateConfig, deleteConfig} = require('../controllers/practiceConfigController.ts')
const {listSessions, getSession, createSession, updateSession, deleteSession} = require('../controllers/practiceSessionController.ts')
const {protect} = require('../middleware/authMiddleware.ts')

router.get('/configs', protect, listConfigs)
router.post('/configs', protect, createConfig)
router.get('/configs/:id/words', protect, getConfigWords)
router.put('/configs/:id', protect, updateConfig)
router.delete('/configs/:id', protect, deleteConfig)

router.get('/sessions', protect, listSessions)
router.post('/sessions', protect, createSession)
router.get('/sessions/:id', protect, getSession)
router.put('/sessions/:id', protect, updateSession)
router.delete('/sessions/:id', protect, deleteSession)

module.exports = router
