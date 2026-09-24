const express = require('express')
const router = express.Router()
const {
    getProviders, startAuth, startLink, callback, signupComplete, link, getIdentities, deleteIdentity,
} = require('../controllers/oauthController.ts')
const { protect } = require('../middleware/authMiddleware.ts')

router.get('/providers', getProviders)
router.get('/:provider/start', startAuth)
router.get('/:provider/callback', callback)
router.post('/signup/complete', signupComplete)
router.post('/link', link)
router.post('/:provider/link', protect, startLink)
router.get('/identities', protect, getIdentities)
router.delete('/identities/:id', protect, deleteIdentity)

module.exports = router
