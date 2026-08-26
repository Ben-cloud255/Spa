const bcrypt = require('bcrypt');
const { pool } = require('./db');
require('dotenv').config();

const SALT_ROUNDS = 10;

const BRANCHES = [
  { name: 'Dar es Salaam', location: 'Dar es Salaam' },
  { name: 'Dodoma', location: 'Dodoma' },
  { name: 'Arusha', location: 'Arusha' },
];

// One receptionist per branch — placeholder names, renameable from Admin later.
const RECEPTIONISTS = [
  { name: 'Dar es Salaam Reception', email: 'reception.dar@serenespa.com', phone: '+255700000001', password: 'Reception123!', branch: 'Dar es Salaam' },
  { name: 'Dodoma Reception', email: 'reception.dodoma@serenespa.com', phone: '+255700000002', password: 'Reception123!', branch: 'Dodoma' },
  { name: 'Arusha Reception', email: 'reception.arusha@serenespa.com', phone: '+255700000003', password: 'Reception123!', branch: 'Arusha' },
];

// Placeholder staff names — the client can rename these later from the Admin panel.
// Distributed roughly evenly across the three branches.
const PROVIDERS = [
  { name: 'Amina Juma', email: 'amina.juma@serenespa.com', phone: '+255700000101', branch: 'Dar es Salaam' },
  { name: 'Grace Mwangi', email: 'grace.mwangi@serenespa.com', phone: '+255700000102', branch: 'Dar es Salaam' },
  { name: 'John Kamau', email: 'john.kamau@serenespa.com', phone: '+255700000103', branch: 'Dar es Salaam' },
  { name: 'Fatuma Ali', email: 'fatuma.ali@serenespa.com', phone: '+255700000104', branch: 'Dodoma' },
  { name: 'David Mushi', email: 'david.mushi@serenespa.com', phone: '+255700000105', branch: 'Dodoma' },
  { name: 'Neema Joseph', email: 'neema.joseph@serenespa.com', phone: '+255700000106', branch: 'Dodoma' },
  { name: 'Peter Otieno', email: 'peter.otieno@serenespa.com', phone: '+255700000107', branch: 'Arusha' },
  { name: 'Halima Said', email: 'halima.said@serenespa.com', phone: '+255700000108', branch: 'Arusha' },
];
const PROVIDER_PASSWORD = 'Provider123!';

// Room names — themed after the spa's calm, natural identity.
// 4 rooms per branch, 12 total.
const ROOM_NAMES_BY_BRANCH = {
  'Dar es Salaam': ['Lotus Room', 'Jasmine Room', 'Serenity Room', 'Tranquil Room'],
  'Dodoma': ['Orchid Room', 'Bliss Room', 'Harmony Room', 'Zen Room'],
  'Arusha': ['Amber Room', 'Ivory Room', 'Coral Room', 'Palm Room'],
};

// Categories group similar treatments (mainly the many kinds of massage) so
// the booking dropdown stays short even as the menu grows.
const CATEGORIES = ['Massage'];

const SERVICES = [
  { name: 'Full Body Massage', description: 'A complete head-to-toe relaxation massage.', duration_minutes: 90, price: 60000, category: 'Massage' },
  { name: 'Swedish Massage', description: 'Gentle, flowing strokes to ease tension.', duration_minutes: 60, price: 45000, category: 'Massage' },
  { name: 'Deep Tissue Massage', description: 'Firm pressure targeting deep muscle knots.', duration_minutes: 60, price: 50000, category: 'Massage' },
  { name: 'Hot Stone Massage', description: 'Heated stones to melt away stiffness.', duration_minutes: 75, price: 65000, category: 'Massage' },
  { name: 'Aromatherapy Massage', description: 'Essential oils paired with a calming massage.', duration_minutes: 60, price: 55000, category: 'Massage' },
  { name: 'Foot Reflexology', description: 'Pressure-point therapy focused on the feet.', duration_minutes: 45, price: 35000, category: null },
  { name: 'Facial Treatment', description: 'Deep cleanse, exfoliation and hydration for the face.', duration_minutes: 45, price: 40000, category: null },
  { name: 'Body Scrub', description: 'Full-body exfoliation leaving skin renewed.', duration_minutes: 50, price: 42000, category: null },
  { name: 'Couples Massage', description: 'A side-by-side massage for two.', duration_minutes: 90, price: 110000, category: 'Massage' },
  { name: 'Head & Shoulder Massage', description: 'A focused release for the upper body.', duration_minutes: 30, price: 25000, category: 'Massage' },
  { name: 'Prenatal Massage', description: 'A gentle massage adapted for expectant mothers.', duration_minutes: 60, price: 55000, category: 'Massage' },
  { name: 'Sports Massage', description: 'Targeted work for recovery and mobility.', duration_minutes: 60, price: 50000, category: 'Massage' },
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // --- Branches ---
    const branchIdByName = {};
    for (const b of BRANCHES) {
      const existing = await client.query('SELECT id FROM branches WHERE name = $1', [b.name]);
      if (existing.rowCount === 0) {
        const res = await client.query(
          'INSERT INTO branches (name, location) VALUES ($1, $2) RETURNING id',
          [b.name, b.location]
        );
        branchIdByName[b.name] = res.rows[0].id;
      } else {
        branchIdByName[b.name] = existing.rows[0].id;
      }
    }
    console.log(`Seeded ${BRANCHES.length} branch(es): ${BRANCHES.map((b) => b.name).join(', ')}`);

    // --- Admin (no branch — sees everything across all branches) ---
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@serenespa.com';
    const adminExists = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    if (adminExists.rowCount === 0) {
      const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'ChangeMe123!', SALT_ROUNDS);
      await client.query(
        `INSERT INTO users (name, email, phone, password_hash, role, branch_id) VALUES ($1, $2, $3, $4, 'admin', NULL)`,
        [process.env.ADMIN_NAME || 'Admin', adminEmail, '+255700000000', hash]
      );
      console.log(`Admin account created: ${adminEmail}`);
    } else {
      console.log('Admin account already exists, skipping.');
    }

    // --- Receptionists (one per branch) ---
    for (const r of RECEPTIONISTS) {
      const exists = await client.query('SELECT id FROM users WHERE email = $1', [r.email]);
      if (exists.rowCount === 0) {
        const hash = await bcrypt.hash(r.password, SALT_ROUNDS);
        await client.query(
          `INSERT INTO users (name, email, phone, password_hash, role, branch_id) VALUES ($1, $2, $3, $4, 'receptionist', $5)`,
          [r.name, r.email, r.phone, hash, branchIdByName[r.branch]]
        );
      }
    }
    console.log(`Seeded ${RECEPTIONISTS.length} receptionist account(s), one per branch.`);

    // --- Service providers ---
    const providerIdsByBranch = { 'Dar es Salaam': [], Dodoma: [], Arusha: [] };
    for (const p of PROVIDERS) {
      const exists = await client.query('SELECT id FROM users WHERE email = $1', [p.email]);
      let providerId;
      if (exists.rowCount === 0) {
        const hash = await bcrypt.hash(PROVIDER_PASSWORD, SALT_ROUNDS);
        const res = await client.query(
          `INSERT INTO users (name, email, phone, password_hash, role, branch_id) VALUES ($1, $2, $3, $4, 'provider', $5) RETURNING id`,
          [p.name, p.email, p.phone, hash, branchIdByName[p.branch]]
        );
        providerId = res.rows[0].id;
      } else {
        providerId = exists.rows[0].id;
        // Keep branch assignment in sync if this seed re-runs after a branch was added.
        await client.query('UPDATE users SET branch_id = COALESCE(branch_id, $1) WHERE id = $2', [
          branchIdByName[p.branch],
          providerId,
        ]);
      }
      providerIdsByBranch[p.branch].push(providerId);
    }
    console.log(`Seeded ${PROVIDERS.length} service provider account(s) across ${BRANCHES.length} branches.`);

    // --- Rooms (4 per branch, each assigned a provider from that branch) ---
    let roomCount = 0;
    for (const branchName of Object.keys(ROOM_NAMES_BY_BRANCH)) {
      const roomNames = ROOM_NAMES_BY_BRANCH[branchName];
      const providerIds = providerIdsByBranch[branchName];
      for (let i = 0; i < roomNames.length; i++) {
        const exists = await client.query('SELECT id FROM rooms WHERE name = $1 AND branch_id = $2', [
          roomNames[i],
          branchIdByName[branchName],
        ]);
        if (exists.rowCount === 0) {
          const providerId = providerIds[i % providerIds.length];
          await client.query(
            `INSERT INTO rooms (name, status, provider_id, branch_id) VALUES ($1, 'inactive', $2, $3)`,
            [roomNames[i], providerId, branchIdByName[branchName]]
          );
          roomCount++;
        }
      }
    }
    console.log(`Seeded ${roomCount} new room(s) (4 per branch).`);

    // --- Service categories ---
    const categoryIdByName = {};
    for (const name of CATEGORIES) {
      const exists = await client.query('SELECT id FROM service_categories WHERE name = $1', [name]);
      if (exists.rowCount === 0) {
        const res = await client.query('INSERT INTO service_categories (name) VALUES ($1) RETURNING id', [name]);
        categoryIdByName[name] = res.rows[0].id;
      } else {
        categoryIdByName[name] = exists.rows[0].id;
      }
    }
    console.log(`Seeded ${CATEGORIES.length} service categor${CATEGORIES.length === 1 ? 'y' : 'ies'}.`);

    // --- Services (shared across all branches) ---
    for (const s of SERVICES) {
      const exists = await client.query('SELECT id FROM services WHERE name = $1', [s.name]);
      const categoryId = s.category ? categoryIdByName[s.category] : null;
      if (exists.rowCount === 0) {
        await client.query(
          `INSERT INTO services (name, description, duration_minutes, price, category_id) VALUES ($1, $2, $3, $4, $5)`,
          [s.name, s.description, s.duration_minutes, s.price, categoryId]
        );
      } else {
        // Keep category assignment in sync if this seed re-runs after categories were added.
        await client.query('UPDATE services SET category_id = COALESCE(category_id, $1) WHERE id = $2', [
          categoryId,
          exists.rows[0].id,
        ]);
      }
    }
    console.log(`Seeded ${SERVICES.length} service(s), shared across all branches.`);

    await client.query('COMMIT');
    console.log('\nSeeding complete.');
    console.log('--------------------------------------------------');
    console.log(`Admin login (all branches): ${adminEmail} / ${process.env.ADMIN_PASSWORD || 'ChangeMe123!'}`);
    for (const r of RECEPTIONISTS) {
      console.log(`Receptionist (${r.branch}): ${r.email} / ${r.password}`);
    }
    console.log(`All service providers use the password: ${PROVIDER_PASSWORD}`);
    console.log('--------------------------------------------------');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
