const express = require('express');
const { listBranches } = require('../controllers/branchController');
const { listServices } = require('../controllers/serviceController');
const { createAppointment } = require('../controllers/appointmentController');

const router = express.Router();

// No auth on any of these — this is what the public website calls.
// listBranches/listServices don't touch req.user, so they're safe to reuse as-is.
router.get('/branches', listBranches);
router.get('/services', listServices);
router.post('/appointments', createAppointment);

module.exports = router;
