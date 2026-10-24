-- Post now (Oct 24, 2026): fb_now = he asked for this one now, outside the daily number and posting hours; fb_extra = it was posted that way, so it doesn't count toward the day's limit.
alter table items add column if not exists fb_now boolean not null default false;
alter table items add column if not exists fb_extra boolean not null default false;
