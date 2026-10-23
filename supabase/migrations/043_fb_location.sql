-- Where the old Facebook ad said the item is (Floyd, Cumberland, Richmond…), so the repost uses the same town (Oct 23, 2026).
alter table items add column if not exists fb_location text;
