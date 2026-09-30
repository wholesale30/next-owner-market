-- Sellers get their own inbox for their items; replies/messages emailed instantly by /api/messages/notify
alter table conversations add column if not exists seller_profile_id uuid references profiles(id) on delete set null;
alter table conversations add column if not exists unread_for_seller boolean not null default false;
update conversations c set seller_profile_id = i.owner_id from items i where i.id = c.item_id and c.seller_profile_id is null;
create index if not exists conversations_seller_idx on conversations(seller_profile_id);
create policy "conversations seller read" on conversations for select using (seller_profile_id = auth.uid());
create policy "messages seller read" on messages for select using (exists (select 1 from conversations c where c.id = conversation_id and c.seller_profile_id = auth.uid()));
create policy "conversations seller update" on conversations for update using (seller_profile_id = auth.uid()) with check (seller_profile_id = auth.uid());
-- start_conversation now records seller_profile_id; reply_conversation sets unread_for_seller; staff_reply allows the item's seller too (see applied migration seller_inbox for full bodies)
-- Masked messaging: buyer_contact readable only by staff via conversation_contact(); bodies scrubbed via scrub_for_conversation(); explicit column grants (see applied migrations masked_messaging, mask_buyer_contact_column)
alter table orders add column if not exists shipping_address jsonb;
-- delete_item(uuid): owner or staff may delete an item with no sale/paid order/live auction (see applied migration delete_item)
create table if not exists password_resets (token text primary key default encode(gen_random_bytes(24), 'hex'), user_id uuid not null references auth.users(id) on delete cascade, expires_at timestamptz not null default now() + interval '1 hour', used_at timestamptz, created_at timestamptz not null default now());
alter table password_resets enable row level security;
-- start_conversation now requires a signed-in account and uses the account's own email/phone (see applied migration messaging_requires_account)
create or replace view seller_public with (security_invoker = false) as
  select id, role, coalesce(business_name, split_part(coalesce(full_name,''), ' ', 1)) as display_name, stripe_payouts_ready, suspended, rating_avg, rating_count, completed_sales, created_at from profiles;
grant select on seller_public to anon, authenticated;
alter table profiles add column if not exists city text, add column if not exists state text, add column if not exists zip text;
alter table conversations add column if not exists order_id uuid references orders(id) on delete set null;
-- seller_public view gains city/state; order_conversation(uuid) starts/reuses the thread for an order (see applied migration seller_location)
