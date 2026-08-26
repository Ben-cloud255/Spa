const express = require('express');
const { getPublicKey, subscribe, unsubscribe } = require('../controllers/pushController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);
router.get('/vapid-public-key', getPublicKey);
router.post('/subscribe', subscribe);
router.post('/unsubscribe', unsubscribe);

module.exports = router;
