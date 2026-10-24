-- Sold on Facebook (Oct 24, 2026): Claude in Chrome found the old ad marked Sold (or Sold and shipped). Never deleted, never reposted; the item is marked sold here.
alter table items add column if not exists fb_sold_seen_at timestamptz;
