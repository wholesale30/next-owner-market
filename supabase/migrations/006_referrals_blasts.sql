alter table profiles add column if not exists pro_credit_months int not null default 0;
alter table profiles add column if not exists referral_count int not null default 0;
alter table subscribers add column if not exists unsub_token text not null default encode(gen_random_bytes(12), 'hex');
create unique index if not exists subscribers_unsub_idx on subscribers(unsub_token);
create table if not exists blasts (
  id uuid primary key default gen_random_uuid(),
  subject text not null, intro text, item_ids uuid[] not null default '{}',
  sent_by uuid references profiles(id), recipients int not null default 0, sent int not null default 0,
  created_at timestamptz not null default now()
);
alter table blasts enable row level security;
create policy "blasts staff" on blasts for all using (is_staff()) with check (is_staff());
create or replace function apply_referral(p_new uuid, p_code text) returns void language plpgsql security definer set search_path = public as $$
declare r uuid;
begin
  if p_code is null or p_code = '' then return; end if;
  select id into r from profiles where referral_code = lower(p_code) and id <> p_new;
  if r is null then return; end if;
  update profiles set referred_by = r where id = p_new and referred_by is null;
  update profiles set referral_count = referral_count + 1 where id = r;
end $$;
revoke execute on function apply_referral(uuid, text) from anon, authenticated, public;
create or replace function on_pro_upgrade() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.plan = 'pro' and old.plan is distinct from 'pro' and new.referred_by is not null then
    update profiles set pro_credit_months = pro_credit_months + 1 where id = new.referred_by;
  end if;
  return new;
end $$;
drop trigger if exists on_pro_upgrade_trg on profiles;
create trigger on_pro_upgrade_trg after update of plan on profiles for each row execute function on_pro_upgrade();
revoke execute on function on_pro_upgrade() from anon, authenticated, public;
