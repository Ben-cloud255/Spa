BEGIN;
DROP INDEX IF EXISTS inventory_items_name_unique;
CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_name_cost_unique ON inventory_items (lower(btrim(name)), cost_per_unit) NULLS NOT DISTINCT;
COMMIT;

