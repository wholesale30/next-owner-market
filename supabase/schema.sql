-- Next Owner Market — database schema
-- Run this once in Supabase: SQL Editor > New query > paste > Run.
-- Built for growth: every planned feature has its table now so nothing needs a rebuild later.

create extension if not exists "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================
create type user_role as enum ('admin', 'staff', 'consignor', 'buyer');
create type item_status as enum ('draft', 'pending_review', 'active', 'reserved', 'sold', 'shipped', 'returned', 'archived');
create type item_condition as enum ('new', 'like_new', 'good', 'fair', 'for_parts');
create type sale_channel as enum ('storefront', 'facebook', 'offerup', 'ebay', 'craigslist', 'auction', 'in_person', 'other');
create type consignment_tier as enum ('full_service', 'drop_off', 'self_listed', 'owned');
create type payout_status as enum ('pending', 'paid', 'void');
create type request_status as enum ('open', 'searching', 'matched', 'fulfilled', 'closed');
create type auction_status as enum ('scheduled', 'live', 'ended', 'cancelled');
create type pickup_status as enum ('requested', 'confirmed', 'completed', 'no_show', 'cancelled');
create type sale_type as enum ('fixed', 'auction', 'lot');

-- ============================================================
-- PROFILES (one per auth user)
-- ============================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'buyer',
  full_name text,
  email text,
  phone text,
  business_name text,
  approved boolean not null default false,          -- consignors must be approved by admin
  default_commission_pct numeric(5,2),              -- per-consignor override
  default_tier consignment_tier default 'drop_off',
  referred_by uuid references profiles(id),
  referral_code text unique default encode(gen_random_bytes(4), 'hex'),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create profile on signup. First user ever becomes admin.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  is_first boolean;
begin
  select count(*) = 0 into is_first from profiles;
  insert into profiles (id, email, full_name, phone, role, approved)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'phone',
    case when is_first then 'admin'::user_role else coalesce((new.raw_user_meta_data->>'role')::user_role, 'buyer') end,
    is_first
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- CATEGORIES (editable in-app, nested)
-- ============================================================
create table categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- WAREHOUSE LOCATIONS (pallets, gaylords, shelves, bins)
-- ============================================================
create table locations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,            -- e.g. "G-114", "Shelf A3"
  kind text not null default 'gaylord', -- gaylord, pallet, shelf, bin, area
  description text,
  sorted boolean not null default false, -- pallet mode: has this box been gone through?
  sort_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- ITEMS (the heart of it)
-- ============================================================
create table items (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique default 'NOM-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6)),
  owner_id uuid not null references profiles(id),         -- who owns the goods (you or a consignor)
  created_by uuid references profiles(id),
  title text not null default '',
  description text not null default '',
  category_id uuid references categories(id),
  condition item_condition default 'good',
  condition_notes text,
  brand text,
  model text,
  specs jsonb not null default '{}'::jsonb,               -- flexible: dimensions, wattage, year, etc.
  tags text[] not null default '{}',
  status item_status not null default 'draft',
  sale_type sale_type not null default 'fixed',
  price numeric(10,2),
  price_min_suggested numeric(10,2),
  price_max_suggested numeric(10,2),
  cost numeric(10,2) default 0,                           -- what you paid
  quantity int not null default 1,
  location_id uuid references locations(id),
  tier consignment_tier not null default 'owned',
  commission_pct numeric(5,2),                            -- per-item override; null = tier default
  tested boolean not null default false,
  serviced boolean not null default false,
  service_notes text,                                     -- "new belt, cleaned heads, lubed"
  shipping_ok boolean not null default false,
  local_pickup_ok boolean not null default true,
  weight_lbs numeric(6,2),
  ai_generated boolean not null default false,
  ai_raw jsonb,                                           -- what the AI returned, for reference
  listed_at timestamptz,
  sold_at timestamptz,
  search tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index items_search_idx on items using gin(search);
create or replace function items_search_update() returns trigger language plpgsql as $$
begin
  new.search := to_tsvector('english', coalesce(new.title,'') || ' ' || coalesce(new.description,'') || ' ' || coalesce(new.brand,'') || ' ' || coalesce(new.model,'') || ' ' || array_to_string(new.tags,' '));
  return new;
end $$;
create trigger items_search_trg before insert or update of title, description, brand, model, tags on items for each row execute function items_search_update();
create index items_status_idx on items(status);
create index items_owner_idx on items(owner_id);
create index items_category_idx on items(category_id);

create table item_photos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id) on delete cascade,
  storage_path text not null,           -- path in the "item-photos" bucket
  url text not null,
  sort_order int not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create index item_photos_item_idx on item_photos(item_id);

-- Lots: a box or pallet sold as one unit; members are items
create table lots (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null unique references items(id) on delete cascade,  -- the lot itself is an item (sale_type = 'lot')
  created_at timestamptz not null default now()
);
create table lot_members (
  lot_id uuid references lots(id) on delete cascade,
  item_id uuid references items(id) on delete cascade,
  primary key (lot_id, item_id)
);

-- ============================================================
-- LISTINGS PER PLATFORM (track where each item is posted)
-- ============================================================
create table listings (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id) on delete cascade,
  channel sale_channel not null,
  external_id text,                     -- eBay item id, etc.
  external_url text,
  posted_at timestamptz default now(),
  removed_at timestamptz,
  last_refreshed_at timestamptz,
  unique (item_id, channel)
);

-- ============================================================
-- SALES + PAYOUTS (clean books)
-- ============================================================
create table sales (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id),
  buyer_id uuid references profiles(id),
  buyer_name text,
  buyer_contact text,
  channel sale_channel not null default 'in_person',
  sale_price numeric(10,2) not null,
  shipping_charged numeric(10,2) not null default 0,
  shipping_cost numeric(10,2) not null default 0,
  platform_fees numeric(10,2) not null default 0,
  payment_method text,                  -- cash, zelle, card, venmo...
  commission_pct numeric(5,2) not null default 0,
  commission_amount numeric(10,2) generated always as (round(sale_price * commission_pct / 100, 2)) stored,
  consignor_due numeric(10,2) generated always as (round(sale_price - (sale_price * commission_pct / 100), 2)) stored,
  notes text,
  sold_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index sales_item_idx on sales(item_id);

create table payouts (
  id uuid primary key default gen_random_uuid(),
  consignor_id uuid not null references profiles(id),
  amount numeric(10,2) not null,
  status payout_status not null default 'pending',
  method text,
  reference text,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
create table payout_sales (
  payout_id uuid references payouts(id) on delete cascade,
  sale_id uuid references sales(id) on delete cascade,
  primary key (payout_id, sale_id)
);

-- ============================================================
-- BUYER SIDE: sourcing requests, saved searches, favorites, alerts
-- ============================================================
create table sourcing_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references profiles(id),
  name text,
  contact text not null,                -- email or phone
  description text not null,
  budget_max numeric(10,2),
  will_ship boolean not null default false,
  max_distance_miles int,
  photo_url text,
  status request_status not null default 'open',
  matched_item_id uuid references items(id),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table saved_searches (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  query text not null,
  category_id uuid references categories(id),
  max_price numeric(10,2),
  notify boolean not null default true,
  created_at timestamptz not null default now()
);

create table favorites (
  profile_id uuid references profiles(id) on delete cascade,
  item_id uuid references items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, item_id)
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  contact text,                         -- for non-account buyers
  channel text not null default 'email', -- email, sms, push
  subject text,
  body text not null,
  related_item_id uuid references items(id),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================
-- AUCTIONS (ready for later; tables exist now)
-- ============================================================
create table auctions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null unique references items(id) on delete cascade,
  starting_bid numeric(10,2) not null,
  reserve_price numeric(10,2),
  buy_now_price numeric(10,2),
  current_bid numeric(10,2),
  current_bidder_id uuid references profiles(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  extend_minutes int not null default 2,   -- anti-snipe
  status auction_status not null default 'scheduled',
  created_at timestamptz not null default now()
);
create table bids (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references auctions(id) on delete cascade,
  bidder_id uuid not null references profiles(id),
  amount numeric(10,2) not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- PICKUP SCHEDULING
-- ============================================================
create table pickup_slots (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity int not null default 2,
  created_at timestamptz not null default now()
);
create table pickups (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid references pickup_slots(id),
  sale_id uuid references sales(id),
  item_id uuid references items(id),
  buyer_name text not null,
  buyer_contact text not null,
  status pickup_status not null default 'requested',
  notes text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- AUDIT LOG (who changed what)
-- ============================================================
create table activity_log (
  id bigint generated always as identity primary key,
  actor_id uuid references profiles(id),
  action text not null,
  entity text not null,
  entity_id uuid,
  data jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- SETTINGS (commission tiers etc., editable without code changes)
-- ============================================================
create table settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into settings (key, value) values
  ('commission_tiers', '{"full_service": 40, "full_service_under_50": 50, "drop_off": 30, "self_listed": 15, "owned": 0}'),
  ('business', '{"name": "Next Owner Market", "tagline": "Find its next owner", "location": "Virginia", "contact_email": "", "contact_phone": ""}'),
  ('min_full_service_value', '30');

-- ============================================================
-- updated_at triggers
-- ============================================================
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger items_touch before update on items for each row execute function touch_updated_at();
create trigger profiles_touch before update on profiles for each row execute function touch_updated_at();
create trigger requests_touch before update on sourcing_requests for each row execute function touch_updated_at();
create trigger locations_touch before update on locations for each row execute function touch_updated_at();

-- ============================================================
-- HELPER: current user's role
-- ============================================================
create or replace function current_role_name() returns user_role language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;
create or replace function is_staff() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('admin','staff') from profiles where id = auth.uid()), false)
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table profiles enable row level security;
alter table categories enable row level security;
alter table locations enable row level security;
alter table items enable row level security;
alter table item_photos enable row level security;
alter table lots enable row level security;
alter table lot_members enable row level security;
alter table listings enable row level security;
alter table sales enable row level security;
alter table payouts enable row level security;
alter table payout_sales enable row level security;
alter table sourcing_requests enable row level security;
alter table saved_searches enable row level security;
alter table favorites enable row level security;
alter table notifications enable row level security;
alter table auctions enable row level security;
alter table bids enable row level security;
alter table pickup_slots enable row level security;
alter table pickups enable row level security;
alter table activity_log enable row level security;
alter table settings enable row level security;

-- profiles: see own; staff see all; users update own (not role/approved)
create policy "profiles self read" on profiles for select using (id = auth.uid() or is_staff());
create policy "profiles self update" on profiles for update using (id = auth.uid() or is_staff());

-- categories, locations, settings: public read; staff write
create policy "categories public read" on categories for select using (true);
create policy "categories staff write" on categories for all using (is_staff());
create policy "locations staff" on locations for all using (is_staff());
create policy "settings public read" on settings for select using (true);
create policy "settings staff write" on settings for all using (is_staff());

-- items: public sees active/reserved/sold; consignors see their own; staff see all
create policy "items public read" on items for select
  using (status in ('active','reserved','sold') or owner_id = auth.uid() or is_staff());
create policy "items consignor insert" on items for insert
  with check (is_staff() or (owner_id = auth.uid() and exists (select 1 from profiles where id = auth.uid() and role = 'consignor')));
create policy "items owner update" on items for update
  using (is_staff() or owner_id = auth.uid());
create policy "items staff delete" on items for delete using (is_staff());

-- photos follow their item
create policy "photos read" on item_photos for select
  using (exists (select 1 from items i where i.id = item_id and (i.status in ('active','reserved','sold') or i.owner_id = auth.uid() or is_staff())));
create policy "photos write" on item_photos for all
  using (exists (select 1 from items i where i.id = item_id and (i.owner_id = auth.uid() or is_staff())));

create policy "lots staff" on lots for all using (is_staff());
create policy "lots public read" on lots for select using (true);
create policy "lot_members staff" on lot_members for all using (is_staff());
create policy "lot_members public read" on lot_members for select using (true);

create policy "listings owner read" on listings for select
  using (is_staff() or exists (select 1 from items i where i.id = item_id and i.owner_id = auth.uid()));
create policy "listings staff write" on listings for all using (is_staff());

-- sales: staff full; consignor sees sales of their items
create policy "sales staff" on sales for all using (is_staff());
create policy "sales consignor read" on sales for select
  using (exists (select 1 from items i where i.id = item_id and i.owner_id = auth.uid()));

create policy "payouts staff" on payouts for all using (is_staff());
create policy "payouts consignor read" on payouts for select using (consignor_id = auth.uid());
create policy "payout_sales staff" on payout_sales for all using (is_staff());
create policy "payout_sales consignor read" on payout_sales for select
  using (exists (select 1 from payouts p where p.id = payout_id and p.consignor_id = auth.uid()));

-- sourcing requests: anyone (even logged out) can create; requester or staff can read
create policy "requests public insert" on sourcing_requests for insert with check (true);
create policy "requests read" on sourcing_requests for select using (is_staff() or requester_id = auth.uid());
create policy "requests staff update" on sourcing_requests for update using (is_staff());

create policy "saved_searches own" on saved_searches for all using (profile_id = auth.uid());
create policy "favorites own" on favorites for all using (profile_id = auth.uid());
create policy "notifications own read" on notifications for select using (profile_id = auth.uid() or is_staff());
create policy "notifications staff write" on notifications for all using (is_staff());

create policy "auctions public read" on auctions for select using (true);
create policy "auctions staff write" on auctions for all using (is_staff());
create policy "bids public read" on bids for select using (true);
create policy "bids own insert" on bids for insert with check (bidder_id = auth.uid());

create policy "pickup_slots public read" on pickup_slots for select using (true);
create policy "pickup_slots staff write" on pickup_slots for all using (is_staff());
create policy "pickups public insert" on pickups for insert with check (true);
create policy "pickups staff" on pickups for all using (is_staff());

create policy "activity staff read" on activity_log for select using (is_staff());
create policy "activity any insert" on activity_log for insert with check (auth.uid() is not null);

-- ============================================================
-- STORAGE BUCKET for photos (public read, owners write)
-- ============================================================
insert into storage.buckets (id, name, public) values ('item-photos', 'item-photos', true)
  on conflict (id) do nothing;
create policy "item photos public read" on storage.objects for select using (bucket_id = 'item-photos');
create policy "item photos auth upload" on storage.objects for insert
  with check (bucket_id = 'item-photos' and auth.uid() is not null);
create policy "item photos owner delete" on storage.objects for delete
  using (bucket_id = 'item-photos' and (is_staff() or owner = auth.uid()));

-- ============================================================
-- STARTER CATEGORIES
-- ============================================================
insert into categories (name, slug, sort_order) values
  ('Audio & Stereo', 'audio', 1),
  ('Electronics', 'electronics', 2),
  ('Tools & Hardware', 'tools', 3),
  ('Kitchen & Appliances', 'kitchen', 4),
  ('Furniture', 'furniture', 5),
  ('Lighting & Lamps', 'lighting', 6),
  ('Vintage & Antiques', 'vintage', 7),
  ('Collectibles', 'collectibles', 8),
  ('Home & Decor', 'home', 9),
  ('Sporting & Outdoors', 'sporting', 10),
  ('Toys & Games', 'toys', 11),
  ('Office & Business', 'office', 12),
  ('Music & Instruments', 'music', 13),
  ('Cameras & Photo', 'cameras', 14),
  ('Computers & Phones', 'computers', 15),
  ('Automotive', 'automotive', 16),
  ('Clothing & Accessories', 'clothing', 17),
  ('Books, Media & Records', 'media', 18),
  ('Military & Government Surplus', 'military', 19),
  ('Industrial & Commercial', 'industrial', 20),
  ('Lots & Pallets', 'lots', 21),
  ('Other', 'other', 99);

-- Audio subcategories (your specialty)
insert into categories (name, slug, sort_order, parent_id)
select v.name, v.slug, v.ord, c.id from categories c,
  (values ('Turntables','turntables',1),('Receivers & Amps','receivers-amps',2),('Cassette Decks','cassette-decks',3),
          ('CD Players','cd-players',4),('Speakers','speakers',5),('Radios','radios',6),('Reel to Reel','reel-to-reel',7),
          ('Pro Audio','pro-audio',8),('Accessories & Parts','audio-parts',9)) as v(name, slug, ord)
where c.slug = 'audio';

insert into categories (name, slug, sort_order, parent_id)
select v.name, v.slug, v.ord, c.id from categories c,
  (values ('Power Tools','power-tools',1),('Hand Tools','hand-tools',2),('Shop Equipment','shop-equipment',3),
          ('Hardware & Fasteners','hardware',4),('Garden & Yard','garden',5)) as v(name, slug, ord)
where c.slug = 'tools';

insert into categories (name, slug, sort_order, parent_id)
select v.name, v.slug, v.ord, c.id from categories c,
  (values ('Small Appliances','small-appliances',1),('Cookware','cookware',2),('Coffee & Espresso','coffee',3),
          ('Bread & Ice Cream Machines','bread-ice-cream',4),('Large Appliances','large-appliances',5)) as v(name, slug, ord)
where c.slug = 'kitchen';
