-- Saved lookups (Oct 2, 2026): every What's it worth, Buy or Pass and Sort the pile answer is kept until the person deletes it.
create table if not exists lookups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  tool text not null check (tool in ('worth','buy_or_pass','pile')),
  title text not null default '',
  photo_urls text[] not null default '{}',
  hints text,
  result jsonb not null default '{}'::jsonb,
  value_low numeric, value_high numeric,
  ref_id uuid,
  item_id uuid references items(id) on delete set null,
  listed_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists lookups_owner on lookups (owner_id, created_at desc) where deleted_at is null;
alter table lookups enable row level security;
create policy lookups_own_read on lookups for select using (owner_id = auth.uid() or is_staff());
