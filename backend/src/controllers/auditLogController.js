const db = require('../config/db');

async function listAuditLog(req, res) {
  try {
    const { branchId, from, to, limit } = req.query;
    const clauses = [];
    const params = [];
    if (branchId) {
      params.push(branchId);
      clauses.push(`branch_id = $${params.length}`);
    }
    if (from) {
      params.push(from);
      clauses.push(`al.created_at >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      clauses.push(`al.created_at <= $${params.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    params.push(Math.min(Number(limit) || 100, 300));
    const result = await db.query(
      `SELECT al.id, al.actor_name, al.actor_role, al.action, al.entity_type, al.entity_label,
              al.created_at, br.name AS branch_name
       FROM audit_log al
       LEFT JOIN branches br ON br.id = al.branch_id
       ${where}
       ORDER BY al.created_at DESC
       LIMIT $${params.length}`,
      params
    );
    return res.json({ entries: result.rows });
  } catch (err) {
    console.error('List audit log error:', err);
    return res.status(500).json({ error: 'Could not load the audit log.' });
  }
}

module.exports = { listAuditLog };
