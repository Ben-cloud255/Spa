const express = require('express');
const { getSummary, getDetail, getExecutive, getAnalytics } = require('../controllers/reportController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
const { getManagement } = require('../controllers/managementReportController');
router.get('/management', requireAuth, requireRole('admin', 'receptionist'), getManagement);

// Receptionists get their own branch's reports; admin gets everything.
router.get('/summary', requireAuth, requireRole('admin', 'receptionist'), getSummary);
router.get('/detail', requireAuth, requireRole('admin', 'receptionist'), getDetail);
router.get('/executive', requireAuth, requireRole('admin', 'receptionist'), getExecutive);
router.get('/analytics', requireAuth, requireRole('admin'), getAnalytics);

module.exports = router;
