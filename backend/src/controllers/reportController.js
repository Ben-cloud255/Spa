const db = require('../config/db');

// Receptionists only ever get their own branch's numbers — admins can pick
// any branch or leave it off to see everything combined.
function resolveBranchId(req) {
  const { role, branchId } = req.user;
  if (role === 'admin') return req.query.branchId || null;
  return branchId;
}

/**
 * A single flexible endpoint: give it any from/to range (the frontend builds
 * that range from "Today" / "This week" / "This month" / "This year" presets
 * or a custom date picker — "any duration") and an optional branch. Booking
 * counts/expected revenue are based on when the booking was created;
 * collected revenue is based on when payments actually landed, so a "today"
 * report reflects money that came in today, not just sessions booked today.
 */
async function getSummary(req, res) {
  const { from, to } = req.query;
  if (!from || !to) {
    return res.status(400).json({ error: 'Provide both a from and to date.' });
  }
  const branchId = resolveBranchId(req);

  const branchClause = branchId ? 'AND b.branch_id = $3' : '';
  const params = branchId ? [from, to, branchId] : [from, to];

  try {
    const bookingsResult = await db.query(
      `SELECT b.id, b.status, b.amount_due, b.branch_id, br.name AS branch_name,
              b.service_id, s.name AS service_name, b.provider_id, u.name AS provider_name, b.created_at
       FROM bookings b
       JOIN services s ON s.id = b.service_id
       JOIN users u ON u.id = b.provider_id
       LEFT JOIN branches br ON br.id = b.branch_id
       WHERE b.created_at >= $1 AND b.created_at <= $2 ${branchClause}
       ORDER BY b.created_at ASC`,
      params
    );
    const bookings = bookingsResult.rows;

    const paymentsResult = await db.query(
      `SELECT p.amount, p.created_at, b.branch_id, br.name AS branch_name
       FROM payments p
       JOIN bookings b ON b.id = p.booking_id
       LEFT JOIN branches br ON br.id = b.branch_id
       WHERE p.created_at >= $1 AND p.created_at <= $2 ${branchClause}`,
      params
    );
    const payments = paymentsResult.rows;

    const revenueCollected = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const revenueExpected = bookings
      .filter((b) => b.status !== 'cancelled')
      .reduce((sum, b) => sum + Number(b.amount_due), 0);

    const totals = {
      bookingsCount: bookings.length,
      completedCount: bookings.filter((b) => b.status === 'completed').length,
      cancelledCount: bookings.filter((b) => b.status === 'cancelled').length,
      activeOrPendingCount: bookings.filter((b) => ['pending', 'active', 'awaiting_payment'].includes(b.status)).length,
      revenueCollected,
      revenueExpected,
      revenueOutstanding: Math.max(0, revenueExpected - revenueCollected),
    };

    // --- by branch ---
    const branchMap = new Map();
    const branchKey = (id) => (id === null || id === undefined ? 'unassigned' : String(id));
    for (const b of bookings) {
      const key = branchKey(b.branch_id);
      if (!branchMap.has(key)) {
        branchMap.set(key, {
          branchId: b.branch_id,
          branchName: b.branch_name || 'Unassigned',
          bookingsCount: 0,
          revenueExpected: 0,
          revenueCollected: 0,
        });
      }
      const row = branchMap.get(key);
      row.bookingsCount += 1;
      if (b.status !== 'cancelled') row.revenueExpected += Number(b.amount_due);
    }
    for (const p of payments) {
      const key = branchKey(p.branch_id);
      if (!branchMap.has(key)) {
        branchMap.set(key, {
          branchId: p.branch_id,
          branchName: p.branch_name || 'Unassigned',
          bookingsCount: 0,
          revenueExpected: 0,
          revenueCollected: 0,
        });
      }
      branchMap.get(key).revenueCollected += Number(p.amount);
    }
    const byBranch = [...branchMap.values()].sort((a, b) => b.revenueCollected - a.revenueCollected);

    // --- by service ---
    const serviceMap = new Map();
    for (const b of bookings) {
      if (!serviceMap.has(b.service_id)) {
        serviceMap.set(b.service_id, {
          serviceId: b.service_id,
          serviceName: b.service_name,
          bookingsCount: 0,
          revenueExpected: 0,
        });
      }
      const row = serviceMap.get(b.service_id);
      row.bookingsCount += 1;
      if (b.status !== 'cancelled') row.revenueExpected += Number(b.amount_due);
    }
    const byService = [...serviceMap.values()].sort((a, b) => b.bookingsCount - a.bookingsCount);

    // --- by provider ---
    const providerMap = new Map();
    for (const b of bookings) {
      if (!providerMap.has(b.provider_id)) {
        providerMap.set(b.provider_id, {
          providerId: b.provider_id,
          providerName: b.provider_name,
          bookingsCount: 0,
          sessionsCompleted: 0,
        });
      }
      const row = providerMap.get(b.provider_id);
      row.bookingsCount += 1;
      if (b.status === 'completed') row.sessionsCompleted += 1;
    }
    const byProvider = [...providerMap.values()].sort((a, b) => b.sessionsCompleted - a.sessionsCompleted);

    // --- collected revenue by day (for a simple bar chart) ---
    const dayMap = new Map();
    for (const p of payments) {
      const day = new Date(p.created_at).toISOString().slice(0, 10);
      dayMap.set(day, (dayMap.get(day) || 0) + Number(p.amount));
    }
    // Include every calendar day in the selected period, including zero-revenue
    // days. This makes the report honest and keeps the chart spacing consistent.
    const startDay = new Date(from);
    const endDay = new Date(to);
    const byDay = [];
    for (const cursor = new Date(startDay); cursor <= endDay; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const date = cursor.toISOString().slice(0, 10);
      byDay.push({ date, revenueCollected: dayMap.get(date) || 0 });
    }

    return res.json({ range: { from, to }, totals, byBranch, byService, byProvider, byDay });
  } catch (err) {
    console.error('Report summary error:', err);
    return res.status(500).json({ error: 'Could not generate the report.' });
  }
}

/**
 * Booking-level detail for the period — one row per customer/booking, with
 * any extra services they added folded in. This is what backs both the
 * "bookings in this period" table on the report and the CSV export, so a
 * receptionist or admin can actually see who the customers were, not just
 * aggregate totals.
 */
async function getDetail(req, res) {
  const { from, to } = req.query;
  if (!from || !to) {
    return res.status(400).json({ error: 'Provide both a from and to date.' });
  }
  const branchId = resolveBranchId(req);

  const branchClause = branchId ? 'AND b.branch_id = $3' : '';
  const params = branchId ? [from, to, branchId] : [from, to];

  try {
    const result = await db.query(
      `SELECT b.id, b.customer_name, b.customer_phone, b.status, b.amount_due, b.amount_paid,
              b.payment_status, b.extended_minutes, b.created_at,
              br.name AS branch_name, s.name AS service_name, r.name AS room_name,
              u.name AS provider_name, rec.name AS receptionist_name,
              COALESCE(
                (SELECT string_agg(s2.name || ' (+' || ba.added_minutes || ' min)', ', ' ORDER BY ba.created_at)
                 FROM booking_addons ba JOIN services s2 ON s2.id = ba.service_id
                 WHERE ba.booking_id = b.id),
                ''
              ) AS extra_services
       FROM bookings b
       JOIN services s ON s.id = b.service_id
       JOIN rooms r ON r.id = b.room_id
       JOIN users u ON u.id = b.provider_id
       JOIN users rec ON rec.id = b.receptionist_id
       LEFT JOIN branches br ON br.id = b.branch_id
       WHERE b.created_at >= $1 AND b.created_at <= $2 ${branchClause}
       ORDER BY b.created_at ASC`,
      params
    );
    return res.json({ bookings: result.rows });
  } catch (err) {
    console.error('Report detail error:', err);
    return res.status(500).json({ error: 'Could not load the detailed report.' });
  }
}

module.exports = { getSummary, getDetail };
