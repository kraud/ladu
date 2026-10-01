// Every admin route lives under /api/admin and is guarded by requireStaff
// (middleware/staffAuth.ts), never by the learner `protect` middleware.
const express = require('express')
const router = express.Router()

router.use('/auth', require('./authRoutes'))
router.use('/users', require('./userRoutes'))
router.use('/health', require('./healthRoutes'))
router.use('/staff', require('./staffRoutes'))
router.use('/audit', require('./auditRoutes'))
router.use('/stats', require('./statsRoutes'))

module.exports = router
