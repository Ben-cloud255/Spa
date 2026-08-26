const express = require('express');
const {
  listAppointments,
  confirmAppointment,
  cancelAppointment,
  checkInAppointment,
} = require('../controllers/appointmentController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireRole('admin', 'receptionist'));
router.get('/', listAppointments);
router.post('/:id/confirm', confirmAppointment);
router.post('/:id/cancel', cancelAppointment);
router.post('/:id/check-in', checkInAppointment);

module.exports = router;
