const express = require('express');
const {
  listPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
} = require('../controllers/paymentMethodController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, listPaymentMethods);
router.post('/', requireAuth, requireRole('admin'), createPaymentMethod);
router.patch('/:id', requireAuth, requireRole('admin'), updatePaymentMethod);

module.exports = router;
