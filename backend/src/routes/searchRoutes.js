const express = require('express');
const { globalSearch } = require('../controllers/searchController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, requireRole('admin'), globalSearch);

module.exports = router;
