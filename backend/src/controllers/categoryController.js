const db = require('../config/db');

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
    return res.status(201).json({ category: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A category with this name already exists.' });
    }
    console.error('Create category error:', err);
    return res.status(500).json({ error: 'Could not create the category.' });
  }
}

module.exports = { listCategories, createCategory };
