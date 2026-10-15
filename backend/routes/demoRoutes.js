const express = require('express')
const router = express.Router()
const { startDemo } = require('../controllers/demoController.ts')

// Public: a visitor without an account starts a demo (demo-access.md). Limited per IP and by the live cap.
router.post('/', startDemo)

module.exports = router
