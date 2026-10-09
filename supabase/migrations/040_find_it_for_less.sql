-- Find it for less (Oct 9, 2026): saved finds live in "My lookups", and "Let us find it for you" requests go to the
-- same Wanted list staff already work (sourcing_requests), marked kind = 'find' with the AI's answer attached.
alter table lookups drop constraint if exists lookups_tool_check;
alter table lookups add constraint lookups_tool_check check (tool in ('worth','buy_or_pass','pile','find'));
alter table sourcing_requests add column if not exists kind text not null default 'item';
alter table sourcing_requests add column if not exists details jsonb;
