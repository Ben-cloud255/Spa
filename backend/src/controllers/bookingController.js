const db = require('../config/db');
const { notify, broadcastRoomUpdate } = require('../utils/notify');
const { logAudit } = require('../utils/auditLog');
const { shapeRoom, ROOM_SELECT } = require('./roomController');

async function refreshedRoom(roomId) {
  const full = await db.query(`${ROOM_SELECT} WHERE r.id = $1`, [roomId]);
  return shapeRoom(full.rows[0]);
}

// --- Receptionist: collect payment and create a booking in one step ---
// A room is only ever assigned to a customer who has already paid in full —
// this endpoint records the payment and creates the booking atomically, so
// there's no window where a room is held for someone who hasn't paid yet.
async function createBooking(req, res) {
  const { customerName, customerPhone, serviceId, roomId, providerId, amountPaid, paymentMethod } = req.body;
  if (!customerName || !customerPhone || !serviceId || !roomId) {
    return res.status(400).json({ error: 'Customer name, phone, service, and room are all required.' });
  }
  const paidNum = Number(amountPaid);
  if (!amountPaid || Number.isNaN(paidNum) || paidNum <= 0) {
    return res.status(400).json({ error: 'Collect payment before assigning a room.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const roomRes = await client.query('SELECT * FROM rooms WHERE id = $1 FOR UPDATE', [roomId]);
    const room = roomRes.rows[0];
    if (!room) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Room not found.' });
    }
    if (req.user.role !== 'admin' && String(room.branch_id) !== String(req.user.branchId)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'This room belongs to a different branch.' });
    }
    if (room.status !== 'inactive') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This room is currently occupied. Choose a free room.' });
    }
    const branchState = await client.query('SELECT is_active FROM branches WHERE id = $1', [room.branch_id]);
    if (!branchState.rowCount || !branchState.rows[0].is_active) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This branch is currently on maintenance and cannot accept new bookings.' });
    }

    // The provider doesn't have to be the room's usual one — any free
    // provider at this branch can be chosen, so one person isn't stuck
    // tied to a single room. Falls back to the room's default if none given.
    const chosenProviderId = providerId || room.provider_id;
    if (!chosenProviderId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Choose a service provider for this booking.' });
    }
    const providerRes = await client.query(
      `SELECT u.*, EXISTS (
         SELECT 1 FROM bookings bk WHERE bk.provider_id = u.id AND bk.status IN ('pending', 'active')
       ) AS is_busy
       FROM users u WHERE u.id = $1 AND u.role = 'provider' AND u.is_active = TRUE`,
      [chosenProviderId]
    );
    const provider = providerRes.rows[0];
    if (!provider) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'That provider was not found or is not active.' });
    }
    if (String(provider.branch_id) !== String(room.branch_id)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Choose a provider from the same branch as this room.' });
    }
    if (provider.is_busy) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `${provider.name} is currently with another customer. Choose someone else who's free.` });
    }

    const serviceRes = await client.query('SELECT * FROM services WHERE id = $1 AND is_active = TRUE', [serviceId]);
    const service = serviceRes.rows[0];
    if (!service) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Service not found.' });
    }

    if (paidNum < Number(service.price)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Full payment is required before assigning a room. This service costs ${service.price}.`,
      });
    }

    const bookingRes = await client.query(
      `INSERT INTO bookings
         (customer_name, customer_phone, service_id, room_id, provider_id, receptionist_id, branch_id,
          amount_due, amount_paid, payment_status, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'paid', 'pending') RETURNING *`,
      [customerName.trim(), customerPhone.trim(), service.id, room.id, provider.id, req.user.id, room.branch_id, service.price, paidNum]
    );

    await client.query(
      `INSERT INTO payments (booking_id, amount, method, recorded_by) VALUES ($1, $2, $3, $4)`,
      [bookingRes.rows[0].id, paidNum, paymentMethod || 'cash', req.user.id]
    );

    await client.query(`UPDATE rooms SET status = 'pending' WHERE id = $1`, [room.id]);

    await client.query('COMMIT');

    logAudit(req, {
      action: 'Booking Created',
      entityType: 'booking',
      entityLabel: `${customerName.trim()} — ${service.name} in ${room.name}`,
      branchId: room.branch_id,
    });

    const updatedRoom = await refreshedRoom(room.id);
    broadcastRoomUpdate(updatedRoom);

    return res.status(201).json({ room: updatedRoom, booking: bookingRes.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create booking error:', err);
    return res.status(500).json({ error: 'Could not create the booking.' });
  } finally {
    client.release();
  }
}

// --- Provider: confirm the customer is in the room and service has started ---
async function confirmStart(req, res) {
  const { id } = req.params;
  try {
    const bookingRes = await db.query(
      `SELECT b.*, s.duration_minutes FROM bookings b
       JOIN services s ON s.id = b.service_id WHERE b.id = $1`,
      [id]
    );
    const booking = bookingRes.rows[0];
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (booking.provider_id !== req.user.id) {
      return res.status(403).json({ error: 'This booking is not assigned to you.' });
    }
    if (booking.status !== 'pending') {
      return res.status(409).json({ error: 'This booking has already been started or is no longer active.' });
    }

    const now = new Date();
    const expectedEnd = new Date(now.getTime() + booking.duration_minutes * 60000);

    await db.query(
      `UPDATE bookings SET status = 'active', active_started_at = $1, expected_end_at = $2, no_show_reported_at = NULL WHERE id = $3`,
      [now, expectedEnd, id]
    );
    await db.query(`UPDATE rooms SET status = 'active' WHERE id = $1`, [booking.room_id]);

    const updatedRoom = await refreshedRoom(booking.room_id);
    broadcastRoomUpdate(updatedRoom);

    return res.json({ room: updatedRoom });
  } catch (err) {
    console.error('Confirm start error:', err);
    return res.status(500).json({ error: 'Could not confirm the service start.' });
  }
}

// --- Provider: confirm the service has ended ---
async function confirmEnd(req, res) {
  const { id } = req.params;
  try {
    const bookingRes = await db.query('SELECT * FROM bookings WHERE id = $1', [id]);
    const booking = bookingRes.rows[0];
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (booking.provider_id !== req.user.id) {
      return res.status(403).json({ error: 'This booking is not assigned to you.' });
    }
    if (booking.status !== 'active') {
      return res.status(409).json({ error: 'This booking is not currently active.' });
    }

    await db.query(`UPDATE bookings SET status = 'completed', ended_at = NOW() WHERE id = $1`, [id]);
    await db.query(`UPDATE rooms SET status = 'inactive' WHERE id = $1`, [booking.room_id]);

    logAudit(req, {
      action: 'Service Completed',
      entityType: 'booking',
      entityLabel: booking.customer_name,
      branchId: booking.branch_id,
    });

    const updatedRoom = await refreshedRoom(booking.room_id);
    broadcastRoomUpdate(updatedRoom);

    const outstanding = Math.max(0, Number(booking.amount_due) - Number(booking.amount_paid));
    await notify({
      type: 'service_ended_payment_due',
      message: outstanding > 0
        ? `${req.user.name} confirmed ${booking.customer_name}'s service has ended. Collect ${outstanding.toLocaleString()} TZS if the customer is paying now.`
        : `${req.user.name} confirmed ${booking.customer_name}'s service has ended. The session is complete.`,
      bookingId: booking.id,
      roomId: booking.room_id,
      branchId: booking.branch_id,
      targetRole: 'receptionist',
    });

    return res.json({ room: updatedRoom });
  } catch (err) {
    console.error('Confirm end error:', err);
    return res.status(500).json({ error: 'Could not confirm the service end.' });
  }
}

// --- Provider: cancel a booking that never started (e.g. no-show) ---
async function cancelBooking(req, res) {
  const { id } = req.params;
  const { reason } = req.body;
  try {
    const bookingRes = await db.query('SELECT * FROM bookings WHERE id = $1', [id]);
    const booking = bookingRes.rows[0];
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (!['pending', 'active'].includes(booking.status)) {
      return res.status(409).json({ error: 'Only pending or active bookings can be cancelled.' });
    }
    const isOwnerProvider = req.user.role === 'provider' && booking.provider_id === req.user.id;
    const isStaff = ['admin', 'receptionist'].includes(req.user.role);
    if (!isOwnerProvider && !isStaff) {
      return res.status(403).json({ error: 'You cannot cancel this booking.' });
    }

    await db.query(
      `UPDATE bookings SET status = 'cancelled', cancel_reason = $1, ended_at = NOW() WHERE id = $2`,
      [reason || null, id]
    );
    await db.query(`UPDATE rooms SET status = 'inactive' WHERE id = $1`, [booking.room_id]);

    const updatedRoom = await refreshedRoom(booking.room_id);
    broadcastRoomUpdate(updatedRoom);

    await notify({
      type: 'booking_cancelled',
      message: `Booking for ${booking.customer_name} in room was cancelled.${reason ? ' Reason: ' + reason : ''}`,
      bookingId: booking.id,
      roomId: booking.room_id,
      branchId: booking.branch_id,
      targetRole: 'receptionist',
    });

    return res.json({ room: updatedRoom });
  } catch (err) {
    console.error('Cancel booking error:', err);
    return res.status(500).json({ error: 'Could not cancel the booking.' });
  }
}

// --- Provider: customer wants an additional/extra service ---
// Two cases behave differently:
//   - The session is still ACTIVE (running now): the extra service extends
//     the timer immediately, same as before.
//   - The session already ENDED (provider just confirmed the end): the timer
//     must NOT start again on click. Instead this books the extra service as
//     pending and asks the receptionist for full payment. The timer only
//     starts once recordPayment() sees that payment come in in full — see
//     below.
async function addExtraService(req, res) {
  const { id } = req.params; // booking id
  const { serviceId } = req.body;
  if (!serviceId) return res.status(400).json({ error: 'Choose a service to add.' });

  try {
    const bookingRes = await db.query('SELECT * FROM bookings WHERE id = $1', [id]);
    const booking = bookingRes.rows[0];
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (booking.provider_id !== req.user.id) {
      return res.status(403).json({ error: 'This booking is not assigned to you.' });
    }
    if (!['active', 'completed'].includes(booking.status)) {
      return res.status(409).json({ error: 'Extra services can only be added to an active or just-completed session.' });
    }

    const serviceRes = await db.query('SELECT * FROM services WHERE id = $1 AND is_active = TRUE', [serviceId]);
    const service = serviceRes.rows[0];
    if (!service) return res.status(404).json({ error: 'Service not found.' });

    const wasCompleted = booking.status === 'completed';
    const newAmountDue = Number(booking.amount_due) + Number(service.price);

    if (wasCompleted) {
      // Session already ended — just flag the request and the amount owed.
      // No timer, no active session, until the receptionist collects payment.
      const newPaymentStatus = Number(booking.amount_paid) >= newAmountDue
        ? 'paid'
        : Number(booking.amount_paid) > 0 ? 'partial' : 'unpaid';

      await db.query(
        `UPDATE bookings SET
           status = 'awaiting_payment',
           ended_at = NULL,
           amount_due = $1,
           payment_status = $2,
           pending_addon_service_id = $3,
           pending_addon_minutes = $4,
           pending_addon_price = $5,
           pending_addon_requested_by = $6
         WHERE id = $7`,
        [newAmountDue, newPaymentStatus, service.id, service.duration_minutes, service.price, req.user.id, id]
      );
      await db.query(`UPDATE rooms SET status = 'pending' WHERE id = $1`, [booking.room_id]);

      const updatedRoom = await refreshedRoom(booking.room_id);
      broadcastRoomUpdate(updatedRoom);

      await notify({
        type: 'extra_service_request',
        message: `${req.user.name} requested "${service.name}" (${service.duration_minutes} min, ${Number(service.price).toLocaleString()} TZS) for ${booking.customer_name}. Collect full payment to start it.`,
        bookingId: booking.id,
        roomId: booking.room_id,
        branchId: booking.branch_id,
        targetRole: 'receptionist',
      });

      return res.json({ room: updatedRoom, awaitingPayment: true });
    }

    // Session is still active right now — extend the running timer as before.
    const currentEnd = booking.expected_end_at ? new Date(booking.expected_end_at) : new Date();
    const newEnd = new Date(currentEnd.getTime() + service.duration_minutes * 60000);
    const newPaymentStatus = Number(booking.amount_paid) >= newAmountDue
      ? 'paid'
      : Number(booking.amount_paid) > 0 ? 'partial' : 'unpaid';

    await db.query(
      `UPDATE bookings SET
         expected_end_at = $1,
         extended_minutes = extended_minutes + $2,
         amount_due = $3,
         payment_status = $4,
         overtime_notified = FALSE,
         warning_notified = FALSE
       WHERE id = $5`,
      [newEnd, service.duration_minutes, newAmountDue, newPaymentStatus, id]
    );
    await db.query(
      `INSERT INTO booking_addons (booking_id, service_id, added_minutes, price, requested_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, service.id, service.duration_minutes, service.price, req.user.id]
    );

    const updatedRoom = await refreshedRoom(booking.room_id);
    broadcastRoomUpdate(updatedRoom);

    await notify({
      type: 'extra_service_request',
      message: `${req.user.name} added "${service.name}" (+${service.duration_minutes} min) for ${booking.customer_name}.`,
      bookingId: booking.id,
      roomId: booking.room_id,
      branchId: booking.branch_id,
      targetRole: 'receptionist',
    });

    return res.json({ room: updatedRoom });
  } catch (err) {
    console.error('Add extra service error:', err);
    return res.status(500).json({ error: 'Could not add the extra service.' });
  }
}

// --- Receptionist: give up on a pending extra-service request (e.g. the
// customer changed their mind before paying). Reverts the booking back to
// completed and takes the addon's price back out of what's owed, without
// touching the original service's own payment history.
async function cancelExtraServiceRequest(req, res) {
  const { id } = req.params;
  try {
    const bookingRes = await db.query('SELECT * FROM bookings WHERE id = $1', [id]);
    const booking = bookingRes.rows[0];
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (booking.status !== 'awaiting_payment' || !booking.pending_addon_service_id) {
      return res.status(409).json({ error: 'There is no pending extra-service request on this booking.' });
    }

    const newAmountDue = Math.max(0, Number(booking.amount_due) - Number(booking.pending_addon_price));
    const newPaymentStatus = Number(booking.amount_paid) >= newAmountDue
      ? 'paid'
      : Number(booking.amount_paid) > 0 ? 'partial' : 'unpaid';

    await db.query(
      `UPDATE bookings SET
         status = 'completed',
         ended_at = NOW(),
         amount_due = $1,
         payment_status = $2,
         pending_addon_service_id = NULL,
         pending_addon_minutes = NULL,
         pending_addon_price = NULL,
         pending_addon_requested_by = NULL
       WHERE id = $3`,
      [newAmountDue, newPaymentStatus, id]
    );
    await db.query(`UPDATE rooms SET status = 'inactive' WHERE id = $1`, [booking.room_id]);

    const updatedRoom = await refreshedRoom(booking.room_id);
    broadcastRoomUpdate(updatedRoom);

    await notify({
      type: 'extra_service_request',
      message: `${req.user.name} cancelled the extra-service request for ${booking.customer_name}; the room is free again.`,
      bookingId: booking.id,
      roomId: booking.room_id,
      branchId: booking.branch_id,
      targetUserId: booking.provider_id,
    });

    return res.json({ room: updatedRoom });
  } catch (err) {
    console.error('Cancel extra service request error:', err);
    return res.status(500).json({ error: 'Could not cancel the extra-service request.' });
  }
}

// --- Receptionist: record a payment against a booking ---
async function recordPayment(req, res) {
  const { id } = req.params; // booking id
  const { amount, method } = req.body;
  const amountNum = Number(amount);
  if (!amountNum || amountNum <= 0) {
    return res.status(400).json({ error: 'Enter a valid payment amount.' });
  }

  try {
    const bookingRes = await db.query('SELECT * FROM bookings WHERE id = $1', [id]);
    const booking = bookingRes.rows[0];
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });

    const isAwaitingAddon = booking.status === 'awaiting_payment' && booking.pending_addon_service_id;
    const outstanding = Math.max(0, Number(booking.amount_due) - Number(booking.amount_paid));

    // An extra service that's waiting to start needs the whole amount at
    // once — no partial payment — so the timer only starts once it's fully
    // covered, never on a partial "put it on their tab" payment.
    if (isAwaitingAddon && amountNum < outstanding) {
      return res.status(400).json({
        error: `This extra service needs full payment before it can start. Outstanding: ${outstanding.toLocaleString()} TZS.`,
      });
    }

    const newPaid = Number(booking.amount_paid) + amountNum;
    const paymentStatus = newPaid >= Number(booking.amount_due) ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid';
    const nowFullyPaid = newPaid >= Number(booking.amount_due);

    if (isAwaitingAddon && nowFullyPaid) {
      // Payment just completed — start the extra service's timer now.
      const now = new Date();
      const expectedEnd = new Date(now.getTime() + booking.pending_addon_minutes * 60000);

      await db.query(
        `UPDATE bookings SET
           amount_paid = $1,
           payment_status = $2,
           status = 'active',
           active_started_at = $3,
           expected_end_at = $4,
           extended_minutes = extended_minutes + $5,
           overtime_notified = FALSE,
           warning_notified = FALSE,
           pending_addon_service_id = NULL,
           pending_addon_minutes = NULL,
           pending_addon_price = NULL,
           pending_addon_requested_by = NULL
         WHERE id = $6`,
        [newPaid, paymentStatus, now, expectedEnd, booking.pending_addon_minutes, id]
      );
      await db.query(`UPDATE rooms SET status = 'active' WHERE id = $1`, [booking.room_id]);
      await db.query(
        `INSERT INTO booking_addons (booking_id, service_id, added_minutes, price, requested_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, booking.pending_addon_service_id, booking.pending_addon_minutes, booking.pending_addon_price, booking.pending_addon_requested_by]
      );

      await notify({
        type: 'payment_recorded',
        message: `${req.user.name} recorded full payment for ${booking.customer_name}'s extra service — it's now started.`,
        bookingId: booking.id,
        roomId: booking.room_id,
        branchId: booking.branch_id,
        targetUserId: booking.provider_id,
      });
    } else {
      await db.query(
        `UPDATE bookings SET amount_paid = $1, payment_status = $2 WHERE id = $3`,
        [newPaid, paymentStatus, id]
      );
    }

    await db.query(
      `INSERT INTO payments (booking_id, amount, method, recorded_by) VALUES ($1, $2, $3, $4)`,
      [id, amountNum, method || 'cash', req.user.id]
    );

    await notify({
      type: 'payment_recorded',
      message: `${req.user.name} recorded a payment of ${amountNum.toLocaleString()} for ${booking.customer_name}.`,
      bookingId: booking.id,
      roomId: booking.room_id,
      branchId: booking.branch_id,
      targetRole: null, // admin-only visibility for financial oversight
    });

    logAudit(req, {
      action: 'Payment Recorded',
      entityType: 'booking',
      entityLabel: `${booking.customer_name} — ${amountNum.toLocaleString()} TZS`,
      branchId: booking.branch_id,
    });

    const updatedRoom = await refreshedRoom(booking.room_id);
    broadcastRoomUpdate(updatedRoom);

    return res.json({ paymentStatus, amountPaid: newPaid, room: updatedRoom });
  } catch (err) {
    console.error('Record payment error:', err);
    return res.status(500).json({ error: 'Could not record the payment.' });
  }
}

// --- Listing / reporting ---
async function listBookings(req, res) {
  const { role, id: userId, branchId } = req.user;
  const { status, from, to, paymentStatus, branchId: queryBranchId } = req.query;

  const clauses = [];
  const params = [];

  if (role === 'provider') {
    params.push(userId);
    clauses.push(`b.provider_id = $${params.length}`);
  }
  if (role === 'admin') {
    if (queryBranchId) {
      params.push(queryBranchId);
      clauses.push(`b.branch_id = $${params.length}`);
    }
  } else {
    params.push(branchId);
    clauses.push(`b.branch_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    clauses.push(`b.status = $${params.length}`);
  }
  if (paymentStatus) {
    params.push(paymentStatus);
    clauses.push(`b.payment_status = $${params.length}`);
  }
  if (from) {
    params.push(from);
    clauses.push(`b.created_at >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    clauses.push(`b.created_at <= $${params.length}`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  try {
    const result = await db.query(
      `SELECT b.*, r.name AS room_name, s.name AS service_name, s.duration_minutes,
              u.name AS provider_name, rec.name AS receptionist_name, br.name AS branch_name
       FROM bookings b
       JOIN rooms r ON r.id = b.room_id
       JOIN services s ON s.id = b.service_id
       JOIN users u ON u.id = b.provider_id
       JOIN users rec ON rec.id = b.receptionist_id
       LEFT JOIN branches br ON br.id = b.branch_id
       ${where}
       ORDER BY b.created_at DESC
       LIMIT 500`,
      params
    );
    return res.json({ bookings: result.rows });
  } catch (err) {
    console.error('List bookings error:', err);
    return res.status(500).json({ error: 'Could not load bookings.' });
  }
}

// --- Admin: force-close a session the provider never confirmed the end of ---
// (e.g. "Time up" sessions blocking a room from being freed/removed). Marks
// the booking properly completed (not cancelled) and notifies the receptionist
// so there's a clear record of who stepped in and why.
async function forceEndBooking(req, res) {
  const { id } = req.params;
  try {
    const bookingRes = await db.query('SELECT * FROM bookings WHERE id = $1', [id]);
    const booking = bookingRes.rows[0];
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (!['pending', 'active'].includes(booking.status)) {
      return res.status(409).json({ error: 'This booking is not currently pending or active.' });
    }

    await db.query(`UPDATE bookings SET status = 'completed', ended_at = NOW() WHERE id = $1`, [id]);
    await db.query(`UPDATE rooms SET status = 'inactive' WHERE id = $1`, [booking.room_id]);

    const updatedRoom = await refreshedRoom(booking.room_id);
    broadcastRoomUpdate(updatedRoom);

    await notify({
      type: 'admin_force_ended',
      message: `An admin manually closed ${booking.customer_name}'s session in this room after it wasn't confirmed by the provider.`,
      bookingId: booking.id,
      roomId: booking.room_id,
      branchId: booking.branch_id,
      targetRole: 'receptionist',
    });

    return res.json({ room: updatedRoom });
  } catch (err) {
    console.error('Force end booking error:', err);
    return res.status(500).json({ error: 'Could not close this session.' });
  }
}

// --- Provider: the customer hasn't shown up. This does NOT cancel or free
// the room — a provider unilaterally ending someone else's booking isn't
// their call. It just alerts the front desk, who decide what happens next
// (put it on hold, chase the customer, or cancel it themselves). Only
// available once the confirmation window has actually run out (the same
// moment the automatic "pending timeout" alert already fires). ---
async function reportNoShow(req, res) {
  const { id } = req.params;
  try {
    const bookingRes = await db.query('SELECT * FROM bookings WHERE id = $1', [id]);
    const booking = bookingRes.rows[0];
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (booking.provider_id !== req.user.id) {
      return res.status(403).json({ error: 'This booking is not assigned to you.' });
    }
    if (booking.status !== 'pending') {
      return res.status(409).json({ error: 'This booking is not currently awaiting confirmation.' });
    }
    if (!booking.pending_notified) {
      return res.status(409).json({ error: 'The confirmation window hasn\u2019t run out yet.' });
    }

    await db.query(`UPDATE bookings SET no_show_reported_at = NOW() WHERE id = $1`, [id]);

    const updatedRoom = await refreshedRoom(booking.room_id);
    broadcastRoomUpdate(updatedRoom);

    await notify({
      type: 'provider_reported_no_show',
      message: `${req.user.name} says ${booking.customer_name} hasn't shown up yet. The room is still held for them — please follow up.`,
      bookingId: booking.id,
      roomId: booking.room_id,
      branchId: booking.branch_id,
      targetRole: 'receptionist',
    });

    return res.json({ room: updatedRoom });
  } catch (err) {
    console.error('Report no-show error:', err);
    return res.status(500).json({ error: 'Could not notify the front desk.' });
  }
}


async function holdBooking(req, res) {
  const { id } = req.params;
  try {
    const bookingRes = await db.query('SELECT * FROM bookings WHERE id = $1', [id]);
    const booking = bookingRes.rows[0];
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (booking.status !== 'pending') {
      return res.status(409).json({ error: 'Only a booking still awaiting confirmation can be put on hold.' });
    }

    await db.query(`UPDATE bookings SET status = 'on_hold', on_hold_at = NOW() WHERE id = $1`, [id]);
    await db.query(`UPDATE rooms SET status = 'inactive' WHERE id = $1`, [booking.room_id]);

    const updatedRoom = await refreshedRoom(booking.room_id);
    broadcastRoomUpdate(updatedRoom);

    logAudit(req, {
      action: 'Booking Put On Hold',
      entityType: 'booking',
      entityLabel: booking.customer_name,
      branchId: booking.branch_id,
    });

    await notify({
      type: 'booking_on_hold',
      message: `${req.user.name} put ${booking.customer_name}'s booking on hold — the room is free again while they wait to hear back.`,
      bookingId: booking.id,
      roomId: booking.room_id,
      branchId: booking.branch_id,
      targetRole: null, // admin-only visibility, for oversight
    });

    return res.json({ room: updatedRoom });
  } catch (err) {
    console.error('Hold booking error:', err);
    return res.status(500).json({ error: 'Could not put this booking on hold.' });
  }
}

// --- Receptionist/admin: the customer showed up after all — assign them a
// free room (doesn't have to be the same one) and resume waiting on the
// provider to confirm the start, without asking them to pay again ---
async function resumeBooking(req, res) {
  const { id } = req.params;
  const { roomId, providerId } = req.body;
  if (!roomId) return res.status(400).json({ error: 'Choose a free room to resume this booking into.' });

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const bookingRes = await client.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [id]);
    const booking = bookingRes.rows[0];
    if (!booking) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Booking not found.' });
    }
    if (booking.status !== 'on_hold') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This booking is not on hold.' });
    }

    const roomRes = await client.query('SELECT * FROM rooms WHERE id = $1 FOR UPDATE', [roomId]);
    const room = roomRes.rows[0];
    if (!room) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Room not found.' });
    }
    if (String(room.branch_id) !== String(booking.branch_id)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Choose a room at the same branch as this booking.' });
    }
    if (room.status !== 'inactive') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This room is currently occupied. Choose a free room.' });
    }
    const branchState = await client.query('SELECT is_active FROM branches WHERE id = $1', [room.branch_id]);
    if (!branchState.rowCount || !branchState.rows[0].is_active) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This branch is currently on maintenance and cannot accept new bookings.' });
    }

    // Same flexibility as a fresh booking — any free provider at this
    // branch can pick this back up, not just the room's usual one.
    const chosenProviderId = providerId || room.provider_id;
    if (!chosenProviderId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Choose a service provider to resume this booking.' });
    }
    const providerRes = await client.query(
      `SELECT u.*, EXISTS (
         SELECT 1 FROM bookings bk WHERE bk.provider_id = u.id AND bk.status IN ('pending', 'active') AND bk.id != $2
       ) AS is_busy
       FROM users u WHERE u.id = $1 AND u.role = 'provider' AND u.is_active = TRUE`,
      [chosenProviderId, id]
    );
    const provider = providerRes.rows[0];
    if (!provider) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'That provider was not found or is not active.' });
    }
    if (String(provider.branch_id) !== String(room.branch_id)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Choose a provider from the same branch as this room.' });
    }
    if (provider.is_busy) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `${provider.name} is currently with another customer. Choose someone else who's free.` });
    }

    await client.query(
      `UPDATE bookings SET
         room_id = $1, provider_id = $2, status = 'pending',
         pending_started_at = NOW(), pending_notified = FALSE, on_hold_at = NULL
       WHERE id = $3`,
      [room.id, provider.id, id]
    );
    await client.query(`UPDATE rooms SET status = 'pending' WHERE id = $1`, [room.id]);

    await client.query('COMMIT');

    logAudit(req, {
      action: 'Booking Resumed',
      entityType: 'booking',
      entityLabel: `${booking.customer_name} — ${room.name}`,
      branchId: room.branch_id,
    });

    const updatedRoom = await refreshedRoom(room.id);
    broadcastRoomUpdate(updatedRoom);

    return res.json({ room: updatedRoom });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Resume booking error:', err);
    return res.status(500).json({ error: 'Could not resume this booking.' });
  } finally {
    client.release();
  }
}

// --- Receptionist/admin: the delay never got resolved — give up the hold
// for good so the room and provider are completely free for new business ---
async function releaseBooking(req, res) {
  const { id } = req.params;
  const { reason } = req.body;
  try {
    const bookingRes = await db.query('SELECT * FROM bookings WHERE id = $1', [id]);
    const booking = bookingRes.rows[0];
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (booking.status !== 'on_hold') {
      return res.status(409).json({ error: 'This booking is not on hold.' });
    }

    await db.query(
      `UPDATE bookings SET status = 'cancelled', cancel_reason = $1, ended_at = NOW() WHERE id = $2`,
      [reason || 'Customer did not show up — released from hold.', id]
    );

    await notify({
      type: 'booking_released',
      message: `${req.user.name} released ${booking.customer_name}'s on-hold booking — it's fully cancelled now.`,
      bookingId: booking.id,
      branchId: booking.branch_id,
      targetRole: null, // admin-only visibility
    });

    logAudit(req, {
      action: 'Booking Released',
      entityType: 'booking',
      entityLabel: booking.customer_name,
      branchId: booking.branch_id,
    });

    return res.json({ message: 'Booking released.' });
  } catch (err) {
    console.error('Release booking error:', err);
    return res.status(500).json({ error: 'Could not release this booking.' });
  }
}

module.exports = {
  createBooking,
  confirmStart,
  confirmEnd,
  cancelBooking,
  addExtraService,
  cancelExtraServiceRequest,
  recordPayment,
  listBookings,
  forceEndBooking,
  holdBooking,
  resumeBooking,
  releaseBooking,
  reportNoShow,
};
