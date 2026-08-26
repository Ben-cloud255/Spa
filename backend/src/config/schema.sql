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
