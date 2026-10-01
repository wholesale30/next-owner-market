-- Applied live Sept 30, 2026 via MCP (payout_pending, recycle_bin).
alter table orders add column if not exists payout_pending boolean not null default false;
alter table orders add column if not exists payout_pending_since timestamptz;
create index if not exists orders_payout_pending_idx on orders (seller_id) where payout_pending;

create table if not exists trash (
  id bigserial primary key, batch bigint not null, table_name text not null, row_id text, title text,
  data jsonb not null, deleted_at timestamptz not null default now(), deleted_by uuid, restored_at timestamptz, restored_by uuid
);
create index if not exists trash_batch_idx on trash (batch);
create index if not exists trash_when_idx on trash (deleted_at desc);
alter table trash enable row level security;
drop policy if exists trash_staff on trash;
create policy trash_staff on trash for select using (is_staff());

create or replace function trash_capture() returns trigger language plpgsql security definer set search_path = public as $$
declare j jsonb := to_jsonb(old);
begin
  insert into trash (batch, table_name, row_id, title, data, deleted_by)
  values (txid_current(), tg_table_name, coalesce(j->>'id', j->>'code', j->>'slug'),
          left(coalesce(j->>'title', j->>'name', j->>'label', j->>'code', j->>'url', j->>'storage_path', j->>'body', tg_table_name), 200), j, auth.uid());
  return old;
end $$;

do $$ declare t text; begin
  foreach t in array array['items','item_photos','item_videos','auctions','listings','lots','lot_members','posts','threads','replies','pickup_slots','invites','categories','locations','subscribers','offers','valuations','ops_tasks','saved_searches'] loop
    if to_regclass('public.'||t) is not null then
      execute format('drop trigger if exists trash_%1$s on %1$I', t);
      execute format('create trigger trash_%1$s before delete on %1$I for each row execute function trash_capture()', t);
    end if;
  end loop;
end $$;

create or replace function restore_trash(p_batch bigint) returns int language plpgsql security definer set search_path = public as $$
declare r record; cols text; n int := 0;
begin
  if not is_staff() then raise exception 'staff only'; end if;
  for r in select * from trash where batch = p_batch and restored_at is null
    order by case table_name when 'categories' then 0 when 'locations' then 0 when 'items' then 1 when 'lots' then 1 when 'threads' then 1 when 'posts' then 1 else 2 end, id
  loop
    select string_agg(quote_ident(column_name), ',') into cols from information_schema.columns
      where table_schema = 'public' and table_name = r.table_name and is_generated = 'NEVER' and (r.data ? column_name);
    execute format('insert into %I (%s) select %s from jsonb_populate_record(null::%I, $1) on conflict do nothing', r.table_name, cols, cols, r.table_name) using r.data;
    update trash set restored_at = now(), restored_by = auth.uid() where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;
grant execute on function restore_trash(bigint) to authenticated;
