-- How each Facebook ad handles delivery, picked by the owner per item (Oct 26, 2026):
-- none = pickup only; fb = Facebook prepaid label; offsite = pickup on Facebook, he ships it himself (buyer pays).
alter table items add column if not exists fb_ship text not null default 'none' check (fb_ship in ('none','fb','offsite'));
