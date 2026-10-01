-- Thrift Pro ($3.99/mo, unlimited checks) and Buy or Pass share pages. Applied live Oct 1, 2026.
alter table public.profiles add column if not exists thrift_pro boolean not null default false, add column if not exists thrift_subscription_id text, add column if not exists thrift_renews_at timestamptz;
alter table public.buy_pass_scans add column if not exists why text, add column if not exists condition_guess text, add column if not exists watch_out text, add column if not exists ship_or_local text, add column if not exists valuation_slug text;
