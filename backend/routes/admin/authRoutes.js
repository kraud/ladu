const express = require('express')
const router = express.Router()
const { login, me, changePassword } = require('../../controllers/admin/authController.ts')
const { requireStaff } = require('../../middleware/staffAuth.ts')

router.post('/login', login)
// `me` and `change-password` are the two routes a person with a temporary
// password may still use (everything else answers 403 until they change it).
router.get('/me', requireStaff(undefined, { allowMustChangePassword: true }), me)
router.post('/change-password', requireStaff(undefined, { allowMustChangePassword: true }), changePassword)

module.exports = router
