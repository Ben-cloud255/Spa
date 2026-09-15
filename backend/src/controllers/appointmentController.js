const db = require('../config/db');
const { notify, broadcastRoomUpdate } = require('../utils/notify');
const { shapeRoom, ROOM_SELECT } = require('./roomController');

// --- Public: anyone on the website can submit a booking request ---
async function createAppointment(req, res) {
  const { customerName, customerPhone, customerEmail, branchId, serviceId, preferredDate, preferredTime, notes } = req.body;

  if (!customerName || !customerPhone || !branchId || !serviceId || !preferredDate) {
    return res.status(400).json({ error: 'Please fill in your name, phone, branch, service, and preferred date.' });
  }

  const chosenDate = new Date(preferredDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (Number.isNaN(chosenDate.getTime()) || chosenDate < today) {
    return res.status(400).json({ error: 'Choose today or a future date.' });
  }

  try {
    const branchRes = await db.query('SELECT id, name FROM branches WHERE id = $1', [branchId]);
    if (branchRes.rowCount === 0) return res.status(404).json({ error: 'That branch was not found.' });

    const serviceRes = await db.query('SELECT id, name FROM services WHERE id = $1 AND is_active = TRUE', [serviceId]);
    if (serviceRes.rowCount === 0) return res.status(404).json({ error: 'That service was not found.' });

    const result = await db.query(
      `INSERT INTO appointments
         (customer_name, customer_phone, customer_email, branch_id, service_id, preferred_date, preferred_time, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        customerName.trim(),
        customerPhone.trim(),
        customerEmail ? customerEmail.trim() : null,
        branchId,
        serviceId,
        preferredDate,
        preferredTime || null,
        notes ? notes.trim() : null,
      ]
    );
    const appointment = result.rows[0];

    await notify({
      type: 'appointment_requested',
      message: `${appointment.customer_name} requested ${serviceRes.rows[0].name} on ${preferredDate}${
        preferredTime ? ` (${preferredTime})` : ''
      } via the website.`,
      branchId,
      targetRole: 'receptionist',
    });

    return res.status(201).json({ appointment, referenceCode: `APT-${appointment.id}` });
  } catch (err) {
    console.error('Create appointment error:', err);
    return res.status(500).json({ error: 'Could not submit your booking request. Please try again.' });
  }
}

// --- Staff: view booking requests for their branch (admin sees all/filters) ---
async function listAppointments(req, res) {
  const { role, branchId } = req.user;
  const { status, branchId: queryBranchId } = req.query;

  const clauses = [];
  const params = [];
  if (role === 'admin') {
    if (queryBranchId) {
      params.push(queryBranchId);
      clauses.push(`a.branch_id = $${params.length}`);
    }
  } else {
    params.push(branchId);
    clauses.push(`a.branch_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    clauses.push(`a.status = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  try {
    const result = await db.query(
      `SELECT a.*, br.name AS branch_name, s.name AS service_name, s.duration_minutes, s.price
       FROM appointments a
       JOIN branches br ON br.id = a.branch_id
       JOIN services s ON s.id = a.service_id
       ${where}
       ORDER BY a.preferred_date ASC, a.created_at ASC`,
      params
    );
    return res.json({ appointments: result.rows });
  } catch (err) {
    console.error('List appointments error:', err);
    return res.status(500).json({ error: 'Could not load booking requests.' });
  }
}

async function confirmAppointment(req, res) {
  const { id } = req.params;
  try {
    const result = await db.query(
      `UPDATE appointments SET status = 'confirmed' WHERE id = $1 AND status = 'requested' RETURNING *`,
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(409).json({ error: 'This request can no longer be confirmed.' });
    }
    return res.json({ appointment: result.rows[0] });
  } catch (err) {
    console.error('Confirm appointment error:', err);
    return res.status(500).json({ error: 'Could not confirm this request.' });
  }
}

async function cancelAppointment(req, res) {
  const { id } = req.params;
  try {
    const result = await db.query(
      `UPDATE appointments SET status = 'cancelled' WHERE id = $1 AND status IN ('requested', 'confirmed') RETURNING *`,
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(409).json({ error: 'This request can no longer be cancelled.' });
    }
    return res.json({ appointment: result.rows[0] });
  } catch (err) {
    console.error('Cancel appointment error:', err);
    return res.status(500).json({ error: 'Could not cancel this request.' });
  }
}

// --- Receptionist/admin: the customer has arrived — assign a real room ---
// This does exactly what a normal walk-in booking does (see bookingController
// .createBooking), then links the resulting booking back to the appointment.
async function checkInAppointment(req, res) {
  const { id } = req.params;
  const { roomId, providerId, amountPaid, paymentMethod } = req.body;
  if (!roomId) {
    return res.status(400).json({ error: 'Choose a free room to check the customer into.' });
  }
  const paidNum = Number(amountPaid);
  if (!amountPaid || Number.isNaN(paidNum) || paidNum <= 0) {
    return res.status(400).json({ error: 'Collect payment before checking the customer in.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const apptRes = await client.query('SELECT * FROM appointments WHERE id = $1 FOR UPDATE', [id]);
    const appt = apptRes.rows[0];
    if (!appt) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Booking request not found.' });
    }
    if (!['requested', 'confirmed'].includes(appt.status)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This request has already been handled.' });
    }

    const roomRes = await client.query('SELECT * FROM rooms WHERE id = $1 FOR UPDATE', [roomId]);
    const room = roomRes.rows[0];
    if (!room) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Room not found.' });
    }
    if (String(room.branch_id) !== String(appt.branch_id)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Choose a room at the same branch as the request.' });
    }
    if (room.status !== 'inactive') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This room is currently occupied. Choose a free room.' });
    }

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

    const serviceRes = await client.query('SELECT * FROM services WHERE id = $1', [appt.service_id]);
    const service = serviceRes.rows[0];

    if (paidNum < Number(service.price)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Full payment is required before check-in. This service costs ${service.price}.`,
      });
    }

    const bookingRes = await client.query(
      `INSERT INTO bookings
         (customer_name, customer_phone, service_id, room_id, provider_id, receptionist_id, branch_id,
          amount_due, amount_paid, payment_status, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'paid', 'pending') RETURNING *`,
      [appt.customer_name, appt.customer_phone, service.id, room.id, provider.id, req.user.id, room.branch_id, service.price, paidNum]
    );

    await client.query(
      `INSERT INTO payments (booking_id, amount, method, recorded_by) VALUES ($1, $2, $3, $4)`,
      [bookingRes.rows[0].id, paidNum, paymentMethod || 'cash', req.user.id]
    );

    await client.query(`UPDATE rooms SET status = 'pending' WHERE id = $1`, [room.id]);
    await client.query(`UPDATE appointments SET status = 'completed', converted_booking_id = $1 WHERE id = $2`, [
      bookingRes.rows[0].id,
      id,
    ]);

    await client.query('COMMIT');

    const full = await db.query(`${ROOM_SELECT} WHERE r.id = $1`, [room.id]);
    const updatedRoom = shapeRoom(full.rows[0]);
    broadcastRoomUpdate(updatedRoom);

    return res.json({ room: updatedRoom, booking: bookingRes.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Check-in appointment error:', err);
    return res.status(500).json({ error: 'Could not check this customer in.' });
  } finally {
    client.release();
  }
}

module.exports = { createAppointment, listAppointments, confirmAppointment, cancelAppointment, checkInAppointment };
