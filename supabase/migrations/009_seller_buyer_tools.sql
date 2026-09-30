-- 009: posted-to tracker, item stats, price-drop schedule, seller text alerts, buyer favorites + price-drop alerts

-- ---------- items: where else it's posted, stats, auto price drops ----------
alter table items
  add column if not exists posted_to jsonb not null default '{}'::jsonb,   -- {"ebay": "2026-09-30T..", "facebook": "..."}
  add column if not exists view_count int not null default 0,
  add column if not exists save_count int not null default 0,
  add column if not exists drop_pct numeric(5,2),          -- e.g. 10 = 10% off
  add column if not exists drop_every_days int,            -- e.g. 7
  add column if not exists drop_floor numeric(10,2),       -- never go below
  add column if not exists last_drop_at timestamptz;

-- anyone can count a view (rate limiting is done in the app; this is just a counter)
create or replace function bump_view(p_item uuid) returns void language sql security definer set search_path = public as $$
  update items set view_count = view_count + 1 where id = p_item and status in ('active','reserved');
$$;
grant execute on function bump_view(uuid) to anon, authenticated;

-- ---------- profiles: text alerts via carrier email gateway (free) ----------
alter table profiles
  add column if not exists sms_gateway text,               -- e.g. 8045551212@vtext.com
  add column if not exists alert_messages boolean not null default true,
  add column if not exists alert_orders boolean not null default true;
grant update (sms_gateway, alert_messages, alert_orders) on profiles to authenticated;

-- ---------- favorites (buyer saves an item) ----------
-- (favorites table already existed from 003; counter + alerts added)
create table if not exists favorites (
  profile_id uuid not null references profiles(id) on delete cascade,
  item_id uuid not null references items(id) on delete cascade,
  price_at numeric(10,2),
  created_at timestamptz not null default now(),
  primary key (profile_id, item_id)
);
alter table favorites enable row level security;
create policy "favorites own" on favorites for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create or replace function favorites_count() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then update items set save_count = save_count + 1 where id = new.item_id; return new; end if;
  if tg_op = 'DELETE' then update items set save_count = greatest(save_count - 1, 0) where id = old.item_id; return old; end if;
  return null;
end $$;
drop trigger if exists favorites_count_trg on favorites;
create trigger favorites_count_trg after insert or delete on favorites for each row execute function favorites_count();
revoke execute on function favorites_count() from anon, authenticated, public;

-- price drop → queue an email to every watcher (sent by the daily notify job)
create or replace function items_price_drop_alert() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'active' and new.price < old.price then
    insert into notifications (profile_id, contact, channel, subject, body, related_item_id)
    select w.profile_id, p.email, 'email',
           'Price drop: ' || coalesce(new.title, 'an item you saved'),
           coalesce(new.title, 'An item you saved') || ' dropped from $' || old.price || ' to $' || new.price || '. Grab it before someone else does.',
           new.id
    from favorites w join profiles p on p.id = w.profile_id
    where w.item_id = new.id and p.email is not null;
  end if;
  return new;
end $$;
drop trigger if exists items_price_drop_alert_trg on items;
create trigger items_price_drop_alert_trg after update of price on items for each row execute function items_price_drop_alert();
revoke execute on function items_price_drop_alert() from anon, authenticated, public;

-- ---------- scheduled price drops (run daily) ----------
create or replace function run_price_drops() returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with due as (
    select id, price, drop_pct, drop_floor from items
    where status = 'active' and drop_pct > 0 and drop_every_days > 0
      and coalesce(last_drop_at, listed_at, created_at) < now() - (drop_every_days || ' days')::interval
      and price > coalesce(drop_floor, 0)
  ), upd as (
    update items i set price = greatest(round(i.price * (1 - d.drop_pct / 100), 0), coalesce(d.drop_floor, 1)), last_drop_at = now()
    from due d where i.id = d.id and round(i.price * (1 - d.drop_pct / 100), 0) < i.price
    returning i.id
  ) select count(*) into n from upd;
  return n;
end $$;
revoke execute on function run_price_drops() from anon, authenticated, public;

-- ---------- item stats for the owner: messages per item ----------
create or replace view item_stats as
  select i.id as item_id, i.owner_id, i.view_count, i.save_count,
         (select count(*) from conversations c where c.item_id = i.id) as message_count,
         (select count(*) from offers o where o.item_id = i.id) as offer_count
  from items i
  where i.owner_id = auth.uid() or is_staff();
grant select on item_stats to authenticated;
alter view seller_public: add zip (recreated with zip column)
