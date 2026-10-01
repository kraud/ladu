const express = require('express')
const router = express.Router()
const {
    listStaff, createStaffMember, changeStaffRole, disableStaff, enableStaff, resetStaffPassword,
} = require('../../controllers/admin/staffController.ts')
const { requireStaff } = require('../../middleware/staffAuth.ts')

// Slice 8. Every staff-management route needs `staff.manage` (owner only).
router.get('/', requireStaff('staff.manage'), listStaff)
router.post('/', requireStaff('staff.manage'), createStaffMember)
router.post('/:id/role', requireStaff('staff.manage'), changeStaffRole)
router.post('/:id/disable', requireStaff('staff.manage'), disableStaff)
router.post('/:id/enable', requireStaff('staff.manage'), enableStaff)
router.post('/:id/reset-password', requireStaff('staff.manage'), resetStaffPassword)

module.exports = router
