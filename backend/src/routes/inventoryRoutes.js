const express = require('express');
const {
  listItems,
  createItem,
  updateItem,
  listBranchStock,
  distribute,
  listDistributions,
  assignToRoom,
  completeAllocation,
  listRoomAllocations,
} = require('../controllers/inventoryController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Catalog — admin manages it, everyone signed in can read it (names/units
// are needed to render the assign/complete forms for receptionists and providers).
router.get('/items', requireAuth, listItems);
router.post('/items', requireAuth, requireRole('admin'), createItem);
router.patch('/items/:id', requireAuth, requireRole('admin'), updateItem);

// Branch stock
router.get('/branch-stock', requireAuth, requireRole('admin', 'receptionist'), listBranchStock);

// Admin distributing newly bought stock out to branch(es)
router.post('/distribute', requireAuth, requireRole('admin'), distribute);
router.get('/distributions', requireAuth, requireRole('admin'), listDistributions);

// Receptionist handing stock to a room, provider (or admin) marking it finished
router.post('/room-allocations', requireAuth, requireRole('admin', 'receptionist'), assignToRoom);
router.post('/room-allocations/:id/complete', requireAuth, requireRole('admin', 'provider'), completeAllocation);
router.get('/room-allocations', requireAuth, listRoomAllocations);

module.exports = router;
