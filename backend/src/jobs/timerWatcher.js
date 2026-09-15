const db = require('../config/db');
const { notify, broadcastRoomUpdate } = require('../utils/notify');
const { shapeRoom, ROOM_SELECT } = require('../controllers/roomController');

const PENDING_TIMEOUT_MINUTES = Number(process.env.PENDING_TIMEOUT_MINUTES || 30);
const ENDING_SOON_LEAD_MINUTES = Number(process.env.ENDING_SOON_LEAD_MINUTES || 10);
const CHECK_INTERVAL_MS = Number(process.env.TIMER_CHECK_INTERVAL_SECONDS || 20) * 1000;

async function checkPendingTimeouts() {
  const result = await db.query(
    `SELECT b.*, r.name AS room_name, u.name AS provider_name
     FROM bookings b
     JOIN rooms r ON r.id = b.room_id
     JOIN users u ON u.id = b.provider_id
     WHERE b.status = 'pending'
       AND b.pending_notified = FALSE
       AND b.pending_started_at < NOW() - ($1 || ' minutes')::interval`,
    [PENDING_TIMEOUT_MINUTES]
  );

  for (const booking of result.rows) {
    await notify({
      type: 'pending_timeout',
      message: `${booking.room_name}: ${booking.provider_name} has not confirmed the start of ${booking.customer_name}'s service after ${PENDING_TIMEOUT_MINUTES} minutes.`,
      bookingId: booking.id,
      roomId: booking.room_id,
      branchId: booking.branch_id,
      targetRole: 'receptionist',
    });
    await db.query('UPDATE bookings SET pending_notified = TRUE WHERE id = $1', [booking.id]);

    const full = await db.query(`${ROOM_SELECT} WHERE r.id = $1`, [booking.room_id]);
    if (full.rows[0]) broadcastRoomUpdate(shapeRoom(full.rows[0]));
  }
}

// Warns the *specific* provider running the session — not their whole role —
// that time is almost up, so they can start wrapping up.
async function checkEndingSoonSessions() {
  const result = await db.query(
    `SELECT b.*, r.name AS room_name
     FROM bookings b
     JOIN rooms r ON r.id = b.room_id
     WHERE b.status = 'active'
       AND b.warning_notified = FALSE
       AND b.expected_end_at IS NOT NULL
       AND b.expected_end_at > NOW()
       AND b.expected_end_at <= NOW() + ($1 || ' minutes')::interval`,
    [ENDING_SOON_LEAD_MINUTES]
  );

  for (const booking of result.rows) {
    await notify({
      type: 'service_ending_soon',
      message: `${booking.room_name}: ${booking.customer_name}'s session ends in about ${ENDING_SOON_LEAD_MINUTES} minutes.`,
      bookingId: booking.id,
      roomId: booking.room_id,
      branchId: booking.branch_id,
      targetUserId: booking.provider_id,
    });
    await db.query('UPDATE bookings SET warning_notified = TRUE WHERE id = $1', [booking.id]);
  }
}

async function checkOvertimeSessions() {
  const result = await db.query(
    `SELECT b.*, r.name AS room_name, u.name AS provider_name
     FROM bookings b
     JOIN rooms r ON r.id = b.room_id
     JOIN users u ON u.id = b.provider_id
     WHERE b.status = 'active'
       AND b.overtime_notified = FALSE
       AND b.expected_end_at IS NOT NULL
       AND b.expected_end_at < NOW()`
  );

  for (const booking of result.rows) {
    await notify({
      type: 'service_overtime',
      message: `${booking.room_name}: ${booking.provider_name} has not confirmed that ${booking.customer_name}'s service has ended, and time is up.`,
      bookingId: booking.id,
      roomId: booking.room_id,
      branchId: booking.branch_id,
      targetRole: 'receptionist',
    });
    await db.query('UPDATE bookings SET overtime_notified = TRUE WHERE id = $1', [booking.id]);
  }
}

function startTimerWatcher() {
  setInterval(() => {
    checkPendingTimeouts().catch((err) => console.error('Pending timeout check failed:', err));
    checkEndingSoonSessions().catch((err) => console.error('Ending-soon check failed:', err));
    checkOvertimeSessions().catch((err) => console.error('Overtime check failed:', err));
  }, CHECK_INTERVAL_MS);
  console.log(`Timer watcher started (checking every ${CHECK_INTERVAL_MS / 1000}s).`);
}

module.exports = { startTimerWatcher };
