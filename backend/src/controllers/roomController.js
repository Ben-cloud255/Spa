const db = require('../config/db');
const { logAudit } = require('../utils/auditLog');

const ROOM_SELECT = `
  SELECT
    r.id, r.name, r.status, r.image_url, r.is_archived, r.created_at,
    r.provider_id, p.name AS provider_name,
    r.branch_id, br.name AS branch_name,
    b.id AS booking_id, b.customer_name, b.customer_phone,
    b.status AS booking_status, b.pending_started_at, b.active_started_at, b.pending_notified,
    b.no_show_reported_at,
    b.expected_end_at, b.extended_minutes, b.payment_status, b.amount_due, b.amount_paid,
    b.pending_addon_minutes, b.pending_addon_price, pa.name AS pending_addon_name,
    b.provider_id AS booking_provider_id, bp.name AS booking_provider_name,
    s.id AS service_id, s.name AS service_name, s.duration_minutes AS service_duration
  FROM rooms r
  LEFT JOIN users p ON p.id = r.provider_id
  LEFT JOIN branches br ON br.id = r.branch_id
  LEFT JOIN bookings b ON b.room_id = r.id AND b.status IN ('pending', 'active', 'awaiting_payment')
  LEFT JOIN users bp ON bp.id = b.provider_id
  LEFT JOIN services s ON s.id = b.service_id
  LEFT JOIN services pa ON pa.id = b.pending_addon_service_id
`;

function shapeRoom(row) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    imageUrl: row.image_url,
    isArchived: row.is_archived,
    branch: row.branch_id ? { id: row.branch_id, name: row.branch_name } : null,
    provider: row.provider_id ? { id: row.provider_id, name: row.provider_name } : null,
    currentBooking: row.booking_id
      ? {
          id: row.booking_id,
          customerName: row.customer_name,
          customerPhone: row.customer_phone,
          status: row.booking_status,
          pendingStartedAt: row.pending_started_at,
          pendingNotified: row.pending_notified,
          noShowReportedAt: row.no_show_reported_at,
          activeStartedAt: row.active_started_at,
          expectedEndAt: row.expected_end_at,
          extendedMinutes: row.extended_minutes,
          paymentStatus: row.payment_status,
          amountDue: row.amount_due,
          amountPaid: row.amount_paid,
          provider: row.booking_provider_id ? { id: row.booking_provider_id, name: row.booking_provider_name } : null,
          service: { id: row.service_id, name: row.service_name, durationMinutes: row.service_duration },
          pendingAddon: row.pending_addon_name
            ? { name: row.pending_addon_name, minutes: row.pending_addon_minutes, price: row.pending_addon_price }
            : null,
        }
      : null,
  };
}

async function listRooms(req, res) {
  try {
    const { role, branchId } = req.user;
    const { branchId: queryBranchId, includeArchived } = req.query;

    const params = [];
    const clauses = [];

    if (!includeArchived) {
      clauses.push('r.is_archived = FALSE');
    }

    if (role === 'admin') {
      // Admin can look at one branch at a time, or leave it off to see all of them.
      if (queryBranchId) {
        params.push(queryBranchId);
        clauses.push(`r.branch_id = $${params.length}`);
      }
    } else {
      // Receptionists and providers only ever see rooms in their own active branch.
      params.push(branchId);
      clauses.push(`r.branch_id = $${params.length}`);
      clauses.push('EXISTS (SELECT 1 FROM branches active_branch WHERE active_branch.id = r.branch_id AND active_branch.is_active = TRUE)');
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const sql = `${ROOM_SELECT} ${where} ORDER BY br.name ASC, r.name ASC`;
    const result = await db.query(sql, params);
    return res.json({ rooms: result.rows.map(shapeRoom) });
  } catch (err) {
    console.error('List rooms error:', err);
    return res.status(500).json({ error: 'Could not load rooms.' });
  }
}

async function getRoom(req, res) {
  try {
    const result = await db.query(`${ROOM_SELECT} WHERE r.id = $1`, [req.params.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Room not found.' });
    }
    return res.json({ room: shapeRoom(result.rows[0]) });
  } catch (err) {
    console.error('Get room error:', err);
    return res.status(500).json({ error: 'Could not load the room.' });
  }
}

async function validateProviderBranch(providerId, branchId) {
  if (!providerId) return null;
  const result = await db.query('SELECT branch_id FROM users WHERE id = $1 AND role = $2', [providerId, 'provider']);
  if (result.rowCount === 0) return 'That provider account was not found.';
  if (branchId && result.rows[0].branch_id && String(result.rows[0].branch_id) !== String(branchId)) {
    return 'That provider is assigned to a different branch.';
  }
  return null;
}

async function createRoom(req, res) {
  const { name, provider_id, image_url, branch_id } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Room name is required.' });
  }
  if (!branch_id) {
    return res.status(400).json({ error: 'Choose which branch this room belongs to.' });
  }
  try {
    const providerError = await validateProviderBranch(provider_id, branch_id);
    if (providerError) return res.status(400).json({ error: providerError });

    const result = await db.query(
      `INSERT INTO rooms (name, provider_id, image_url, branch_id) VALUES ($1, $2, $3, $4) RETURNING id`,
      [name.trim(), provider_id || null, image_url || null, branch_id]
    );
    const full = await db.query(`${ROOM_SELECT} WHERE r.id = $1`, [result.rows[0].id]);
    return res.status(201).json({ room: shapeRoom(full.rows[0]) });
  } catch (err) {
    console.error('Create room error:', err);
    return res.status(500).json({ error: 'Could not create the room.' });
  }
}

async function updateRoom(req, res) {
  const { id } = req.params;
  const { name, image_url, branch_id, is_archived } = req.body;
  // Distinguish "the request didn't mention provider_id" (leave it alone) from
  // "the request explicitly set provider_id to null" (clear it) — a plain
  // COALESCE can't tell those apart, which was silently ignoring "Unassigned".
  const hasProviderField = Object.prototype.hasOwnProperty.call(req.body, 'provider_id');
  const provider_id = hasProviderField ? req.body.provider_id : undefined;

  try {
    const current = await db.query('SELECT branch_id, status FROM rooms WHERE id = $1', [id]);
    if (current.rowCount === 0) {
      return res.status(404).json({ error: 'Room not found.' });
    }
    const effectiveBranch = branch_id || current.rows[0].branch_id;

    if (hasProviderField && provider_id) {
      const providerError = await validateProviderBranch(provider_id, effectiveBranch);
      if (providerError) return res.status(400).json({ error: providerError });
    }
    if (is_archived === true && current.rows[0].status !== 'inactive') {
      return res.status(409).json({ error: 'Free this room (no pending or active session) before removing it.' });
    }

    const sets = [];
    const values = [];
    let i = 1;
    if (name !== undefined) {
      sets.push(`name = $${i++}`);
      values.push(name);
    }
    if (hasProviderField) {
      sets.push(`provider_id = $${i++}`);
      values.push(provider_id || null);
    }
    if (image_url !== undefined) {
      sets.push(`image_url = $${i++}`);
      values.push(image_url);
    }
    if (branch_id !== undefined) {
      sets.push(`branch_id = $${i++}`);
      values.push(branch_id);
    }
    if (is_archived !== undefined) {
      sets.push(`is_archived = $${i++}`);
      values.push(is_archived);
    }

    if (sets.length === 0) {
      return res.status(400).json({ error: 'Nothing to update.' });
    }

    values.push(id);
    const result = await db.query(`UPDATE rooms SET ${sets.join(', ')} WHERE id = $${i} RETURNING id`, values);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Room not found.' });
    }
    const full = await db.query(`${ROOM_SELECT} WHERE r.id = $1`, [id]);
    const shaped = shapeRoom(full.rows[0]);

    if (hasProviderField && provider_id) {
      logAudit(req, {
        action: 'Provider Assigned',
        entityType: 'room',
        entityLabel: `${shaped.name} → ${shaped.provider?.name || 'provider'}`,
        branchId: shaped.branch?.id || null,
      });
    }

    return res.json({ room: shaped });
  } catch (err) {
    console.error('Update room error:', err);
    return res.status(500).json({ error: 'Could not update the room.' });
  }
}

// Rooms are never hard-deleted — they're referenced by booking history (needed
// for reports), so "removing" a room archives it instead. It stops appearing
// anywhere staff can book it, but past bookings and revenue stay intact.
async function archiveRoom(req, res) {
  const { id } = req.params;
  try {
    const current = await db.query('SELECT name, branch_id, status FROM rooms WHERE id = $1', [id]);
    if (current.rowCount === 0) {
      return res.status(404).json({ error: 'Room not found.' });
    }
    if (current.rows[0].status !== 'inactive') {
      return res.status(409).json({
        error: 'This room still has a pending or active session. End it first, then remove the room.',
      });
    }
    await db.query('UPDATE rooms SET is_archived = TRUE WHERE id = $1', [id]);
    logAudit(req, {
      action: 'Room Removed',
      entityType: 'room',
      entityLabel: current.rows[0].name,
      branchId: current.rows[0].branch_id,
    });
    return res.json({ message: 'Room removed.' });
  } catch (err) {
    console.error('Archive room error:', err);
    return res.status(500).json({ error: 'Could not remove the room.' });
  }
}

module.exports = { listRooms, getRoom, createRoom, updateRoom, archiveRoom, shapeRoom, ROOM_SELECT };
