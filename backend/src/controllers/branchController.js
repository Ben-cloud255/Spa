const db = require('../config/db');
const { logAudit } = require('../utils/auditLog');

async function listBranches(req, res) {
  try {
    const includeInactive = req.user?.role === 'admin' && String(req.query.includeInactive) === 'true';
    const where = includeInactive ? '' : 'WHERE is_active = TRUE';
    const result = await db.query(`SELECT * FROM branches ${where} ORDER BY name ASC`);
    return res.json({ branches: result.rows });
  } catch (err) {
    console.error('List branches error:', err);
    return res.status(500).json({ error: 'Could not load branches.' });
  }
}

async function createBranch(req, res) {
  const { name, location } = req.body;
  if (!name) return res.status(400).json({ error: 'Branch name is required.' });
  try {
    const result = await db.query(
      'INSERT INTO branches (name, location, is_active) VALUES ($1, $2, TRUE) RETURNING *',
      [name.trim(), location || null]
    );
    return res.status(201).json({ branch: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A branch with this name already exists.' });
    console.error('Create branch error:', err);
    return res.status(500).json({ error: 'Could not create the branch.' });
  }
}

async function updateBranch(req, res) {
  const { id } = req.params;
  const { name, location, is_active } = req.body;
  if (is_active === undefined && name === undefined && location === undefined) {
    return res.status(400).json({ error: 'Nothing to update.' });
  }
  try {
    const current = await db.query('SELECT * FROM branches WHERE id = $1', [id]);
    if (!current.rowCount) return res.status(404).json({ error: 'Branch not found.' });

    if (is_active === false) {
      const activeBooking = await db.query(
        `SELECT id FROM bookings WHERE branch_id = $1 AND status IN ('pending', 'active') LIMIT 1`,
        [id]
      );
      if (activeBooking.rowCount) {
        return res.status(409).json({ error: 'This branch has an active or pending room session. End or move it before putting the branch on maintenance.' });
      }
    }

    const sets = [];
    const values = [];
    let i = 1;
    if (name !== undefined) { sets.push(`name = $${i++}`); values.push(String(name).trim()); }
    if (location !== undefined) { sets.push(`location = $${i++}`); values.push(location || null); }
    if (is_active !== undefined) { sets.push(`is_active = $${i++}`); values.push(Boolean(is_active)); }
    values.push(id);
    const result = await db.query(
      `UPDATE branches SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );

    if (is_active !== undefined) {
      logAudit(req, {
        action: is_active ? 'Branch Restored' : 'Branch Archived',
        entityType: 'branch',
        entityLabel: result.rows[0].name,
        branchId: result.rows[0].id,
      });
    }

    return res.json({ branch: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A branch with this name already exists.' });
    console.error('Update branch error:', err);
    return res.status(500).json({ error: 'Could not update the branch.' });
  }
}

module.exports = { listBranches, createBranch, updateBranch };
