const express = require('express');
const { listBranches, createBranch, updateBranch } = require('../controllers/branchController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Every signed-in role can read the branch list (needed for dropdowns).
router.get('/', requireAuth, listBranches);
router.post('/', requireAuth, requireRole('admin'), createBranch);
router.patch('/:id', requireAuth, requireRole('admin'), updateBranch);

module.exports = router;
