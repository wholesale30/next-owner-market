-- Relist price sync (Oct 23, 2026): the price he posted on Facebook, so the Relist list can tell him
-- "the app lowered this one; change it on Facebook to $X" (Facebook can't be updated from outside).
alter table items add column if not exists fb_posted_price numeric(10,2);
