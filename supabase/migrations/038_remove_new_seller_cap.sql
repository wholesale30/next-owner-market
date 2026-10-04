-- Oct 3, 2026 (owner): remove the new-seller limit (5 live listings / $500 until 3 sales). Paying members and comped: no limit; free accounts keep 10 live.
create or replace function public.items_trust_guard()
 returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  owner_role user_role; owner_plan text; owner_comped boolean; owner_susp boolean; active_count int;
begin
  select role, plan, comped, suspended into owner_role, owner_plan, owner_comped, owner_susp from profiles where id = new.owner_id;
  if owner_role in ('admin','staff') then return new; end if;
  new.title := strip_contact(new.title);
  new.description := strip_contact(new.description);
  new.condition_notes := strip_contact(new.condition_notes);
  if new.status = 'active' and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    if owner_susp then raise exception 'This account is suspended. Contact us.'; end if;
    if owner_plan <> 'pro' and not coalesce(owner_comped, false) then
      select count(*) into active_count from items where owner_id = new.owner_id and status in ('active','reserved') and id <> new.id;
      if active_count >= 10 then raise exception 'Free accounts can have 10 live listings. Go Pro for no limit.'; end if;
    end if;
  end if;
  return new;
end $function$;
