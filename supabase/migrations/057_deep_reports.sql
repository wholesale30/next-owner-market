-- 🔬 Advanced What's it worth (owner, Oct 26, 2026): saved deep reports (identification, value with real comps,
-- how to test it, faults, manuals, parts, listing) plus his follow-up questions and answers. Each owner sees only his own.
create table if not exists deep_reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  title text not null default '',
  photo_urls text[] not null default '{}',
  notes text,
  report jsonb,
  qa jsonb not null default '[]',
  cost numeric(8,3) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists deep_reports_owner on deep_reports(owner_id, created_at desc);
alter table deep_reports enable row level security;
drop policy if exists deep_reports_own on deep_reports;
create policy deep_reports_own on deep_reports for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
