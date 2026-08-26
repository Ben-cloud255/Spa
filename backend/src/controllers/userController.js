const bcrypt = require('bcrypt');
const db = require('../config/db');

const USER_SELECT = `
  SELECT u.id, u.name, u.email, u.phone, u.role, u.branch_id, b.name AS branch_name,
         u.is_active, u.avatar_url, u.created_at
  FROM users u
  LEFT JOIN branches b ON b.id = u.branch_id
`;

async function listUsers(req, res) {
  try {
    const { role, branchId } = req.query;
    const clauses = [];
    const params = [];
    if (role) {
      params.push(role);
      clauses.push(`u.role = $${params.length}`);
    }
    if (branchId) {
      params.push(branchId);
      clauses.push(`u.branch_id = $${params.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await db.query(`${USER_SELECT} ${where} ORDER BY u.created_at DESC`, params);
    return res.json({ users: result.rows });
  } catch (err) {
    console.error('List users error:', err);
    return res.status(500).json({ error: 'Could not load staff accounts.' });
  }
}

async function createUser(req, res) {
  const { name, email, phone, password, role, branch_id } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Name, email, password and role are required.' });
  }
  if (!['receptionist', 'provider', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Role must be receptionist, provider, or admin.' });
  }
  if (role !== 'admin' && !branch_id) {
    return res.status(400).json({ error: 'Choose which branch this account belongs to.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  try {
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    const hash = await bcrypt.hash(password, 10);
    const result = await db.query(
      `INSERT INTO users (name, email, phone, password_hash, role, branch_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [name.trim(), email.trim().toLowerCase(), phone || null, hash, role, role === 'admin' ? null : branch_id]
    );
    const full = await db.query(`${USER_SELECT} WHERE u.id = $1`, [result.rows[0].id]);
    return res.status(201).json({ user: full.rows[0] });
  } catch (err) {
    console.error('Create user error:', err);
    return res.status(500).json({ error: 'Could not create the account.' });
  }
}

async function updateUser(req, res) {
  const { id } = req.params;
  const { name, phone, is_active, branch_id } = req.body;
  try {
    const result = await db.query(
      `UPDATE users SET
         name = COALESCE($1, name),
         phone = COALESCE($2, phone),
         is_active = COALESCE($3, is_active),
         branch_id = COALESCE($4, branch_id)
       WHERE id = $5 RETURNING id`,
      [name, phone, is_active, branch_id, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Account not found.' });
    }
    const full = await db.query(`${USER_SELECT} WHERE u.id = $1`, [id]);
    return res.json({ user: full.rows[0] });
  } catch (err) {
    console.error('Update user error:', err);
    return res.status(500).json({ error: 'Could not update the account.' });
  }
}

async function resetPassword(req, res) {
  const { id } = req.params;
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  }
  try {
    const hash = await bcrypt.hash(newPassword, 10);
    const result = await db.query('UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id', [hash, id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Account not found.' });
    }
    return res.json({ message: 'Password reset successfully.' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Could not reset the password.' });
  }
}

module.exports = { listUsers, createUser, updateUser, resetPassword };
