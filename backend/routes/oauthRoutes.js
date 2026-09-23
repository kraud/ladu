const express = require('express')
const router = express.Router()
const { getProviders, startAuth, callback } = require('../controllers/oauthController.ts')

router.get('/providers', getProviders)
router.get('/:provider/start', startAuth)
router.get('/:provider/callback', callback)

module.exports = router
