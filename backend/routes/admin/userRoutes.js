const express = require('express')
const router = express.Router()
const {
    listUsers, getUser, banUser, unbanUser, forceLogoutUser, deleteUser, restoreUser, purgeUser,
} = require('../../controllers/admin/userController.ts')
const { requireStaff } = require('../../middleware/staffAuth.ts')

router.get('/', requireStaff('users.read'), listUsers)
router.get('/:id', requireStaff('users.read'), getUser)

// Actions (slice 5). Each writes an audit row in the same transaction.
router.post('/:id/ban', requireStaff('users.ban'), banUser)
router.post('/:id/unban', requireStaff('users.ban'), unbanUser)
router.post('/:id/force-logout', requireStaff('users.ban'), forceLogoutUser)
router.post('/:id/delete', requireStaff('users.delete'), deleteUser)
router.post('/:id/restore', requireStaff('users.delete'), restoreUser)
router.post('/:id/purge', requireStaff('users.purge'), purgeUser)

module.exports = router
