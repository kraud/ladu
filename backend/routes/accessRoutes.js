const express = require('express')
const router = express.Router()
const { getAccess, requestAccess } = require('../controllers/accessController.ts')

router.get('/', getAccess)
router.post('/request', requestAccess)

module.exports = router
