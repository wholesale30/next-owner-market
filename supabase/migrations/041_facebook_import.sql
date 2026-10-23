-- Facebook import + relist queue (Oct 23, 2026): old Marketplace ads brought into the app, rewritten, with fresh photo order.
-- fb_old_url = the old ad (delete it first), fb_relisted_at = when he reposted it.
alter table items add column if not exists fb_old_url text;
alter table items add column if not exists fb_relisted_at timestamptz;
create index if not exists items_fb_relist_idx on items (created_at) where fb_old_url is not null and fb_relisted_at is null;
