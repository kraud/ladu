const express = require('express')
const router = express.Router()
const { getHealth } = require('../../controllers/admin/healthController.ts')
const { requireStaff } = require('../../middleware/staffAuth.ts')

router.get('/', requireStaff('health.read'), getHealth)

module.exports = router
