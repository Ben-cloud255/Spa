const bcrypt = require('bcrypt');
const db = require('../config/db');
const { signToken } = require('../utils/jwt');
const { logAudit } = require('../utils/auditLog');

const USER_WITH_BRANCH_SELECT = `
  SELECT u.id, u.name, u.email, u.phone, u.password_hash, u.role, u.branch_id, u.is_active, u.avatar_url,
         b.name AS branch_name
  FROM users u
  LEFT JOIN branches b ON b.id = u.branch_id
`;

async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const result = await db.query(`${USER_WITH_BRANCH_SELECT} WHERE u.email = $1`, [email.trim().toLowerCase()]);

    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'This account has been deactivated. Contact the admin.' });
    }
    if (user.role !== 'admin' && user.branch_id) {
      const branchState = await db.query('SELECT is_active FROM branches WHERE id = $1', [user.branch_id]);
      if (branchState.rowCount && !branchState.rows[0].is_active) {
        return res.status(403).json({ error: 'This branch is temporarily on maintenance. Please contact the admin.' });
      }
    }

    const matches = await bcrypt.compare(password, user.password_hash);
    if (!matches) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    const token = signToken(user);
    delete user.password_hash;

    logAudit(req, {
      action: 'Signed In',
      entityType: 'user',
      entityLabel: `${user.name} (${user.role})`,
      branchId: user.branch_id,
      actor: user,
    });

    return res.json({ token, user });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Something went wrong while logging in.' });
  }
}

async function me(req, res) {
  try {
    const result = await db.query(`${USER_WITH_BRANCH_SELECT} WHERE u.id = $1`, [req.user.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const user = result.rows[0];
    delete user.password_hash;
    return res.json({ user });
  } catch (err) {
    console.error('Fetch profile error:', err);
    return res.status(500).json({ error: 'Something went wrong while fetching your profile.' });
  }
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  }

  try {
    const result = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    const matches = await bcrypt.compare(currentPassword, user.password_hash);
    if (!matches) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
    return res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ error: 'Something went wrong while updating your password.' });
  }
}

module.exports = { login, me, changePassword };
