const db = require('../config/db');

/**
 * One search box across staff, rooms, services, branches, and payment
 * methods. Admin-only — these are all admin-managed lists. Each result
 * carries a `path` the frontend can navigate straight to, with a `focus`
 * query param the destination page uses to scroll to and highlight the
 * exact row, so "click it and it takes you right there" actually works
 * instead of just landing on the general list page.
 */
async function globalSearch(req, res) {
  const q = (req.query.q || '').trim();
  if (q.length < 2) {
    return res.json({ results: [] });
  }
  const like = `%${q}%`;

  try {
    const [users, rooms, services, branches, paymentMethods] = await Promise.all([
      db.query(
        `SELECT id, name, email, role FROM users
         WHERE name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1
         ORDER BY name ASC LIMIT 8`,
        [like]
      ),
      db.query(
        `SELECT r.id, r.name, br.name AS branch_name FROM rooms r
         LEFT JOIN branches br ON br.id = r.branch_id
         WHERE r.name ILIKE $1
         ORDER BY r.name ASC LIMIT 8`,
        [like]
      ),
      db.query(
        `SELECT s.id, s.name, sc.name AS category_name FROM services s
         LEFT JOIN service_categories sc ON sc.id = s.category_id
         WHERE s.name ILIKE $1
         ORDER BY s.name ASC LIMIT 8`,
        [like]
      ),
      db.query(
        `SELECT id, name, location FROM branches WHERE name ILIKE $1 ORDER BY name ASC LIMIT 8`,
        [like]
      ),
      db.query(
        `SELECT id, name FROM payment_methods WHERE name ILIKE $1 ORDER BY name ASC LIMIT 8`,
        [like]
      ),
    ]);

    const results = [
      ...users.rows.map((u) => ({
        type: 'Staff',
        id: u.id,
        label: u.name,
        subtitle: `${u.role.charAt(0).toUpperCase() + u.role.slice(1)} · ${u.email}`,
        path: `/admin/users?focus=${u.id}`,
      })),
      ...rooms.rows.map((r) => ({
        type: 'Room',
        id: r.id,
        label: r.name,
        subtitle: r.branch_name || 'No branch',
        path: `/admin/rooms?focus=${r.id}`,
      })),
      ...services.rows.map((s) => ({
        type: 'Service',
        id: s.id,
        label: s.name,
        subtitle: s.category_name || 'Other',
        path: `/admin/services?focus=${s.id}&category=${encodeURIComponent(s.category_name || 'Other')}`,
      })),
      ...branches.rows.map((b) => ({
        type: 'Branch',
        id: b.id,
        label: b.name,
        subtitle: b.location || '',
        path: `/admin/branches?focus=${b.id}`,
      })),
      ...paymentMethods.rows.map((p) => ({
        type: 'Payment method',
        id: p.id,
        label: p.name,
        subtitle: '',
        path: `/admin/payment-methods?focus=${p.id}`,
      })),
    ];

    return res.json({ results });
  } catch (err) {
    console.error('Global search error:', err);
    return res.status(500).json({ error: 'Search failed.' });
  }
}

module.exports = { globalSearch };
