const express = require('express');
const { listServices, createService, updateService } = require('../controllers/serviceController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, listServices);
router.post('/', requireAuth, requireRole('admin'), createService);
router.patch('/:id', requireAuth, requireRole('admin'), updateService);

module.exports = router;
