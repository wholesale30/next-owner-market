-- Applied 2026-09-29 to the live project. Re-run on a fresh database after schema.sql and schema_stage2.sql.
create table if not exists subscribers (
  id uuid primary key default gen_random_uuid(), email text, phone text, name text,
  source text not null default 'store', profile_id uuid references profiles(id) on delete set null,
  interests text[] not null default '{}', unsubscribed boolean not null default false,
  created_at timestamptz not null default now(), last_seen_at timestamptz not null default now());
create unique index if not exists subscribers_email_idx on subscribers (lower(email)) where email is not null;
create unique index if not exists subscribers_phone_idx on subscribers (phone) where phone is not null;
create or replace function subscribe(p_contact text, p_name text default null, p_source text default 'store', p_interest text default null)
returns void language plpgsql security definer set search_path = public as $$
declare c text := trim(p_contact); is_phone boolean := c ~ '^[\d\s()+-]{7,}$';
  em text := case when is_phone then null else lower(c) end; ph text := case when is_phone then regexp_replace(c, '[\s()-]', '', 'g') else null end;
begin
  if c = '' then return; end if;
  if em is not null and em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return; end if;
  insert into subscribers (email, phone, name, source, profile_id, interests)
  values (em, ph, nullif(trim(coalesce(p_name,'')),''), p_source, auth.uid(), case when p_interest is null then '{}' else array[p_interest] end)
  on conflict (lower(email)) where email is not null do update
    set last_seen_at = now(), name = coalesce(subscribers.name, excluded.name), profile_id = coalesce(subscribers.profile_id, excluded.profile_id),
        interests = (select array(select distinct unnest(subscribers.interests || excluded.interests)));
  if ph is not null then
    insert into subscribers (email, phone, name, source, profile_id, interests)
    values (null, ph, nullif(trim(coalesce(p_name,'')),''), p_source, auth.uid(), case when p_interest is null then '{}' else array[p_interest] end)
    on conflict (phone) where phone is not null do update set last_seen_at = now(), name = coalesce(subscribers.name, excluded.name);
  end if;
end $$;
grant execute on function subscribe(text, text, text, text) to anon, authenticated;
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(), item_id uuid references items(id) on delete set null,
  buyer_profile_id uuid references profiles(id) on delete set null, buyer_name text, buyer_contact text not null, subject text,
  status text not null default 'open', last_message_at timestamptz not null default now(),
  unread_for_staff boolean not null default true, unread_for_buyer boolean not null default false, created_at timestamptz not null default now());
create index if not exists conversations_item_idx on conversations(item_id);
create index if not exists conversations_last_idx on conversations(last_message_at desc);
create table if not exists messages (
  id uuid primary key default gen_random_uuid(), conversation_id uuid not null references conversations(id) on delete cascade,
  sender text not null, sender_profile_id uuid references profiles(id) on delete set null, body text not null, sent_via text, created_at timestamptz not null default now());
create index if not exists messages_conv_idx on messages(conversation_id, created_at);
alter table subscribers enable row level security; alter table conversations enable row level security; alter table messages enable row level security;
create policy "subscribers staff" on subscribers for all using (is_staff());
create policy "conversations staff" on conversations for all using (is_staff());
create policy "conversations buyer read" on conversations for select using (buyer_profile_id = auth.uid());
create policy "messages staff" on messages for all using (is_staff());
create policy "messages buyer read" on messages for select using (exists (select 1 from conversations c where c.id = conversation_id and c.buyer_profile_id = auth.uid()));
create policy "messages buyer reply" on messages for insert with check (sender = 'buyer' and exists (select 1 from conversations c where c.id = conversation_id and c.buyer_profile_id = auth.uid()));
create or replace function start_conversation(p_item_id uuid, p_name text, p_contact text, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid; existing uuid; subj text;
begin
  if trim(p_contact) = '' or trim(p_body) = '' then raise exception 'Contact and message are required'; end if;
  if length(p_body) > 4000 then raise exception 'Message too long'; end if;
  select title into subj from items where id = p_item_id;
  select id into existing from conversations where item_id is not distinct from p_item_id and lower(buyer_contact) = lower(trim(p_contact)) and status <> 'closed' order by created_at desc limit 1;
  if existing is not null then cid := existing; update conversations set last_message_at = now(), unread_for_staff = true, status = 'open' where id = cid;
  else insert into conversations (item_id, buyer_profile_id, buyer_name, buyer_contact, subject) values (p_item_id, auth.uid(), nullif(trim(p_name),''), trim(p_contact), subj) returning id into cid; end if;
  insert into messages (conversation_id, sender, sender_profile_id, body) values (cid, 'buyer', auth.uid(), trim(p_body));
  perform subscribe(p_contact, p_name, 'message', null);
  return cid;
end $$;
grant execute on function start_conversation(uuid, text, text, text) to anon, authenticated;
create or replace function reply_conversation(p_conversation_id uuid, p_body text) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in'; end if;
  if not exists (select 1 from conversations where id = p_conversation_id and buyer_profile_id = auth.uid()) then raise exception 'Not your conversation'; end if;
  insert into messages (conversation_id, sender, sender_profile_id, body) values (p_conversation_id, 'buyer', auth.uid(), trim(p_body));
  update conversations set last_message_at = now(), unread_for_staff = true, status = 'open' where id = p_conversation_id;
end $$;
grant execute on function reply_conversation(uuid, text) to authenticated;
create or replace function staff_reply(p_conversation_id uuid, p_body text) returns void language plpgsql security definer set search_path = public as $$
declare c conversations%rowtype;
begin
  if not is_staff() then raise exception 'Staff only'; end if;
  select * into c from conversations where id = p_conversation_id;
  insert into messages (conversation_id, sender, sender_profile_id, body) values (p_conversation_id, 'staff', auth.uid(), trim(p_body));
  update conversations set last_message_at = now(), unread_for_staff = false, unread_for_buyer = true, status = 'answered' where id = p_conversation_id;
  insert into notifications (profile_id, contact, channel, subject, body, related_item_id)
  values (c.buyer_profile_id, c.buyer_contact, case when c.buyer_contact ~ '^[\d\s()+-]{7,}$' then 'sms' else 'email' end, 'Reply about ' || coalesce(c.subject, 'your message'), trim(p_body), c.item_id);
end $$;
grant execute on function staff_reply(uuid, text) to authenticated;
create or replace function on_profile_created_subscribe() returns trigger language plpgsql security definer set search_path = public as $$
begin if new.email is not null then insert into subscribers (email, name, source, profile_id) values (lower(new.email), new.full_name, 'signup', new.id)
  on conflict (lower(email)) where email is not null do update set profile_id = excluded.profile_id, last_seen_at = now(); end if; return new; end $$;
drop trigger if exists profiles_subscribe on profiles; create trigger profiles_subscribe after insert on profiles for each row execute function on_profile_created_subscribe();
create or replace function on_request_subscribe() returns trigger language plpgsql security definer set search_path = public as $$ begin perform subscribe(new.contact, new.name, 'wanted', null); return new; end $$;
drop trigger if exists requests_subscribe on sourcing_requests; create trigger requests_subscribe after insert on sourcing_requests for each row execute function on_request_subscribe();
create or replace function on_pickup_subscribe() returns trigger language plpgsql security definer set search_path = public as $$ begin perform subscribe(new.buyer_contact, new.buyer_name, 'pickup', null); return new; end $$;
drop trigger if exists pickups_subscribe on pickups; create trigger pickups_subscribe after insert on pickups for each row execute function on_pickup_subscribe();
alter publication supabase_realtime add table conversations;
