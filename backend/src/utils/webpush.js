const webpush = require('web-push');
const db = require('../config/db');

let configured = false;

function ensureConfigured() {
  if (configured) return true;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false; // not set up yet — skip quietly
  webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:admin@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

/**
 * Sends a push payload to every given subscription. Dead subscriptions
 * (uninstalled app, expired, permission revoked) are cleaned up automatically
 * when the push service reports them gone — no manual pruning needed.
 */
async function sendPushToSubscriptions(subscriptions, payload) {
  if (!ensureConfigured() || subscriptions.length === 0) return;
  const body = JSON.stringify(payload);

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await db.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]).catch(() => {});
        } else {
          console.warn('Push send failed:', err.message);
        }
      }
    })
  );
}

module.exports = { sendPushToSubscriptions, isPushConfigured: ensureConfigured };
