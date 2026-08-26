const express = require('express');
const { listUsers, createUser, updateUser, resetPassword } = require('../controllers/userController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireRole('admin'));
router.get('/', listUsers);
router.post('/', createUser);
router.patch('/:id', updateUser);
router.post('/:id/reset-password', resetPassword);

module.exports = router;
