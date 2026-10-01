const express = require('express')
const router = express.Router()
const { getStats } = require('../../controllers/admin/statsController.ts')
const { requireStaff } = require('../../middleware/staffAuth.ts')

// Slice 9. Aggregates only, no personal data; every role may read them.
router.get('/', requireStaff('users.read'), getStats)

module.exports = router
