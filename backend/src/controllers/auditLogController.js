const db = require('../config/db');

async function listAuditLog(req, res) {
  const { branchId, from, to, search, action, role, before } = req.query;
  const limit = req.query.limit === undefined ? 50 : Number(req.query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 300 ||
      (branchId && (!Number.isSafeInteger(Number(branchId)) || Number(branchId) < 1)) ||
      (before && (!Number.isSafeInteger(Number(before)) || Number(before) < 1)) ||
      (from && !Number.isFinite(Date.parse(from))) || (to && !Number.isFinite(Date.parse(to))) ||
      (from && to && Date.parse(from) > Date.parse(to))) {
    return res.status(400).json({ error: 'Please check the dates and filter values.' });
  }
  try {
    const clauses = [], params = [];
    function add(sql, value) { params.push(value); clauses.push(sql.replace('?', `$${params.length}`)); }
    if (branchId) add('al.branch_id = ?', Number(branchId));
    if (from) add('al.created_at >= ?', from);
    if (to) add('al.created_at <= ?', to);
    if (before) add('al.id < ?', Number(before));
    if (action) add('al.action ILIKE ?', `%${String(action).slice(0, 150)}%`);
    if (role) add('al.actor_role = ?', String(role));
    if (search) add("concat_ws(' ', al.actor_name, al.action, al.entity_label, al.entity_type) ILIKE ?", `%${String(search).slice(0, 200)}%`);
    params.push(limit + 1);
    const result = await db.query(`SELECT al.id, al.actor_name, al.actor_role, al.action, al.entity_type, al.entity_label,
      al.created_at, br.name AS branch_name FROM audit_log al LEFT JOIN branches br ON br.id = al.branch_id
      ${clauses.length ? 'WHERE ' + clauses.join(' AND ') : ''} ORDER BY al.id DESC LIMIT $${params.length}`, params);
    const entries = result.rows.slice(0, limit);
    return res.json({ entries, hasMore: result.rows.length > limit, nextCursor: result.rows.length > limit ? entries.at(-1).id : null });
  } catch (err) {
    console.error('List audit log error:', err);
    return res.status(500).json({ error: 'Could not load the audit log.' });
  }
}
module.exports = { listAuditLog };
