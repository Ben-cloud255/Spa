const express = require('express');
const {
  createBooking,
  confirmStart,
  confirmEnd,
  cancelBooking,
  addExtraService,
  cancelExtraServiceRequest,
  recordPayment,
  listBookings,
  forceEndBooking,
  holdBooking,
  resumeBooking,
  releaseBooking,
  reportNoShow,
} = require('../controllers/bookingController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, listBookings);
router.post('/', requireAuth, requireRole('admin', 'receptionist'), createBooking);
router.post('/:id/confirm-start', requireAuth, requireRole('provider'), confirmStart);
router.post('/:id/confirm-end', requireAuth, requireRole('provider'), confirmEnd);
router.post('/:id/cancel', requireAuth, requireRole('admin', 'receptionist', 'provider'), cancelBooking);
router.post('/:id/extra-service', requireAuth, requireRole('provider'), addExtraService);
router.post('/:id/extra-service/cancel', requireAuth, requireRole('admin', 'receptionist'), cancelExtraServiceRequest);
router.post('/:id/payment', requireAuth, requireRole('admin', 'receptionist'), recordPayment);
router.post('/:id/force-end', requireAuth, requireRole('admin'), forceEndBooking);
router.post('/:id/hold', requireAuth, requireRole('admin', 'receptionist'), holdBooking);
router.post('/:id/resume', requireAuth, requireRole('admin', 'receptionist'), resumeBooking);
router.post('/:id/release', requireAuth, requireRole('admin', 'receptionist'), releaseBooking);
router.post('/:id/report-no-show', requireAuth, requireRole('provider'), reportNoShow);

module.exports = router;
