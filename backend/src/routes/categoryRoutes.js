const express = require('express');
const { listCategories, createCategory, removeCategory } = require('../controllers/categoryController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, listCategories);
router.post('/', requireAuth, requireRole('admin'), createCategory);

router.delete('/:id', requireAuth, requireRole('admin'), removeCategory);

module.exports = router;
