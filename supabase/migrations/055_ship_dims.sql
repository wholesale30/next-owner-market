-- Shipping box size from real specs (owner, Oct 25, 2026): weight_lbs holds the packed shipping weight,
-- ship_l/w/h the box in inches, ship_source the spec page it came from.
alter table items add column if not exists ship_l numeric(6,1), add column if not exists ship_w numeric(6,1), add column if not exists ship_h numeric(6,1), add column if not exists ship_source text, add column if not exists ship_checked_at timestamptz;
