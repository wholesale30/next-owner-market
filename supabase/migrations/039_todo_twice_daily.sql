-- Applied live Oct 5, 2026.
-- Owner's to-do list by email + text at 11 AM and 5 PM Eastern (pg_cron hits /api/todo/remind at 15,16,21,22 UTC;
-- the route only sends on the call that is 11 or 17 in New York, once per slot).
create extension if not exists pg_cron;
insert into settings (key, value) values ('todo:remind', jsonb_build_object('key', encode(gen_random_bytes(18),'hex'))) on conflict (key) do nothing;
select cron.schedule('todo-reminders-11am-5pm', '0 15,16,21,22 * * *', $c$select net.http_get('https://nextownermarket.com/api/todo/remind?key=' || (select value->>'key' from public.settings where key='todo:remind'), timeout_milliseconds := 60000)$c$);
-- Private settings (keys with ":" such as counters, errors, one-time links and the reminder key) readable by staff only.
do $$ begin
  drop policy if exists "settings public read" on public.settings;
  create policy "settings public read" on public.settings for select using (position(':' in key) = 0 or public.is_staff());
end $$;
-- Oct 5, 2026 (evening): retries at :20 and :40 in case the :00 send fails (the route releases the slot on failure).
select cron.schedule('todo-reminders-11am-5pm', '0,20,40 15,16,21,22 * * *', $c$select net.http_get('https://nextownermarket.com/api/todo/remind?key=' || (select value->>'key' from public.settings where key='todo:remind'), timeout_milliseconds := 60000)$c$);

