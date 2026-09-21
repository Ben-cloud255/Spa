const express = require('express');
const { listAuditLog } = require('../controllers/auditLogController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, requireRole('admin'), listAuditLog);

module.exports = router;
