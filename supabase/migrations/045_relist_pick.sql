-- Relist picking (Oct 23, 2026): he chooses which Facebook ads go next (fb_pick = when he tapped it, earliest first) and which never get relisted (fb_hold).
alter table items add column if not exists fb_pick timestamptz;
alter table items add column if not exists fb_hold boolean not null default false;
