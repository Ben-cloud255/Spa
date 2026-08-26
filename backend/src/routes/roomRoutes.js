const express = require('express');
const { listRooms, getRoom, createRoom, updateRoom, archiveRoom } = require('../controllers/roomController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, listRooms);
router.get('/:id', requireAuth, getRoom);
router.post('/', requireAuth, requireRole('admin'), createRoom);
router.patch('/:id', requireAuth, requireRole('admin'), updateRoom);
router.delete('/:id', requireAuth, requireRole('admin'), archiveRoom);

module.exports = router;
