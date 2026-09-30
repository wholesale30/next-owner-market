-- Sellers get their own inbox for their items; replies/messages emailed instantly by /api/messages/notify
alter table conversations add column if not exists seller_profile_id uuid references profiles(id) on delete set null;
alter table conversations add column if not exists unread_for_seller boolean not null default false;
update conversations c set seller_profile_id = i.owner_id from items i where i.id = c.item_id and c.seller_profile_id is null;
create index if not exists conversations_seller_idx on conversations(seller_profile_id);
create policy "conversations seller read" on conversations for select using (seller_profile_id = auth.uid());
create policy "messages seller read" on messages for select using (exists (select 1 from conversations c where c.id = conversation_id and c.seller_profile_id = auth.uid()));
create policy "conversations seller update" on conversations for update using (seller_profile_id = auth.uid()) with check (seller_profile_id = auth.uid());
-- start_conversation now records seller_profile_id; reply_conversation sets unread_for_seller; staff_reply allows the item's seller too (see applied migration seller_inbox for full bodies)
