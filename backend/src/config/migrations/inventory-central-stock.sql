-- Run once before deploying the updated inventory code. Safe to rerun.
-- Existing stock already assigned to branches is not changed.
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS available_quantity NUMERIC(12,2)
  NOT NULL DEFAULT 0 CHECK (available_quantity >= 0);
