const express = require('express')
const router = express.Router()
const { login, me } = require('../../controllers/admin/authController.ts')
const { requireStaff } = require('../../middleware/staffAuth.ts')

router.post('/login', login)
router.get('/me', requireStaff(), me)

module.exports = router
