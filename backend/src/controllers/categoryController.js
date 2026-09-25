const db = require('../config/db');
const { logAudit } = require('../utils/auditLog');

async function listCategories(req, res) {
  try {
    const result = await db.query('SELECT * FROM service_categories WHERE is_active = TRUE ORDER BY name ASC');
    return res.json({ categories: result.rows });
  } catch (err) {
    console.error('List categories error:', err);
    return res.status(500).json({ error: 'Could not load service categories.' });
  }
}

async function createCategory(req, res) {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Category name is required.' });
  try {
    const result = await db.query(
      'INSERT INTO service_categories (name) VALUES ($1) RETURNING *',
      [name.trim()]
    );
    await logAudit(req, { action: 'Category created', entityType: 'service_category', entityLabel: result.rows[0].name });
    return res.status(201).json({ category: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A category with this name already exists.' });
    }
    console.error('Create category error:', err);
    return res.status(500).json({ error: 'Could not create the category.' });
  }
}

async function removeCategory(req, res) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid category.' });
  try {
    // The category foreign key uses ON DELETE SET NULL: services and their
    // historical references remain intact and appear under Other.
    const result = await db.query('DELETE FROM service_categories WHERE id = $1 RETURNING id, name', [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Category not found.' });
    await logAudit(req, { action: 'Category removed', entityType: 'service_category', entityLabel: `${result.rows[0].name} — services moved to Other` });
    return res.json({ success: true });
  } catch (err) {
    console.error('Remove category error:', err);
    return res.status(500).json({ error: 'Could not remove the category.' });
  }
}

module.exports = { listCategories, createCategory, removeCategory };
