-- Serene Spa Management System — PostgreSQL schema
-- Safe to re-run: existing installs picking up the multi-branch update just
-- get the new table + columns added via the ALTER ... ADD COLUMN IF NOT EXISTS
-- statements below; nothing here drops or rewrites existing data.

CREATE TABLE IF NOT EXISTS branches (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(80) NOT NULL UNIQUE,
  location    VARCHAR(160),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);
ALTER TABLE branches ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(160) UNIQUE NOT NULL,
  phone         VARCHAR(40),
  password_hash VARCHAR(200) NOT NULL,
  role          VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'receptionist', 'provider')),
  branch_id     INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS payment_methods (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(60) NOT NULL UNIQUE,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_categories (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(80) NOT NULL UNIQUE,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS services (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(120) NOT NULL,
  description      TEXT,
  duration_minutes INTEGER NOT NULL,
  price            NUMERIC(10, 2) NOT NULL DEFAULT 0,
  category_id      INTEGER REFERENCES service_categories(id) ON DELETE SET NULL,
  branch_id        INTEGER REFERENCES branches(id) ON DELETE SET NULL, -- NULL = offered at every branch
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE services ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES service_categories(id) ON DELETE SET NULL;
ALTER TABLE services ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;

-- A service with branch_id = NULL is offered everywhere; set it to one branch
-- to make it exclusive to that location. Grouping similar treatments (e.g.
-- every kind of massage) under one category keeps the booking dropdown short
-- even as the menu grows.

CREATE TABLE IF NOT EXISTS rooms (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(80) NOT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'inactive' CHECK (status IN ('inactive', 'pending', 'active')),
  provider_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  branch_id    INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  is_archived  BOOLEAN NOT NULL DEFAULT FALSE,
  image_url    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS bookings (
  id                  SERIAL PRIMARY KEY,
  customer_name       VARCHAR(120) NOT NULL,
  customer_phone      VARCHAR(40) NOT NULL,
  service_id          INTEGER NOT NULL REFERENCES services(id),
  room_id             INTEGER NOT NULL REFERENCES rooms(id),
  provider_id         INTEGER NOT NULL REFERENCES users(id),
  receptionist_id     INTEGER NOT NULL REFERENCES users(id),
  branch_id           INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'active', 'completed', 'cancelled', 'on_hold')),
  amount_due          NUMERIC(10, 2) NOT NULL DEFAULT 0,
  amount_paid         NUMERIC(10, 2) NOT NULL DEFAULT 0,
  payment_status      VARCHAR(20) NOT NULL DEFAULT 'unpaid'
                        CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
  pending_started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  active_started_at   TIMESTAMPTZ,
  expected_end_at      TIMESTAMPTZ,
  ended_at            TIMESTAMPTZ,
  extended_minutes    INTEGER NOT NULL DEFAULT 0,
  pending_notified    BOOLEAN NOT NULL DEFAULT FALSE,
  overtime_notified   BOOLEAN NOT NULL DEFAULT FALSE,
  warning_notified    BOOLEAN NOT NULL DEFAULT FALSE,
  on_hold_at          TIMESTAMPTZ,
  cancel_reason       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS warning_notified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS on_hold_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS no_show_reported_at TIMESTAMPTZ;
-- An extra service a provider requests after the original session already
-- ended sits here, unapplied, until the receptionist collects full payment
-- for it — see 'awaiting_payment' below. Cleared back to NULL once applied
-- (timer started) or the request is cancelled.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pending_addon_service_id INTEGER REFERENCES services(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pending_addon_minutes INTEGER;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pending_addon_price NUMERIC(10, 2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pending_addon_requested_by INTEGER REFERENCES users(id);
-- Widen the status check to allow 'on_hold' (and 'awaiting_payment') on
-- databases created before those existed.
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('pending', 'active', 'completed', 'cancelled', 'on_hold', 'awaiting_payment'));

CREATE TABLE IF NOT EXISTS booking_addons (
  id            SERIAL PRIMARY KEY,
  booking_id    INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  service_id    INTEGER NOT NULL REFERENCES services(id),
  added_minutes INTEGER NOT NULL,
  price         NUMERIC(10, 2) NOT NULL DEFAULT 0,
  requested_by  INTEGER REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id           SERIAL PRIMARY KEY,
  booking_id   INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount       NUMERIC(10, 2) NOT NULL,
  method       VARCHAR(30) NOT NULL DEFAULT 'cash',
  recorded_by  INTEGER REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id             SERIAL PRIMARY KEY,
  type           VARCHAR(40) NOT NULL,
  message        TEXT NOT NULL,
  booking_id     INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
  room_id        INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
  branch_id      INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  target_role    VARCHAR(20), -- NULL means visible to admin only in addition to explicit target; admin always sees all
  target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- for alerts meant for one specific person
  is_read        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Online booking requests submitted from the public website. These are
-- *requests* for a future date/time, not a live room assignment — front desk
-- staff confirm them and "check the customer in" (assigning a real room) once
-- they arrive, which creates a normal `bookings` row.
CREATE TABLE IF NOT EXISTS appointments (
  id                   SERIAL PRIMARY KEY,
  customer_name        VARCHAR(120) NOT NULL,
  customer_phone       VARCHAR(40) NOT NULL,
  customer_email       VARCHAR(160),
  branch_id            INTEGER NOT NULL REFERENCES branches(id),
  service_id           INTEGER NOT NULL REFERENCES services(id),
  preferred_date       DATE NOT NULL,
  preferred_time       VARCHAR(20), -- e.g. "Morning", "Afternoon", "Evening"
  notes                TEXT,
  status               VARCHAR(20) NOT NULL DEFAULT 'requested'
                         CHECK (status IN ('requested', 'confirmed', 'completed', 'cancelled')),
  converted_booking_id INTEGER REFERENCES bookings(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_branch ON appointments(branch_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_room ON bookings(room_id);
CREATE INDEX IF NOT EXISTS idx_bookings_provider ON bookings(provider_id);
CREATE INDEX IF NOT EXISTS idx_bookings_branch ON bookings(branch_id);
CREATE INDEX IF NOT EXISTS idx_rooms_branch ON rooms(branch_id);
CREATE INDEX IF NOT EXISTS idx_users_branch ON users(branch_id);
CREATE INDEX IF NOT EXISTS idx_notifications_role ON notifications(target_role);
CREATE INDEX IF NOT EXISTS idx_notifications_branch ON notifications(branch_id);
CREATE INDEX IF NOT EXISTS idx_notifications_target_user ON notifications(target_user_id);

-- One row per device/browser a staff member has enabled phone alerts on.
-- A person can have several (phone + tablet, etc.) — all get pushed to.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category_id);
CREATE INDEX IF NOT EXISTS idx_services_branch ON services(branch_id);

-- Inventory tracking, redesigned around how stock actually moves through
-- the business:
--   1. inventory_items is a branch-independent catalog (name/unit/minimum/cost).
--   2. inventory_branch_stock holds how much of each item currently sits at
--      each branch, ready to be handed out.
--   3. inventory_distributions is a permanent log of the admin recording
--      newly bought stock being handed to a branch (or several branches at
--      once — one row per branch). Each row also bumps branch_stock.
--   4. inventory_room_allocations is a permanent log of a receptionist
--      taking stock out of the branch stockroom and into a specific room
--      for a service ('in_use'), and later the provider (or admin) marking
--      it used up ('completed'), with a note and any amount returned.
-- There is deliberately no automatic consumption tied to bookings — every
-- movement of stock is something a person explicitly recorded.
CREATE TABLE IF NOT EXISTS inventory_items (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(120) NOT NULL,
  unit             VARCHAR(30) NOT NULL DEFAULT 'units',
  minimum_stock    NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost_per_unit    NUMERIC(12,2),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_branch_stock (
  id          SERIAL PRIMARY KEY,
  item_id     INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  branch_id   INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  quantity    NUMERIC(12,2) NOT NULL DEFAULT 0,
  UNIQUE (item_id, branch_id)
);
CREATE INDEX IF NOT EXISTS idx_inv_branch_stock_branch ON inventory_branch_stock(branch_id);
CREATE INDEX IF NOT EXISTS idx_inv_branch_stock_item ON inventory_branch_stock(item_id);

CREATE TABLE IF NOT EXISTS inventory_distributions (
  id             SERIAL PRIMARY KEY,
  item_id        INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  branch_id      INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  quantity       NUMERIC(12,2) NOT NULL,
  note           TEXT,
  recorded_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inv_distributions_branch ON inventory_distributions(branch_id);

CREATE TABLE IF NOT EXISTS inventory_room_allocations (
  id                 SERIAL PRIMARY KEY,
  item_id            INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  branch_id          INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  room_id            INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  quantity           NUMERIC(12,2) NOT NULL,
  note               TEXT,
  status             VARCHAR(20) NOT NULL DEFAULT 'in_use',
  assigned_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  completed_at       TIMESTAMPTZ,
  completion_note    TEXT,
  quantity_returned  NUMERIC(12,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_inv_allocations_room ON inventory_room_allocations(room_id);
CREATE INDEX IF NOT EXISTS idx_inv_allocations_branch ON inventory_room_allocations(branch_id);
CREATE INDEX IF NOT EXISTS idx_inv_allocations_status ON inventory_room_allocations(status);

-- One-time migration off the old single-branch-per-item model: carry
-- existing current_stock/branch_id values over into inventory_branch_stock,
-- then drop the old columns. Guarded so re-running this file after the
-- columns are already gone is a no-op.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_items' AND column_name = 'current_stock'
  ) THEN
    INSERT INTO inventory_branch_stock (item_id, branch_id, quantity)
    SELECT id, branch_id, current_stock FROM inventory_items
    WHERE branch_id IS NOT NULL AND current_stock <> 0
    ON CONFLICT (item_id, branch_id) DO UPDATE SET quantity = inventory_branch_stock.quantity + EXCLUDED.quantity;

    ALTER TABLE inventory_items DROP COLUMN current_stock;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_items' AND column_name = 'branch_id'
  ) THEN
    DROP INDEX IF EXISTS idx_inventory_items_branch;
    ALTER TABLE inventory_items DROP COLUMN branch_id;
  END IF;
END $$;

-- A running record of every action worth being able to answer "who did
-- this and when" about. actor_name/actor_role are stored as plain text
-- (not just a user_id FK) so the log still reads correctly even if that
-- staff account is later deactivated or removed.
CREATE TABLE IF NOT EXISTS audit_log (
  id            SERIAL PRIMARY KEY,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_name    VARCHAR(120) NOT NULL,
  actor_role    VARCHAR(20) NOT NULL,
  action        VARCHAR(60) NOT NULL,
  entity_type   VARCHAR(40) NOT NULL,
  entity_label  VARCHAR(160) NOT NULL,
  branch_id     INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_branch ON audit_log(branch_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);

-- Central stock awaiting distribution; existing branch balances stay unchanged.
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS available_quantity NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (available_quantity >= 0);

BEGIN;
DROP INDEX IF EXISTS inventory_items_name_unique;
CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_name_cost_unique ON inventory_items (lower(btrim(name)), cost_per_unit) NULLS NOT DISTINCT;
COMMIT;

