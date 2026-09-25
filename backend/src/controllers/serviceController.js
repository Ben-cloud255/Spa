const db = require('../config/db');
const { logAudit } = require('../utils/auditLog');

const SERVICE_SELECT = `
  SELECT s.*, c.name AS category_name, b.name AS branch_name
  FROM services s
  LEFT JOIN service_categories c ON c.id = s.category_id
  LEFT JOIN branches b ON b.id = s.branch_id
`;

async function listServices(req, res) {
  try {
    const { includeInactive, branchId: queryBranchId } = req.query;
    // Signed-in staff (other than admin) only ever see their own branch's
    // menu; admin and the public site can pass ?branchId= explicitly, or
    // leave it off to see everything.
    const forcedBranchId = req.user && req.user.role !== 'admin' ? req.user.branchId : null;
    const effectiveBranchId = forcedBranchId || queryBranchId || null;

    const clauses = [];
    const params = [];
    if (!includeInactive) clauses.push('s.is_active = TRUE');
    if (effectiveBranchId) {
      params.push(effectiveBranchId);
      clauses.push(`(s.branch_id IS NULL OR s.branch_id = $${params.length})`);
      if (req.user && req.user.role !== 'admin') {
        clauses.push('EXISTS (SELECT 1 FROM branches active_branch WHERE active_branch.id = COALESCE(s.branch_id, $' + params.length + ') AND active_branch.is_active = TRUE)');
      }
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const result = await db.query(`${SERVICE_SELECT} ${where} ORDER BY c.name ASC NULLS LAST, s.name ASC`, params);
    return res.json({ services: result.rows });
  } catch (err) {
    console.error('List services error:', err);
    return res.status(500).json({ error: 'Could not load services.' });
  }
}

async function createService(req, res) {
  const { name, description, duration_minutes, price, category_id, branch_id } = req.body;
  if (!name || !duration_minutes) {
    return res.status(400).json({ error: 'Service name and duration are required.' });
  }
  try {
    const result = await db.query(
      `INSERT INTO services (name, description, duration_minutes, price, category_id, branch_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [name.trim(), description || null, duration_minutes, price || 0, category_id || null, branch_id || null]
    );
    const full = await db.query(`${SERVICE_SELECT} WHERE s.id = $1`, [result.rows[0].id]);
    await logAudit(req, { action: 'Service created', entityType: 'service', entityLabel: `${full.rows[0].name} · ${full.rows[0].price} TZS · ${full.rows[0].duration_minutes} min`, branchId: full.rows[0].branch_id });
    return res.status(201).json({ service: full.rows[0] });
  } catch (err) {
    console.error('Create service error:', err);
    return res.status(500).json({ error: 'Could not create the service.' });
  }
}

async function updateService(req, res) {
  const { id } = req.params;
  const { name, description, duration_minutes, price, is_active } = req.body;
  // branch_id/category_id need to distinguish "not sent" (leave alone) from
  // "explicitly set to null" (e.g. switching a service back to All branches
  // or No category) — a plain COALESCE can't tell those apart.
  const hasBranchField = Object.prototype.hasOwnProperty.call(req.body, 'branch_id');
  const hasCategoryField = Object.prototype.hasOwnProperty.call(req.body, 'category_id');

  try {
    const previous = await db.query('SELECT * FROM services WHERE id = $1', [id]);
    if (!previous.rows.length) return res.status(404).json({ error: 'Service not found.' });
    const sets = [];
    const values = [];
    let i = 1;
    if (name !== undefined) { sets.push(`name = $${i++}`); values.push(name); }
    if (description !== undefined) { sets.push(`description = $${i++}`); values.push(description); }
    if (duration_minutes !== undefined) { sets.push(`duration_minutes = $${i++}`); values.push(duration_minutes); }
    if (price !== undefined) { sets.push(`price = $${i++}`); values.push(price); }
    if (is_active !== undefined) { sets.push(`is_active = $${i++}`); values.push(is_active); }
    if (hasBranchField) { sets.push(`branch_id = $${i++}`); values.push(req.body.branch_id || null); }
    if (hasCategoryField) { sets.push(`category_id = $${i++}`); values.push(req.body.category_id || null); }

    if (sets.length === 0) {
      return res.status(400).json({ error: 'Nothing to update.' });
    }

    values.push(id);
    const result = await db.query(`UPDATE services SET ${sets.join(', ')} WHERE id = $${i} RETURNING id`, values);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Service not found.' });
    }
    const full = await db.query(`${SERVICE_SELECT} WHERE s.id = $1`, [id]);
    const current = full.rows[0];
    const labels = { name: 'Name', duration_minutes: 'Duration (min)', price: 'Price (TZS)', is_active: 'Available', category_id: 'Category ID', branch_id: 'Branch ID' };
    const changes = Object.entries(labels).filter(([key]) => Object.prototype.hasOwnProperty.call(req.body, key) && String(previous.rows[0][key]) !== String(current[key])).map(([key, label]) => `${label}: ${previous.rows[0][key] ?? 'None'} → ${current[key] ?? 'None'}`);
    if (Object.prototype.hasOwnProperty.call(req.body, 'description') && previous.rows[0].description !== current.description) changes.push('Description updated');
    if (changes.length) await logAudit(req, { action: 'Service updated', entityType: 'service', entityLabel: `${current.name} · ${changes.join('; ')}`, branchId: current.branch_id });
    return res.json({ service: current });
  } catch (err) {
    console.error('Update service error:', err);
    return res.status(500).json({ error: 'Could not update the service.' });
  }
}

module.exports = { listServices, createService, updateService };
