const express = require('express');
const { listNotifications, markRead, markAllRead } = require('../controllers/notificationController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, listNotifications);
router.post('/:id/read', requireAuth, markRead);
router.post('/read-all', requireAuth, markAllRead);

module.exports = router;
