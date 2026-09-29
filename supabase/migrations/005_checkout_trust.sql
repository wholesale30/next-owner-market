-- ============================================================
-- 005: Checkout (Stripe), held funds, ratings, disputes, plans, seller caps, contact stripping
-- ============================================================

-- ---------- profiles: payouts + plan + trust ----------
alter table profiles
  add column if not exists stripe_account_id text,
  add column if not exists stripe_payouts_ready boolean not null default false,
  add column if not exists stripe_customer_id text,
  add column if not exists plan text not null default 'free' check (plan in ('free','pro')),
  add column if not exists plan_renews_at timestamptz,
  add column if not exists stripe_subscription_id text,
  add column if not exists completed_sales int not null default 0,
  add column if not exists rating_avg numeric(3,2),
  add column if not exists rating_count int not null default 0,
  add column if not exists suspended boolean not null default false,
  add column if not exists ai_credits int not null default 3;   -- free AI listings before Pro

-- ---------- orders (one per purchase; money is held by Stripe until released) ----------
create type order_status as enum ('pending_payment','paid','released','refunded','disputed','cancelled');
create type fulfillment_kind as enum ('pickup','ship');

create table orders (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id),
  buyer_id uuid not null references profiles(id),
  seller_id uuid not null references profiles(id),
  fulfillment fulfillment_kind not null default 'pickup',
  amount numeric(10,2) not null,                 -- item price
  shipping numeric(10,2) not null default 0,
  total numeric(10,2) generated always as (amount + shipping) stored,
  commission_pct numeric(5,2) not null default 0,
  commission_amount numeric(10,2) generated always as (round(amount * commission_pct / 100, 2)) stored,
  seller_due numeric(10,2) generated always as (round(amount - (amount * commission_pct / 100), 2) + shipping) stored,
  status order_status not null default 'pending_payment',
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  stripe_transfer_id text,
  stripe_refund_id text,
  pickup_code text not null default lpad((floor(random() * 1000000))::int::text, 6, '0'),
  tracking_carrier text,
  tracking_number text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  release_after timestamptz,                     -- auto-release time once delivered
  expires_at timestamptz,                        -- auto-refund pickup orders not completed by then
  paid_at timestamptz,
  released_at timestamptz,
  refunded_at timestamptz,
  buyer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_buyer_idx on orders(buyer_id);
create index orders_seller_idx on orders(seller_id);
create index orders_item_idx on orders(item_id);
create index orders_status_idx on orders(status);
create trigger orders_touch before update on orders for each row execute function touch_updated_at();

-- ---------- disputes ----------
create type dispute_status as enum ('open','resolved_refund','resolved_release','closed');
create table disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders(id) on delete cascade,
  opened_by uuid not null references profiles(id),
  reason text not null,
  status dispute_status not null default 'open',
  resolution_note text,
  resolved_by uuid references profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create table dispute_messages (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references disputes(id) on delete cascade,
  sender_id uuid not null references profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

-- ---------- ratings ----------
create table ratings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  rater_id uuid not null references profiles(id),
  ratee_id uuid not null references profiles(id),
  stars int not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (order_id, rater_id)
);
create or replace function ratings_recalc() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update profiles p set
    rating_avg = (select round(avg(stars)::numeric, 2) from ratings where ratee_id = new.ratee_id),
    rating_count = (select count(*) from ratings where ratee_id = new.ratee_id)
  where p.id = new.ratee_id;
  return new;
end $$;
create trigger ratings_recalc_trg after insert or update on ratings for each row execute function ratings_recalc();

-- ---------- RLS ----------
alter table orders enable row level security;
alter table disputes enable row level security;
alter table dispute_messages enable row level security;
alter table ratings enable row level security;

create policy "orders read" on orders for select using (buyer_id = auth.uid() or seller_id = auth.uid() or is_staff());
-- orders are created/updated only by server routes (service role); sellers may add tracking
create policy "orders seller tracking" on orders for update using (seller_id = auth.uid() or is_staff()) with check (seller_id = auth.uid() or is_staff());

create policy "disputes read" on disputes for select using (exists (select 1 from orders o where o.id = order_id and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())) or is_staff());
create policy "disputes open" on disputes for insert with check (opened_by = auth.uid() and exists (select 1 from orders o where o.id = order_id and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())));
create policy "disputes staff" on disputes for update using (is_staff());
create policy "dispute msgs read" on dispute_messages for select using (exists (select 1 from disputes d join orders o on o.id = d.order_id where d.id = dispute_id and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())) or is_staff());
create policy "dispute msgs write" on dispute_messages for insert with check (sender_id = auth.uid() and (is_staff() or exists (select 1 from disputes d join orders o on o.id = d.order_id where d.id = dispute_id and (o.buyer_id = auth.uid() or o.seller_id = auth.uid()))));

create policy "ratings read" on ratings for select using (true);
create policy "ratings write" on ratings for insert with check (
  rater_id = auth.uid() and exists (select 1 from orders o where o.id = order_id and o.status = 'released' and (o.buyer_id = auth.uid() or o.seller_id = auth.uid()) and (o.buyer_id = ratee_id or o.seller_id = ratee_id) and ratee_id <> auth.uid())
);

-- ---------- trust: strip contact info from non-staff listings ----------
create or replace function strip_contact(t text) returns text language sql immutable as $$
  select regexp_replace(
           regexp_replace(
             regexp_replace(coalesce(t,''), '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[contact removed]', 'g'),
             '(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}', '[contact removed]', 'g'),
           '(text|call|whatsapp|venmo|zelle|cashapp|cash app|paypal)\s*(me)?\s*(at|@|:)\s*[A-Za-z0-9@$._-]+', '[contact removed]', 'gi');
$$;

create or replace function items_trust_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare
  owner_role user_role;
  owner_plan text;
  owner_done int;
  owner_susp boolean;
  active_count int;
  active_value numeric;
begin
  select role, plan, completed_sales, suspended into owner_role, owner_plan, owner_done, owner_susp from profiles where id = new.owner_id;
  if owner_role in ('admin','staff') then return new; end if;

  -- 1) no phone numbers / emails / off-platform payment handles in public text
  new.title := strip_contact(new.title);
  new.description := strip_contact(new.description);
  new.condition_notes := strip_contact(new.condition_notes);

  -- 2) caps when going live
  if new.status = 'active' and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    if owner_susp then raise exception 'This account is suspended. Contact us.'; end if;
    select count(*), coalesce(sum(price),0) into active_count, active_value from items where owner_id = new.owner_id and status in ('active','reserved') and id <> new.id;
    if owner_done < 3 then
      if active_count >= 5 then raise exception 'New sellers can have 5 live listings until 3 sales are completed.'; end if;
      if active_value + coalesce(new.price,0) > 500 then raise exception 'New sellers can have $500 of live listings until 3 sales are completed.'; end if;
    elsif owner_plan <> 'pro' and active_count >= 10 then
      raise exception 'Free accounts can have 10 live listings. Upgrade to Pro for unlimited.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists items_trust_guard_trg on items;
create trigger items_trust_guard_trg before insert or update on items for each row execute function items_trust_guard();

-- 3) video is Pro (or staff)
create or replace function videos_plan_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare r user_role; p text;
begin
  select pr.role, pr.plan into r, p from items i join profiles pr on pr.id = i.owner_id where i.id = new.item_id;
  if r in ('admin','staff') or p = 'pro' then return new; end if;
  raise exception 'Video on listings is a Pro feature.';
end $$;
drop trigger if exists videos_plan_guard_trg on item_videos;
create trigger videos_plan_guard_trg before insert on item_videos for each row execute function videos_plan_guard();

-- ---------- when an order is released: record the sale, bump seller stats, mark item sold ----------
create or replace function on_order_released() returns trigger language plpgsql security definer set search_path = public as $$
declare bname text; bcontact text;
begin
  if new.status = 'released' and old.status is distinct from 'released' then
    select full_name, coalesce(email, phone) into bname, bcontact from profiles where id = new.buyer_id;
    insert into sales (item_id, buyer_id, buyer_name, buyer_contact, channel, sale_price, shipping_charged, platform_fees, payment_method, commission_pct, notes)
      values (new.item_id, new.buyer_id, bname, bcontact, 'storefront', new.amount, new.shipping, round(new.total * 0.029 + 0.30, 2), 'card', new.commission_pct, 'Order ' || new.id);
    update items set status = 'sold', sold_at = now() where id = new.item_id;
    update profiles set completed_sales = completed_sales + 1 where id = new.seller_id;
  end if;
  if new.status = 'paid' and old.status is distinct from 'paid' then
    update items set status = 'reserved' where id = new.item_id and status = 'active';
  end if;
  if new.status in ('refunded','cancelled') and old.status in ('paid','disputed') then
    update items set status = 'active' where id = new.item_id and status = 'reserved';
  end if;
  return new;
end $$;
create trigger on_order_released_trg after update on orders for each row execute function on_order_released();

revoke execute on function items_trust_guard() from anon, authenticated, public;
revoke execute on function videos_plan_guard() from anon, authenticated, public;
revoke execute on function on_order_released() from anon, authenticated, public;
revoke execute on function ratings_recalc() from anon, authenticated, public;

-- plan pricing and platform settings
insert into settings (key, value) values ('plans', '{"pro_monthly": 15, "free_ai_credits": 3, "pro_features": ["Unlimited AI-written listings (title, description, specs, price)", "Ready-to-paste listings for Facebook Marketplace, eBay, OfferUp, Craigslist", "Video on listings", "Unlimited live listings in the store"]}') on conflict (key) do nothing;

-- spend one AI credit (server-side only). Returns true if allowed.
create or replace function spend_ai_credit(p_profile uuid) returns boolean language plpgsql security definer set search_path = public as $$
declare r user_role; p text; c int;
begin
  select role, plan, ai_credits into r, p, c from profiles where id = p_profile;
  if r in ('admin','staff') or p = 'pro' then return true; end if;
  if c > 0 then update profiles set ai_credits = ai_credits - 1 where id = p_profile; return true; end if;
  return false;
end $$;
revoke execute on function spend_ai_credit(uuid) from anon, authenticated, public;
alter table items add column if not exists shipping_price numeric(10,2) not null default 0;
