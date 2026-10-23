-- When the ad first went up on Facebook (from the owner's selling page), so the line-up can go oldest first (Oct 23, 2026).
alter table items add column if not exists fb_listed_at timestamptz;
