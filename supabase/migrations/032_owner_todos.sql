-- Owner's to-do list (assistant reminders). Applied live Oct 1, 2026.
create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  notes text,
  priority text not null default 'needed' check (priority in ('urgent','needed','someday')),
  due_date date,
  remind text not null default 'weekly' check (remind in ('weekly','due','none')),
  done_at timestamptz,
  snooze_until date,
  last_reminded_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.todos enable row level security;
create policy todos_staff on public.todos for all using (public.is_staff()) with check (public.is_staff());
create index if not exists todos_open on public.todos (done_at, due_date);
create trigger trash_todos before delete on public.todos for each row execute function public.trash_capture();
