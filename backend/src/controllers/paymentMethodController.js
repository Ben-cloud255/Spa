const db = require('../config/db');

async function listPaymentMethods(req, res) {
  try {
    const { includeInactive } = req.query;
    const where = includeInactive ? '' : 'WHERE is_active = TRUE';
    const result = await db.query(`SELECT * FROM payment_methods ${where} ORDER BY name ASC`);
    return res.json({ paymentMethods: result.rows });
  } catch (err) {
    console.error('List payment methods error:', err);
    return res.status(500).json({ error: 'Could not load payment methods.' });
  }
}

async function createPaymentMethod(req, res) {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Payment method name is required.' });
  try {
    const result = await db.query(
      'INSERT INTO payment_methods (name) VALUES ($1) RETURNING *',
      [name.trim()]
    );
    return res.status(201).json({ paymentMethod: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A payment method with this name already exists.' });
    }
    console.error('Create payment method error:', err);
    return res.status(500).json({ error: 'Could not create the payment method.' });
  }
}

async function updatePaymentMethod(req, res) {
  const { id } = req.params;
  const { is_active } = req.body;
  try {
    const result = await db.query(
      'UPDATE payment_methods SET is_active = COALESCE($1, is_active) WHERE id = $2 RETURNING *',
      [is_active, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Payment method not found.' });
    return res.json({ paymentMethod: result.rows[0] });
  } catch (err) {
    console.error('Update payment method error:', err);
    return res.status(500).json({ error: 'Could not update the payment method.' });
  }
}

module.exports = { listPaymentMethods, createPaymentMethod, updatePaymentMethod };
