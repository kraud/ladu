const express = require('express')
const router = express.Router()
const { listAudit, getAuditFilters } = require('../../controllers/admin/auditController.ts')
const { requireStaff } = require('../../middleware/staffAuth.ts')

// Slice 8. The audit log is read-only and needs `audit.read` (admin and owner).
router.get('/', requireStaff('audit.read'), listAudit)
router.get('/filters', requireStaff('audit.read'), getAuditFilters)

module.exports = router
