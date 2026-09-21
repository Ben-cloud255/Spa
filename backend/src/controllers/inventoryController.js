const db = require('../config/db');
const { logAudit } = require('../utils/auditLog');
const { notify } = require('../utils/notify');

function validQuantity(value, zero = false) {
 const n = Number(value);
 return (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) && Number.isFinite(n) && (zero ? n >= 0 : n > 0) && n <= 9999999999.99 && Math.abs(n * 100 - Math.round(n * 100)) < 0.0001;
}
// --- Catalog: the list of item types that exist, independent of branch ---

async function listItems(req, res) {
  try {
    const { includeInactive } = req.query;
    const where = String(includeInactive) === 'true' ? '' : 'WHERE is_active = TRUE';
    const result = await db.query(
      `SELECT id, name, unit, minimum_stock, cost_per_unit, available_quantity, is_active, created_at
       FROM inventory_items ${where}
       ORDER BY name ASC`
    );
    return res.json({ items: result.rows });
  } catch (err) {
    console.error('List inventory items error:', err);
    return res.status(500).json({ error: 'Could not load the item catalog.' });
  }
}

async function createItem(req, res) {
  const { name, unit, minimumStock, costPerUnit, initialQuantity = 0 } = req.body;
  if (!validQuantity(initialQuantity, true)) return res.status(400).json({ error: 'Initial stock must be non-negative with up to two decimal places.' });
  if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'Item name is required.' });
  if (costPerUnit != null && costPerUnit !== '' && !validQuantity(costPerUnit, true)) return res.status(400).json({ error: 'Cost must be non-negative with up to two decimal places.' });
  try {
    const result = await db.query(
      `INSERT INTO inventory_items (name, unit, minimum_stock, cost_per_unit, available_quantity)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (lower(btrim(name)), cost_per_unit) DO UPDATE
       SET available_quantity = inventory_items.available_quantity + EXCLUDED.available_quantity,
           is_active = TRUE
       RETURNING id`,
      [name.trim(), unit || 'units', Number(minimumStock) || 0, costPerUnit == null || costPerUnit === '' ? null : Number(costPerUnit), Number(initialQuantity)]
    );
    logAudit(req, { action: 'Inventory Item Added', entityType: 'inventory_item', entityLabel: name.trim() });
    return res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    console.error('Create inventory item error:', err);
    return res.status(500).json({ error: 'Could not add this item.' });
  }
}

async function updateItem(req, res) {
  const { id } = req.params;
  const { name, unit, minimumStock, costPerUnit, isActive, quantityAdded } = req.body;
  try {
    if (quantityAdded !== undefined && !validQuantity(quantityAdded)) return res.status(400).json({ error: 'Stock to add must be positive with up to two decimal places.' });
    const sets = [];
    const values = [];
    let i = 1;
    if (quantityAdded !== undefined) { sets.push(`available_quantity = available_quantity + $${i++}`); values.push(Number(quantityAdded)); }
    if (name !== undefined) { sets.push(`name = $${i++}`); values.push(String(name).trim()); }
    if (unit !== undefined) { sets.push(`unit = $${i++}`); values.push(unit); }
    if (minimumStock !== undefined) { sets.push(`minimum_stock = $${i++}`); values.push(Number(minimumStock)); }
    if (costPerUnit !== undefined) { sets.push(`cost_per_unit = $${i++}`); values.push(costPerUnit === null ? null : Number(costPerUnit)); }
    if (isActive !== undefined) { sets.push(`is_active = $${i++}`); values.push(Boolean(isActive)); }
    if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update.' });

    values.push(id);
    const result = await db.query(`UPDATE inventory_items SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, values);
    if (!result.rowCount) return res.status(404).json({ error: 'Item not found.' });
    if (quantityAdded !== undefined) logAudit(req, { action: 'Central Stock Added', entityType: 'inventory_item', entityLabel: result.rows[0].name + ': +' + Number(quantityAdded) });
    return res.json({ item: result.rows[0] });
  } catch (err) {
    console.error('Update inventory item error:', err);
    return res.status(500).json({ error: 'Could not update this item.' });
  }
}

// --- Branch stock: how much of each item is currently sitting at a branch ---

async function listBranchStock(req, res) {
  try {
    const { branchId } = req.query;
    const params = [];
    let where = '';
    if (branchId) {
      params.push(branchId);
      where = `WHERE s.branch_id = $${params.length}`;
    }
    const result = await db.query(
      `SELECT s.id, s.item_id, i.name AS item_name, i.unit, i.minimum_stock, i.cost_per_unit,
              s.branch_id, br.name AS branch_name, s.quantity
       FROM inventory_branch_stock s
       JOIN inventory_items i ON i.id = s.item_id
       JOIN branches br ON br.id = s.branch_id
       ${where}
       ORDER BY br.name ASC, i.name ASC`,
      params
    );
    return res.json({ stock: result.rows });
  } catch (err) {
    console.error('List branch stock error:', err);
    return res.status(500).json({ error: 'Could not load branch stock.' });
  }
}

// --- Admin: record newly bought stock being handed to one or more branches ---

async function distribute(req, res) {
  const { itemId, note, allocations } = req.body;
  // allocations: [{ branchId, quantity }, ...] — one entry per branch this delivery is going to.
  if (!itemId || !Array.isArray(allocations) || allocations.length === 0) {
    return res.status(400).json({ error: 'Choose an item and at least one branch with a quantity.' });
  }
  for (const a of allocations) {
    if (!a || !a.branchId || !validQuantity(a.quantity)) {
      return res.status(400).json({ error: 'Every branch needs a positive quantity with up to two decimal places.' });
    }
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const itemRes = await client.query('SELECT * FROM inventory_items WHERE id = $1 FOR UPDATE', [itemId]);
    const item = itemRes.rows[0];
    if (!item) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Item not found.' });
    }

    const totalCents = allocations.reduce((sum, a) => sum + Math.round(Number(a.quantity) * 100), 0);
    if (!Number.isSafeInteger(totalCents) || totalCents > Math.round(Number(item.available_quantity) * 100)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Not enough stock available to assign. Available: ' + item.available_quantity + ' ' + item.unit + '.' });
    }
    await client.query('UPDATE inventory_items SET available_quantity = available_quantity - $1 WHERE id = $2', [totalCents / 100, itemId]);
    for (const a of allocations) {
      const qty = Number(a.quantity);
      await client.query(
        `INSERT INTO inventory_distributions (item_id, branch_id, quantity, note, recorded_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [itemId, a.branchId, qty, note || null, req.user.id]
      );
      await client.query(
        `INSERT INTO inventory_branch_stock (item_id, branch_id, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (item_id, branch_id) DO UPDATE SET quantity = inventory_branch_stock.quantity + EXCLUDED.quantity`,
        [itemId, a.branchId, qty]
      );
    }

    await client.query('COMMIT');

    const branchRes = await db.query('SELECT name FROM branches WHERE id = ANY($1::int[])', [allocations.map((a) => a.branchId)]);
    const branchNames = branchRes.rows.map((r) => r.name).join(', ');
    logAudit(req, {
      action: 'Stock Distributed',
      entityType: 'inventory_item',
      entityLabel: `${item.name} → ${branchNames}`,
    });

    return res.status(201).json({ message: 'Stock recorded.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Distribute inventory error:', err);
    return res.status(500).json({ error: 'Could not record this delivery.' });
  } finally {
    client.release();
  }
}

async function listDistributions(req, res) {
  try {
    const { branchId, limit } = req.query;
    const params = [];
    let where = '';
    if (branchId) {
      params.push(branchId);
      where = `WHERE d.branch_id = $${params.length}`;
    }
    params.push(Math.min(Number(limit) || 100, 300));
    const result = await db.query(
      `SELECT d.id, d.item_id, i.name AS item_name, i.unit, d.branch_id, br.name AS branch_name,
              d.quantity, d.note, d.recorded_by, u.name AS recorded_by_name, d.created_at
       FROM inventory_distributions d
       JOIN inventory_items i ON i.id = d.item_id
       JOIN branches br ON br.id = d.branch_id
       LEFT JOIN users u ON u.id = d.recorded_by
       ${where}
       ORDER BY d.created_at DESC
       LIMIT $${params.length}`,
      params
    );
    return res.json({ distributions: result.rows });
  } catch (err) {
    console.error('List distributions error:', err);
    return res.status(500).json({ error: 'Could not load the distribution history.' });
  }
}

// --- Receptionist: hand stock out of the branch stockroom into a room ---

async function assignToRoom(req, res) {
  const { itemId, roomId, quantity, note } = req.body;
  const qty = Number(quantity);
  if (!itemId || !roomId || !qty || qty <= 0) {
    return res.status(400).json({ error: 'Choose an item, a room, and a quantity greater than zero.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const roomRes = await client.query('SELECT * FROM rooms WHERE id = $1', [roomId]);
    const room = roomRes.rows[0];
    if (!room) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Room not found.' });
    }
    if (req.user.role !== 'admin' && String(room.branch_id) !== String(req.user.branchId)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'This room belongs to a different branch.' });
    }

    const stockRes = await client.query(
      'SELECT * FROM inventory_branch_stock WHERE item_id = $1 AND branch_id = $2 FOR UPDATE',
      [itemId, room.branch_id]
    );
    const stock = stockRes.rows[0];
    if (!stock || Number(stock.quantity) < qty) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Not enough stock at this branch. Available: ${stock ? stock.quantity : 0}.` });
    }

    await client.query(
      'UPDATE inventory_branch_stock SET quantity = quantity - $1 WHERE item_id = $2 AND branch_id = $3',
      [qty, itemId, room.branch_id]
    );
    const allocRes = await client.query(
      `INSERT INTO inventory_room_allocations (item_id, branch_id, room_id, quantity, note, assigned_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [itemId, room.branch_id, roomId, qty, note || null, req.user.id]
    );

    await client.query('COMMIT');

    const itemRes = await db.query('SELECT name, unit FROM inventory_items WHERE id = $1', [itemId]);
    logAudit(req, {
      action: 'Item Assigned To Room',
      entityType: 'inventory_room_allocation',
      entityLabel: `${qty} ${itemRes.rows[0]?.unit || ''} ${itemRes.rows[0]?.name || ''} → ${room.name}`,
      branchId: room.branch_id,
    });

    return res.status(201).json({ allocation: allocRes.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Assign inventory to room error:', err);
    return res.status(500).json({ error: 'Could not assign this item to the room.' });
  } finally {
    client.release();
  }
}

// --- Provider (or admin): mark a room's item as used up ---

async function completeAllocation(req, res) {
  const { id } = req.params;
  const { note, quantityReturned } = req.body;
  const returned = Number(quantityReturned) || 0;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const allocRes = await client.query('SELECT * FROM inventory_room_allocations WHERE id = $1 FOR UPDATE', [id]);
    const allocation = allocRes.rows[0];
    if (!allocation) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Allocation not found.' });
    }
    if (allocation.status !== 'in_use') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This item has already been marked as finished.' });
    }

    if (req.user.role === 'provider') {
      const roomRes = await client.query(
        `SELECT r.provider_id, b.provider_id AS active_booking_provider_id
         FROM rooms r
         LEFT JOIN bookings b ON b.room_id = r.id AND b.status IN ('pending', 'active')
         WHERE r.id = $1`,
        [allocation.room_id]
      );
      const roomRow = roomRes.rows[0];
      const isWorkingThisRoom =
        roomRow && (roomRow.provider_id === req.user.id || roomRow.active_booking_provider_id === req.user.id);
      if (!isWorkingThisRoom) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: "You're not currently assigned to this room." });
      }
    }

    if (returned > Number(allocation.quantity)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot return more than was assigned.' });
    }

    await client.query(
      `UPDATE inventory_room_allocations
       SET status = 'completed', completed_by = $1, completed_at = NOW(), completion_note = $2, quantity_returned = $3
       WHERE id = $4`,
      [req.user.id, note || null, returned, id]
    );

    if (returned > 0) {
      await client.query(
        `INSERT INTO inventory_branch_stock (item_id, branch_id, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (item_id, branch_id) DO UPDATE SET quantity = inventory_branch_stock.quantity + EXCLUDED.quantity`,
        [allocation.item_id, allocation.branch_id, returned]
      );
    }

    await client.query('COMMIT');

    const itemRes = await db.query('SELECT name FROM inventory_items WHERE id = $1', [allocation.item_id]);
    const roomRes = await db.query('SELECT name FROM rooms WHERE id = $1', [allocation.room_id]);
    logAudit(req, {
      action: 'Item Marked Finished',
      entityType: 'inventory_room_allocation',
      entityLabel: `${itemRes.rows[0]?.name || ''} in ${roomRes.rows[0]?.name || ''}`,
      branchId: allocation.branch_id,
    });

    await notify({
      type: 'inventory_item_finished',
      message: `${req.user.name || 'A provider'} marked ${itemRes.rows[0]?.name || 'an item'} as finished in ${roomRes.rows[0]?.name || 'a room'}. Quantity assigned: ${Number(allocation.quantity)}. Returned to stock: ${returned}.`,
      roomId: allocation.room_id,
      branchId: allocation.branch_id,
      targetRole: 'receptionist',
    });

    return res.json({ message: 'Marked as finished.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Complete inventory allocation error:', err);
    return res.status(500).json({ error: 'Could not mark this item as finished.' });
  } finally {
    client.release();
  }
}

async function listRoomAllocations(req, res) {
  try {
    const { branchId, roomId, status, limit } = req.query;
    const clauses = [];
    const params = [];
    if (branchId) { params.push(branchId); clauses.push(`a.branch_id = $${params.length}`); }
    if (roomId) { params.push(roomId); clauses.push(`a.room_id = $${params.length}`); }
    if (status) { params.push(status); clauses.push(`a.status = $${params.length}`); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    params.push(Math.min(Number(limit) || 200, 500));
    const result = await db.query(
      `SELECT a.id, a.item_id, i.name AS item_name, i.unit, a.branch_id, br.name AS branch_name,
              a.room_id, r.name AS room_name, a.quantity, a.note, a.status,
              a.assigned_by, au.name AS assigned_by_name, a.assigned_at,
              a.completed_by, cu.name AS completed_by_name, a.completed_at,
              a.completion_note, a.quantity_returned
       FROM inventory_room_allocations a
       JOIN inventory_items i ON i.id = a.item_id
       JOIN branches br ON br.id = a.branch_id
       JOIN rooms r ON r.id = a.room_id
       LEFT JOIN users au ON au.id = a.assigned_by
       LEFT JOIN users cu ON cu.id = a.completed_by
       ${where}
       ORDER BY a.assigned_at DESC
       LIMIT $${params.length}`,
      params
    );
    return res.json({ allocations: result.rows });
  } catch (err) {
    console.error('List room allocations error:', err);
    return res.status(500).json({ error: 'Could not load room item history.' });
  }
}

module.exports = {
  listItems,
  createItem,
  updateItem,
  listBranchStock,
  distribute,
  listDistributions,
  assignToRoom,
  completeAllocation,
  listRoomAllocations,
};
