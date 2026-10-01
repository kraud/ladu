const express = require('express')
const router = express.Router()
const { getAccess } = require('../controllers/accessController.ts')

router.get('/', getAccess)

module.exports = router
