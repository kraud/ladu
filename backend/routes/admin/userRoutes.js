const express = require('express')
const router = express.Router()
const { listUsers, getUser } = require('../../controllers/admin/userController.ts')
const { requireStaff } = require('../../middleware/staffAuth.ts')

router.get('/', requireStaff('users.read'), listUsers)
router.get('/:id', requireStaff('users.read'), getUser)

module.exports = router
