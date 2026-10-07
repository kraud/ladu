const express = require('express')
const router = express.Router()
const {
    getAccess, setRegistration, setLogin, addInvites, removeInvite, sendInvite,
    allowLogin, disallowLoginMany, disallowLogin, signOutEveryone,
} = require('../../controllers/admin/accessController.ts')
const { requireStaff } = require('../../middleware/staffAuth.ts')

// Access gates. Every route needs `access.manage` (owner only).
router.get('/', requireStaff('access.manage'), getAccess)
router.put('/registration', requireStaff('access.manage'), setRegistration)
router.put('/login', requireStaff('access.manage'), setLogin)
router.post('/invites', requireStaff('access.manage'), addInvites)
router.delete('/invites/:id', requireStaff('access.manage'), removeInvite)
router.post('/invites/:id/send', requireStaff('access.manage'), sendInvite)
router.post('/login-allowed', requireStaff('access.manage'), allowLogin)
// A bulk remove is a POST, because a DELETE with a long list of ids has no safe place to put them.
router.post('/login-allowed/remove', requireStaff('access.manage'), disallowLoginMany)
router.delete('/login-allowed/:userId', requireStaff('access.manage'), disallowLogin)
router.post('/sign-out-everyone', requireStaff('access.manage'), signOutEveryone)

module.exports = router
