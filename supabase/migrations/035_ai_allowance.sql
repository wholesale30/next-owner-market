-- AI allowance (Oct 2, 2026): Pro 300 uses/month, Power Seller 1,000, Thrift Pro 30 a day; top-up balance; real cost log.
alter table profiles add column if not exists power boolean not null default false;
alter table profiles add column if not exists power_subscription_id text;
alter table profiles add column if not exists uses_month text;          -- 'YYYY-MM' (Eastern) the counter belongs to
alter table profiles add column if not exists uses_count int not null default 0;
alter table profiles add column if not exists extra_uses int not null default 0; -- bought top-ups; never expire
alter table profiles add column if not exists uses_day text;            -- Thrift Pro daily fair use
alter table profiles add column if not exists uses_day_count int not null default 0;
alter table profiles add column if not exists uses_warned text;         -- month the 80% heads-up went out

create table if not exists ai_usage (
  id bigserial primary key,
  owner_id uuid references profiles(id) on delete set null,
  feature text not null,
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cache_read_tokens int not null default 0,
  cache_write_tokens int not null default 0,
  cost_usd numeric(10,5) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_created on ai_usage (created_at desc);
create index if not exists ai_usage_owner on ai_usage (owner_id, created_at desc);
alter table ai_usage enable row level security;
drop policy if exists ai_usage_staff on ai_usage;
create policy ai_usage_staff on ai_usage for select using (is_staff());

-- One AI use. Staff, admin and comped: always free. Pro: monthly allowance, then top-ups.
-- Thrift Pro: 30 a day. Free: 3 starter credits, then top-ups.
create or replace function public.spend_ai_credit(p_profile uuid)
 returns boolean language plpgsql security definer set search_path to 'public' as $$
declare pr profiles%rowtype; m text := to_char(now() at time zone 'America/New_York', 'YYYY-MM');
        dy text := to_char(now() at time zone 'America/New_York', 'YYYY-MM-DD'); allow int;
begin
  select * into pr from profiles where id = p_profile for update;
  if not found then return false; end if;
  if pr.role in ('admin','staff') or pr.comped then return true; end if;
  if pr.uses_month is distinct from m then update profiles set uses_month = m, uses_count = 0 where id = p_profile; pr.uses_count := 0; end if;
  if pr.plan = 'pro' then
    allow := case when pr.power then 1000 else 300 end;
    if pr.uses_count < allow then update profiles set uses_count = uses_count + 1 where id = p_profile; return true; end if;
  elsif pr.thrift_pro then
    if pr.uses_day is distinct from dy then update profiles set uses_day = dy, uses_day_count = 0 where id = p_profile; pr.uses_day_count := 0; end if;
    if pr.uses_day_count < 30 then update profiles set uses_day_count = uses_day_count + 1, uses_count = uses_count + 1 where id = p_profile; return true; end if;
  elsif pr.ai_credits > 0 then
    update profiles set ai_credits = ai_credits - 1, uses_count = uses_count + 1 where id = p_profile; return true;
  end if;
  if pr.extra_uses > 0 then update profiles set extra_uses = extra_uses - 1, uses_count = uses_count + 1 where id = p_profile; return true; end if;
  return false;
end $$;

-- Give one back when the AI call failed (mirror of spend).
create or replace function public.refund_ai_credit(p_profile uuid)
 returns void language plpgsql security definer set search_path to 'public' as $$
declare pr profiles%rowtype;
begin
  select * into pr from profiles where id = p_profile for update;
  if not found or pr.role in ('admin','staff') or pr.comped then return; end if;
  if pr.plan = 'pro' or pr.thrift_pro then
    update profiles set uses_count = greatest(0, uses_count - 1), uses_day_count = greatest(0, uses_day_count - case when pr.thrift_pro and pr.plan <> 'pro' then 1 else 0 end) where id = p_profile;
  else
    update profiles set ai_credits = ai_credits + 1, uses_count = greatest(0, uses_count - 1) where id = p_profile;
  end if;
end $$;
revoke execute on function public.spend_ai_credit(uuid) from anon, authenticated;
revoke execute on function public.refund_ai_credit(uuid) from anon, authenticated;
