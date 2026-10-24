-- Facebook's own category name for the ad (read off his Edit pages), so reposts go in the same category (Oct 23, 2026).
alter table items add column if not exists fb_category text;
