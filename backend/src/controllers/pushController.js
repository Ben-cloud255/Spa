const db = require('../config/db');

async function getPublicKey(req, res) {
  if (!process.env.VAPID_PUBLIC_KEY) {
    return res.status(503).json({ error: 'Phone alerts have not been set up on the server yet.' });
  }
  return res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
}

async function subscribe(req, res) {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: 'Invalid subscription details.' });
  }
  try {
    await db.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
      [req.user.id, endpoint, keys.p256dh, keys.auth]
    );
    return res.status(201).json({ message: 'Phone alerts enabled on this device.' });
  } catch (err) {
    console.error('Push subscribe error:', err);
    return res.status(500).json({ error: 'Could not enable phone alerts on this device.' });
  }
}

async function unsubscribe(req, res) {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: 'Missing endpoint.' });
  try {
    await db.query('DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2', [endpoint, req.user.id]);
    return res.json({ message: 'Phone alerts turned off on this device.' });
  } catch (err) {
    console.error('Push unsubscribe error:', err);
    return res.status(500).json({ error: 'Could not turn off phone alerts on this device.' });
  }
}

module.exports = { getPublicKey, subscribe, unsubscribe };
