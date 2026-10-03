-- Ideas & problems (Oct 2, 2026): anyone can send an upgrade idea or report something broken; staff mark it and the sender sees the status.
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('idea','problem')),
  message text not null,
  page text, email text, owner_id uuid references profiles(id) on delete set null,
  photo_url text, user_agent text,
  status text not null default 'new' check (status in ('new','planned','done','not_now')),
  staff_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists feedback_created on feedback (created_at desc);
alter table feedback enable row level security;
create policy feedback_read on feedback for select using (owner_id = auth.uid() or is_staff());
