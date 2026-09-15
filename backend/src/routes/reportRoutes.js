const express = require('express');
const { getSummary, getDetail, getExecutive } = require('../controllers/reportController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Receptionists get their own branch's reports; admin gets everything.
router.get('/summary', requireAuth, requireRole('admin', 'receptionist'), getSummary);
router.get('/detail', requireAuth, requireRole('admin', 'receptionist'), getDetail);
router.get('/executive', requireAuth, requireRole('admin', 'receptionist'), getExecutive);

module.exports = router;
