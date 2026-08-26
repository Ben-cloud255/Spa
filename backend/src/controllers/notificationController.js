const db = require('../config/db');

async function listNotifications(req, res) {
  const { role, id: userId, branchId } = req.user;
  const { branchId: queryBranchId } = req.query;
  try {
    let sql;
    let params = [];
    if (role === 'admin') {
      if (queryBranchId) {
        sql = 'SELECT * FROM notifications WHERE branch_id = $1 ORDER BY created_at DESC LIMIT 200';
        params = [queryBranchId];
      } else {
        sql = 'SELECT * FROM notifications ORDER BY created_at DESC LIMIT 200';
      }
    } else {
      // Show anything sent to their whole role at their branch, plus anything
      // sent to them personally (e.g. "your session is ending soon").
      sql = `SELECT * FROM notifications
             WHERE branch_id = $1 AND (target_role = $2 OR target_user_id = $3)
             ORDER BY created_at DESC LIMIT 200`;
      params = [branchId, role, userId];
    }
    const result = await db.query(sql, params);
    return res.json({ notifications: result.rows });
  } catch (err) {
    console.error('List notifications error:', err);
    return res.status(500).json({ error: 'Could not load notifications.' });
  }
}

async function markRead(req, res) {
  const { id } = req.params;
  try {
    const result = await db.query('UPDATE notifications SET is_read = TRUE WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Notification not found.' });
    }
    return res.json({ notification: result.rows[0] });
  } catch (err) {
    console.error('Mark notification read error:', err);
    return res.status(500).json({ error: 'Could not update the notification.' });
  }
}

async function markAllRead(req, res) {
  const { role, id: userId, branchId } = req.user;
  try {
    if (role === 'admin') {
      await db.query('UPDATE notifications SET is_read = TRUE WHERE is_read = FALSE');
    } else {
      await db.query(
        `UPDATE notifications SET is_read = TRUE
         WHERE branch_id = $1 AND (target_role = $2 OR target_user_id = $3) AND is_read = FALSE`,
        [branchId, role, userId]
      );
    }
    return res.json({ message: 'All notifications marked as read.' });
  } catch (err) {
    console.error('Mark all read error:', err);
    return res.status(500).json({ error: 'Could not update notifications.' });
  }
}

module.exports = { listNotifications, markRead, markAllRead };
