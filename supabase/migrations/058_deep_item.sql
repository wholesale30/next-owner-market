-- The listing made from a deep report (owner, Oct 26, 2026), so the report links to it and isn't listed twice.
alter table deep_reports add column if not exists item_id uuid references items(id) on delete set null;
