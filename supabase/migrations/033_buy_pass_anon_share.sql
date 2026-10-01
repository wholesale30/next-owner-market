-- Buy or Pass: signed-out checks, share cards, list-it. Applied live Oct 1, 2026.
alter table public.buy_pass_scans alter column owner_id drop not null;
alter table public.buy_pass_scans add column if not exists best_place text, add column if not exists listing_title text, add column if not exists shared boolean not null default false;
