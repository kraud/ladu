const express = require('express')
const router = express.Router()
const { getProviders, startAuth, callback, signupComplete, link } = require('../controllers/oauthController.ts')

router.get('/providers', getProviders)
router.get('/:provider/start', startAuth)
router.get('/:provider/callback', callback)
router.post('/signup/complete', signupComplete)
router.post('/link', link)

module.exports = router
