-- Server-side Facebook import (Oct 23, 2026): ads wait here; /api/import/run (called once a minute by a database job)
-- brings them in a few at a time so the owner doesn't have to keep his phone open.
create table if not exists fb_import_queue (
  id bigserial primary key,
  owner_id uuid not null references profiles(id),
  data jsonb not null,
  status text not null default 'waiting',
  item_id uuid,
  error text,
  tries int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table fb_import_queue enable row level security;
create policy "fb import owner read" on fb_import_queue for select using (is_staff());
create or replace function claim_fb_import(n int) returns setof fb_import_queue language sql security definer set search_path = public as $$
  update fb_import_queue q set status = 'working', tries = q.tries + 1, updated_at = now()
  where q.id in (
    select id from fb_import_queue
    where status = 'waiting' or (status = 'working' and updated_at < now() - interval '6 minutes' and tries < 3)
    order by id limit n for update skip locked
  ) returning q.*;
$$;
revoke execute on function claim_fb_import(int) from anon, authenticated, public;
