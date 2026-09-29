-- Stage 2 additions. Run after schema.sql (safe to run once).

-- Bins: items count and "sorted" tracking already exist. Add notes on outcomes per bin.

-- Anyone signed-in can create/update their own profile fields; buyers can read business settings (already public).

-- Buyers can read approved public profiles? No. Keep private.

-- Favorites/saved searches already exist and are per-profile.

-- Notifications: allow a matching function to insert rows as security definer.
create or replace function notify_saved_search_matches(p_item_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  it items%rowtype;
  n int := 0;
  ss record;
begin
  select * into it from items where id = p_item_id;
  if it.status <> 'active' then return 0; end if;
  for ss in
    select s.*, p.email, p.phone from saved_searches s join profiles p on p.id = s.profile_id
    where s.notify
      and (s.category_id is null or s.category_id = it.category_id)
      and (s.max_price is null or it.price is null or it.price <= s.max_price)
      and it.search @@ websearch_to_tsquery('english', s.query)
  loop
    insert into notifications (profile_id, contact, channel, subject, body, related_item_id)
    values (ss.profile_id, coalesce(ss.email, ss.phone), 'email',
            'New match: ' || it.title,
            'Something matching "' || ss.query || '" was just listed: ' || it.title || ' for $' || coalesce(it.price::text, '?') || '.',
            it.id);
    n := n + 1;
  end loop;
  -- also match open sourcing requests (staff sees these on the Wanted page)
  update sourcing_requests r set status = 'matched', matched_item_id = it.id
  where r.status in ('open','searching')
    and it.search @@ websearch_to_tsquery('english', r.description);
  return n;
end $$;

-- Auction bidding: a function so bid rules are enforced in the database.
create or replace function place_bid(p_auction_id uuid, p_amount numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a auctions%rowtype;
  min_next numeric;
  inc numeric;
begin
  if auth.uid() is null then raise exception 'Sign in to bid'; end if;
  select * into a from auctions where id = p_auction_id for update;
  if a.status <> 'live' or now() < a.starts_at or now() > a.ends_at then raise exception 'Auction is not live'; end if;
  inc := case when coalesce(a.current_bid, a.starting_bid) < 25 then 1 when coalesce(a.current_bid, a.starting_bid) < 100 then 2.5 when coalesce(a.current_bid, a.starting_bid) < 500 then 5 else 10 end;
  min_next := case when a.current_bid is null then a.starting_bid else a.current_bid + inc end;
  if p_amount < min_next then raise exception 'Minimum bid is $%', min_next; end if;
  insert into bids (auction_id, bidder_id, amount) values (p_auction_id, auth.uid(), p_amount);
  update auctions set current_bid = p_amount, current_bidder_id = auth.uid(),
    ends_at = case when a.ends_at - now() < make_interval(mins => a.extend_minutes) then now() + make_interval(mins => a.extend_minutes) else a.ends_at end
    where id = p_auction_id;
  if a.buy_now_price is not null and p_amount >= a.buy_now_price then
    update auctions set status = 'ended', ends_at = now() where id = p_auction_id;
  end if;
  return jsonb_build_object('ok', true, 'current_bid', p_amount);
end $$;

-- Close auctions that have passed their end time (called from the app when an auction page loads or by a cron later).
create or replace function close_ended_auctions() returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with c as (update auctions set status = 'ended' where status = 'live' and ends_at < now() returning id)
  select count(*) into n from c;
  update auctions set status = 'live' where status = 'scheduled' and starts_at <= now() and ends_at > now();
  return n;
end $$;

-- Pickups: buyers may read their own by contact? Keep: public insert, staff read. Slots public read.

-- Bulk: allow staff to update many items (already covered by RLS).

-- Stale listing helper view
create or replace view stale_items as
  select id, sku, title, price, listed_at, now() - listed_at as age
  from items where status = 'active' and listed_at < now() - interval '30 days';
grant select on stale_items to authenticated;

-- Fire alerts automatically whenever an item becomes active.
create or replace function on_item_activated() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'active' and (old.status is distinct from 'active') then
    perform notify_saved_search_matches(new.id);
  end if;
  return new;
end $$;
drop trigger if exists items_activated on items;
create trigger items_activated after insert or update of status on items for each row execute function on_item_activated();

-- Let staff read all notifications for sending (already allowed), and mark sent.

-- Live auction updates on the item page
alter publication supabase_realtime add table auctions;
