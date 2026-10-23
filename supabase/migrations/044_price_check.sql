-- Price check (Oct 23, 2026): real-comps pricing per item (top / list / fast / floor, hold-or-dump) for the owner's Prices page.
alter table items add column if not exists price_check jsonb;
alter table items add column if not exists price_checked_at timestamptz;
