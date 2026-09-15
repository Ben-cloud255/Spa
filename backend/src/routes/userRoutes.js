const express = require('express');
const { listUsers, createUser, updateUser, resetPassword } = require('../controllers/userController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Receptionists need to see which providers are free when booking a
// customer in — read-only, and scoped to their own branch in the controller.
router.get('/', requireAuth, requireRole('admin', 'receptionist'), listUsers);
router.post('/', requireAuth, requireRole('admin'), createUser);
router.patch('/:id', requireAuth, requireRole('admin'), updateUser);
router.post('/:id/reset-password', requireAuth, requireRole('admin'), resetPassword);

module.exports = router;
