-- Take it off Facebook (Oct 23, 2026): Claude in Chrome deletes the ad without reposting; fb_removed_at when done.
alter table items add column if not exists fb_remove boolean not null default false;
alter table items add column if not exists fb_removed_at timestamptz;
