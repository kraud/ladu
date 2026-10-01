const express = require('express')
const router = express.Router()
const {
    getAccess, setRegistration, addInvites, removeInvite,
} = require('../../controllers/admin/accessController.ts')
const { requireStaff } = require('../../middleware/staffAuth.ts')

// Access gates. Every route needs `access.manage` (owner only).
router.get('/', requireStaff('access.manage'), getAccess)
router.put('/registration', requireStaff('access.manage'), setRegistration)
router.post('/invites', requireStaff('access.manage'), addInvites)
router.delete('/invites/:id', requireStaff('access.manage'), removeInvite)

module.exports = router
