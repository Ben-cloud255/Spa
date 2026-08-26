const db = require('../config/db');
const { getIo } = require('../sockets');
const { sendPushToSubscriptions } = require('./webpush');

/**
 * Creates a notification record and pushes it in real time.
 * Admin always sees every notification, across every branch. If branchId +
 * targetRole are both set, that role's dashboard *at that branch* also sees
 * it (e.g. the Dodoma receptionist doesn't get pinged about a Dar es Salaam
 * room). If targetUserId is set, that specific user is notified as well.
 */
async function notify({
  type,
  message,
  bookingId = null,
  roomId = null,
  branchId = null,
  targetRole = null,
  targetUserId = null,
}) {
  const result = await db.query(
    `INSERT INTO notifications (type, message, booking_id, room_id, branch_id, target_role, target_user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [type, message, bookingId, roomId, branchId, targetRole, targetUserId]
  );
  const notification = result.rows[0];

  try {
    const io = getIo();
    io.to('role:admin').emit('notification:new', notification);
    if (branchId && targetRole) io.to(`branch:${branchId}:role:${targetRole}`).emit('notification:new', notification);
    if (targetUserId) io.to(`user:${targetUserId}`).emit('notification:new', notification);
  } catch (err) {
    // Socket layer may not be ready (e.g. during tests) — the DB record still persists.
    console.warn('Could not emit realtime notification:', err.message);
  }

  // Push to any devices that opted in, using the same targeting as above.
  // Nobody gets pushed to unless they explicitly enabled it on that device —
  // there's no separate "which alerts are push-worthy" list to maintain.
  try {
    const clauses = [`u.role = 'admin'`];
    const params = [];
    if (branchId && targetRole) {
      params.push(targetRole, branchId);
      clauses.push(`(u.role = $${params.length - 1} AND u.branch_id = $${params.length})`);
    }
    if (targetUserId) {
      params.push(targetUserId);
      clauses.push(`ps.user_id = $${params.length}`);
    }
    const subsResult = await db.query(
      `SELECT DISTINCT ps.* FROM push_subscriptions ps JOIN users u ON u.id = ps.user_id WHERE ${clauses.join(' OR ')}`,
      params
    );
    await sendPushToSubscriptions(subsResult.rows, { title: 'Serene Spa', body: message, url: '/' });
  } catch (err) {
    console.warn('Could not send push notifications:', err.message);
  }

  return notification;
}

/** Room objects carry `branchId` (see roomController.shapeRoom). */
function broadcastRoomUpdate(room) {
  try {
    const io = getIo();
    io.to('role:admin').emit('room:updated', room);
    if (room.branch?.id) io.to(`branch:${room.branch.id}`).emit('room:updated', room);
  } catch (err) {
    console.warn('Could not broadcast room update:', err.message);
  }
}

module.exports = { notify, broadcastRoomUpdate };
