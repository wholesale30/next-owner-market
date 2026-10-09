---
title: "App Builder's Playbook"
subtitle: "How Shayne and Claude build apps strong and right the first time. Everything learned building Next Owner Market (Sept 29 to Oct 5, 2026), ready to reuse on any app or website."
---

# How to use this

**Version 1.2, October 5, 2026.** Written from Next Owner Market (nextownermarket.com): 7 days of building, 240+ changes, about 8,000 lines of verbatim conversation.

| Version | What changed |
|---|---|
| 1.0 (Oct 5) | First version, from Next Owner Market. |
| 1.1 (Oct 5) | The political posting app's Claude added "Lessons from the Political Posting App." |
| 1.2 (Oct 5) | Next Owner Market's Claude merged those lessons into the main sections (rules, schedule, gotchas, trial and error) and kept the political section whole. Added "From Next Owner Market back to the Political Posting App" (things worth copying back) and the shared email limit both apps live under. Next Owner Market adopted four of the political app's ideas the same night (section 15). |

This has two parts.

- **Part 1: the Owner's To-do and twice-a-day reminder.** It's an exact handoff. Another Claude can rebuild it in a different app without guessing. The code is the real code, pulled straight from the project files when this was made.
- **Part 2: the Playbook.** How we work, the order to set up a new app, the patterns that worked, every trial and error with its fix, costs, platform gotchas and the rules. Use it for any app or website.

**For Shayne:** give this file to Claude at the start of any new project. Say: *"Read the App Builder's Playbook first, then follow it."* The same rules are also saved as a Claude skill (app-builder-playbook), so they load on their own in any chat.

**For any Claude reading this:**

1. Read Part 2, section 1 (the rules) and section 2 (the day-zero checklist) before writing any code.
2. Follow the operating rules in Appendix A exactly. They are the owner's own words, earned the hard way.
3. Add what you learn using the format in Part 2, section 16, so the next app gets it too.

**For the Claude building the political posting app (version 1.2 and later):**

1. Read **"From Next Owner Market back to the Political Posting App"** (near the end). It lists what to copy from Next Owner Market, starting with the most valuable.
2. Keep this file whole. Add anything new **under your own section**, as a sub-heading like "Added in v1.3 (date)," in the section-16 format.
3. Bump the version and add a line to the version table.

Shayne carries each copy back and forth, and Next Owner Market's Claude merges it into the master. The master lives in Next Owner Market (`docs/playbook/template.md`) and is rebuilt into every zip.

# PART 1: The Owner's To-do and Twice-a-Day Reminder

## 1.1 What it does

- **The page.** A page at **/app/todo**, for the owner and staff only. Each item has:
  - a big green **✓** button,
  - a colored urgency (🔴 Urgent, 🟡 Needed, ⚪ Someday),
  - an optional due date,
  - notes, which hold the step-by-step "how to do it,"
  - a reminder choice,
  - snooze.
- **The reminder.** At **11:00 AM and 5:00 PM Eastern**, every day, the owner gets the **whole open list** by **email and by text**:
  - urgent first,
  - LATE or due flags,
  - a **"HOW TO DO THE URGENT ONES"** section with the steps for each urgent item,
  - a **"Coming later"** line for snoozed items,
  - a link to the page at the bottom.
- **When it stops.** An item stops being sent as soon as its ✓ is tapped. Nothing is ever really deleted: deletes go to a recycle bin.
- **The badge.** The app's menu shows **📝 To-do (N)**, and a green banner on every page says "N things on your to-do list need you."
- **Who adds items.** Claude adds items itself, by SQL, whenever something comes up in a chat that only the owner can do. The owner can add items by typing or by voice.

## 1.2 The database

### The table, exactly as it is live

The columns were read from the live database on October 5, 2026.

| Column | Type | Rule | What it's for |
|---|---|---|---|
| `id` | uuid | primary key, default `gen_random_uuid()` | |
| `title` | text | required | The item, in plain words. This is what shows in the list and the reminder. |
| `notes` | text | optional | **The steps** ("how to do it"). Shown when you tap an item, and in the reminder's "HOW TO DO THE URGENT ONES" section for urgent items. There is no separate "steps" column. |
| `priority` | text | `urgent`, `needed` or `someday`; default `needed` | Urgency. 🔴 / 🟡 / ⚪. |
| `due_date` | date | optional | Drives the "due today / tomorrow / N days LATE" flags. |
| `remind` | text | `weekly`, `due` or `none`; default `weekly` | `weekly` (the name is from before the change) means **in every reminder**. `due` means only once it's due within 3 days or late. `none` means never sent. |
| `done_at` | timestamptz | empty until done | The ✓. Set means done. Done items are never sent. "Not done" clears it. |
| `snooze_until` | date | optional | **This is the "start date."** Until this date the item isn't sent, and it shows under "Coming later" and "😴 Snoozed." Example: "request the Google review" is snoozed until Oct 8 so it can't be done too early. There is no separate start-date column. |
| `last_reminded_at` | timestamptz | set by the reminder | When it was last sent. Kept for history; the twice-a-day version doesn't use it to decide anything. |
| `created_by` | uuid → profiles.id | optional | Who added it. Claude's SQL inserts leave it empty. |
| `created_at` | timestamptz | default `now()` | Sort order on the page (newest first). |

**Security.** Row-level security is on. One policy lets only staff (admin or staff role) read or change anything. There is one trigger, `trash_todos`, which copies any deleted row into the recycle bin first. There are two indexes: the primary key, and `todos_open (done_at, due_date)`.

### The real SQL that created it (migration 032)

*Source: `supabase/migrations/032_owner_todos.sql`*

```sql
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
```

### What it depends on: `is_staff()` and the recycle bin

`is_staff()` lives in the base schema. Its live definition:

```sql
CREATE OR REPLACE FUNCTION public.is_staff()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select role in ('admin','staff') from profiles where id = auth.uid()), false)
$function$
```

Signed-out visitors also need permission to call it. Otherwise any public page whose rules call it fails (see Part 2, lesson T-29):

*Source: `supabase/migrations/031_anon_is_staff.sql`*

```sql
-- Oct 1, 2026: public read policies call is_staff(); signed-out visitors need EXECUTE on it (returns false for them).
-- Without this, every listing showed "404 page not found" to anyone not signed in.
grant execute on function public.is_staff() to anon;
```

The recycle bin, which catches deletes (from migration 030):

*Source: `supabase/migrations/030_payout_pending_and_recycle_bin.sql, lines 6-23`*

```sql
create table if not exists trash (
  id bigserial primary key, batch bigint not null, table_name text not null, row_id text, title text,
  data jsonb not null, deleted_at timestamptz not null default now(), deleted_by uuid, restored_at timestamptz, restored_by uuid
);
create index if not exists trash_batch_idx on trash (batch);
create index if not exists trash_when_idx on trash (deleted_at desc);
alter table trash enable row level security;
drop policy if exists trash_staff on trash;
create policy trash_staff on trash for select using (is_staff());

create or replace function trash_capture() returns trigger language plpgsql security definer set search_path = public as $$
declare j jsonb := to_jsonb(old);
begin
  insert into trash (batch, table_name, row_id, title, data, deleted_by)
  values (txid_current(), tg_table_name, coalesce(j->>'id', j->>'code', j->>'slug'),
          left(coalesce(j->>'title', j->>'name', j->>'label', j->>'code', j->>'url', j->>'storage_path', j->>'body', tg_table_name), 200), j, auth.uid());
  return old;
end $$;
```

### The private-settings rule and the reminder's schedule (migration 039)

*Source: `supabase/migrations/039_todo_twice_daily.sql`*

```sql
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
```

### Setting it up in a brand-new app (one paste)

This is the same SQL put together for an app that doesn't have these pieces yet. It assumes a `profiles` table with `id` (= `auth.users.id`) and a `role` text or enum column. **Change the web address on the last line to the new app's.** Run it as separate statements if the database tool cancels a batch (see Part 2, T-43).

```sql
-- 1. Who counts as staff
create or replace function public.is_staff() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role::text in ('admin','staff') from profiles where id = auth.uid()), false) $$;
grant execute on function public.is_staff() to anon, authenticated;

-- 2. Recycle bin (skip if the app already has one)
create table if not exists public.trash (
  id bigserial primary key, batch bigint not null, table_name text not null, row_id text, title text,
  data jsonb not null, deleted_at timestamptz not null default now(), deleted_by uuid, restored_at timestamptz, restored_by uuid);
alter table public.trash enable row level security;
create policy trash_staff on public.trash for select using (public.is_staff());
create or replace function public.trash_capture() returns trigger language plpgsql security definer set search_path = public as $$
declare j jsonb := to_jsonb(old);
begin
  insert into trash (batch, table_name, row_id, title, data, deleted_by)
  values (txid_current(), tg_table_name, coalesce(j->>'id', j->>'code', j->>'slug'),
          left(coalesce(j->>'title', j->>'name', j->>'label', j->>'code', j->>'url', j->>'storage_path', j->>'body', tg_table_name), 200), j, auth.uid());
  return old;
end $$;

-- 3. The to-do table (identical to Next Owner Market)
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

-- 4. A settings table for the reminder's secret key (skip if the app has one), private keys staff-only
create table if not exists public.settings (key text primary key, value jsonb not null, updated_at timestamptz not null default now());
alter table public.settings enable row level security;
create policy "settings public read" on public.settings for select using (position(':' in key) = 0 or public.is_staff());
create policy "settings staff write" on public.settings for all using (public.is_staff()) with check (public.is_staff());

-- 5. The schedule (pg_net is on by default in Supabase; pg_cron is free and turned on here)
create extension if not exists pg_cron;
insert into public.settings (key, value) values ('todo:remind', jsonb_build_object('key', encode(gen_random_bytes(18),'hex'))) on conflict (key) do nothing;
select cron.schedule('todo-reminders-11am-5pm', '0 15,16,21,22 * * *',
  $c$select net.http_get('https://YOUR-APP-DOMAIN/api/todo/remind?key=' || (select value->>'key' from public.settings where key='todo:remind'), timeout_milliseconds := 60000)$c$);
```

## 1.3 The to-do page (/app/todo)

The page is two files: a server page that checks the person is staff and loads the items, and a client part with the buttons.

*Source: `src/app/app/todo/page.tsx`*

```tsx
import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import TodoClient, { type Todo } from "./TodoClient";

export const metadata = { title: "To-do" };
export const revalidate = 0;

export default async function TodoPage() {
  const me = await getProfile();
  if (!me || (me.role !== "admin" && me.role !== "staff")) redirect("/app");
  const supabase = await createClient();
  const { data } = await supabase.from("todos").select("id, title, notes, priority, due_date, remind, done_at, snooze_until, created_at").order("created_at", { ascending: false }).limit(500);
  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl font-bold">📝 To-do</h1>
        <p className="text-sm muted">Your assistant&apos;s list. Add anything here (or tell Claude). Your whole list comes by email and text at 11 AM and 5 PM. Tap ✓ when something is done and it stops coming.</p>
      </div>
      <TodoClient initial={(data || []) as Todo[]} meId={me.id} />
    </div>
  );
}
```

*Source: `src/app/app/todo/TodoClient.tsx`*

```tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Mic from "@/components/Mic";

export type Todo = { id: string; title: string; notes: string | null; priority: "urgent" | "needed" | "someday"; due_date: string | null; remind: "weekly" | "due" | "none"; done_at: string | null; snooze_until: string | null; created_at: string };

const PRI = { urgent: { label: "🔴 Urgent", color: "var(--danger)" }, needed: { label: "🟡 Needed", color: "var(--accent)" }, someday: { label: "⚪ Someday", color: "var(--line)" } } as const;
const REMIND = { weekly: "Remind me at 11 AM and 5 PM", due: "Only once it's due within 3 days", none: "Don't remind me" } as const;
const todayISO = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const daysUntil = (d: string) => Math.round((new Date(d + "T12:00:00").getTime() - new Date(todayISO() + "T12:00:00").getTime()) / 86400_000);
function dueText(d: string) {
  const n = daysUntil(d);
  if (n < 0) return `⚠️ ${-n} day${n === -1 ? "" : "s"} late`;
  if (n === 0) return "Due today";
  if (n === 1) return "Due tomorrow";
  return `Due ${new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`;
}

export default function TodoClient({ initial, meId }: { initial: Todo[]; meId: string }) {
  const sb = createClient();
  const [todos, setTodos] = useState<Todo[]>(initial);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<Todo["priority"]>("needed");
  const [due, setDue] = useState("");
  const [remind, setRemind] = useState<Todo["remind"]>("weekly");
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);

  async function add() {
    if (!title.trim()) return;
    const row = { title: title.trim(), notes: notes.trim() || null, priority, due_date: due || null, remind, created_by: meId };
    const { data, error } = await sb.from("todos").insert(row).select("id, title, notes, priority, due_date, remind, done_at, snooze_until, created_at").single();
    if (error || !data) return setMsg(error?.message || "Couldn't save. Try again.");
    setTodos([data as Todo, ...todos]); setTitle(""); setNotes(""); setDue(""); setPriority("needed"); setRemind("weekly"); setMore(false);
    setMsg("Added ✓"); setTimeout(() => setMsg(null), 1500);
  }
  async function patch(id: string, p: Partial<Todo>) {
    setTodos((t) => t.map((x) => (x.id === id ? { ...x, ...p } : x)));
    await sb.from("todos").update(p).eq("id", id);
  }
  async function remove(id: string) {
    if (!confirm("Delete this to-do? (You can bring it back from 🗑 Deleted.)")) return;
    setTodos((t) => t.filter((x) => x.id !== id));
    await sb.from("todos").delete().eq("id", id);
  }
  function snoozeWeek(id: string) {
    const d = new Date(); d.setDate(d.getDate() + 7);
    patch(id, { snooze_until: d.toLocaleDateString("en-CA", { timeZone: "America/New_York" }) });
  }

  const today = todayISO();
  const live = todos.filter((t) => !t.done_at);
  const snoozed = live.filter((t) => t.snooze_until && t.snooze_until > today);
  const active = live.filter((t) => !(t.snooze_until && t.snooze_until > today));
  const dueNow = active.filter((t) => t.due_date && daysUntil(t.due_date) <= 3).sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));
  const rest = active.filter((t) => !dueNow.includes(t));
  const groups: { title: string; rows: Todo[] }[] = [
    { title: "⏰ Due now or soon", rows: dueNow },
    { title: PRI.urgent.label, rows: rest.filter((t) => t.priority === "urgent") },
    { title: PRI.needed.label, rows: rest.filter((t) => t.priority === "needed") },
    { title: PRI.someday.label, rows: rest.filter((t) => t.priority === "someday") },
    { title: "😴 Snoozed", rows: snoozed },
  ];
  const done = todos.filter((t) => t.done_at).sort((a, b) => (a.done_at! > b.done_at! ? -1 : 1)).slice(0, 40);

  return (
    <div className="space-y-4">
      <div className="card p-3 space-y-2">
        <div className="space-y-1">
          <textarea className="input text-base" rows={2} style={{ minHeight: 56, fieldSizing: "content" } as React.CSSProperties} placeholder="What do you need to remember? (tap the mic and say it)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Mic onText={(t) => setTitle((h) => (h ? h.trimEnd() + " " : "") + t)} />
        </div>
        <div className="grid grid-cols-3 gap-1">
          {(Object.keys(PRI) as Todo["priority"][]).map((p) => (
            <button key={p} type="button" className="navbtn justify-center" style={priority === p ? { outline: `3px solid ${PRI[p].color}`, fontWeight: 700 } : {}} onClick={() => setPriority(p)}>{PRI[p].label}</button>
          ))}
        </div>
        <label className="block text-sm"><span className="font-semibold">Due date (optional)</span><input type="date" className="input mt-1" value={due} onChange={(e) => setDue(e.target.value)} /></label>
        <button type="button" className="text-xs underline" onClick={() => setMore(!more)}>{more ? "Hide" : "More: notes, how to remind me"}</button>
        {more && (
          <div className="space-y-2">
            <textarea className="input" rows={2} style={{ minHeight: 56, fieldSizing: "content" } as React.CSSProperties} placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <select className="input" value={remind} onChange={(e) => setRemind(e.target.value as Todo["remind"])}>{(Object.keys(REMIND) as Todo["remind"][]).map((r) => <option key={r} value={r}>{REMIND[r]}</option>)}</select>
          </div>
        )}
        <button type="button" className="btn btn-primary w-full text-lg" disabled={!title.trim()} onClick={add}>➕ Add to my list</button>
        {msg && <p className="text-sm text-center" style={{ color: "var(--ok)" }}>{msg}</p>}
      </div>

      {!active.length && !snoozed.length && <div className="card p-4 text-center"><p className="text-3xl">🎉</p><p className="font-semibold">Nothing on your list. Nice work.</p></div>}

      {groups.filter((g) => g.rows.length).map((g) => (
        <div key={g.title} className="space-y-2">
          <p className="font-bold">{g.title} <span className="muted font-normal">({g.rows.length})</span></p>
          {g.rows.map((t) => (
            <div key={t.id} className="card p-3" style={{ borderLeft: `6px solid ${PRI[t.priority].color}` }}>
              <div className="flex items-start gap-3">
                <button type="button" aria-label="Mark done" className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold" style={{ border: "3px solid var(--ok)", color: "var(--ok)" }} onClick={() => patch(t.id, { done_at: new Date().toISOString() })}>✓</button>
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen(open === t.id ? null : t.id)}>
                  <p className="font-semibold text-base">{t.title}</p>
                  <p className="text-xs muted">{t.due_date ? dueText(t.due_date) : "No due date"}{t.snooze_until && t.snooze_until > today ? ` · snoozed until ${t.snooze_until}` : ""}{t.notes ? " · tap for notes" : ""}</p>
                </button>
              </div>
              {open === t.id && (
                <div className="pt-3 space-y-2 text-sm">
                  {t.notes && <p className="whitespace-pre-wrap">{t.notes}</p>}
                  <div className="grid grid-cols-3 gap-1">{(Object.keys(PRI) as Todo["priority"][]).map((p) => <button key={p} type="button" className="navbtn justify-center text-xs" style={t.priority === p ? { outline: `3px solid ${PRI[p].color}` } : {}} onClick={() => patch(t.id, { priority: p })}>{PRI[p].label}</button>)}</div>
                  <label className="block"><span className="text-xs font-semibold">Due date</span><input type="date" className="input" value={t.due_date || ""} onChange={(e) => patch(t.id, { due_date: e.target.value || null })} /></label>
                  <select className="input" value={t.remind} onChange={(e) => patch(t.id, { remind: e.target.value as Todo["remind"] })}>{(Object.keys(REMIND) as Todo["remind"][]).map((r) => <option key={r} value={r}>{REMIND[r]}</option>)}</select>
                  <div className="flex gap-2">
                    {t.snooze_until && t.snooze_until > today ? <button type="button" className="btn flex-1" onClick={() => patch(t.id, { snooze_until: null })}>Wake it up</button> : <button type="button" className="btn flex-1" onClick={() => snoozeWeek(t.id)}>😴 Snooze a week</button>}
                    <button type="button" className="btn flex-1" onClick={() => remove(t.id)}>Delete</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}

      {!!done.length && (
        <div className="space-y-2">
          <button type="button" className="text-sm underline" onClick={() => setShowDone(!showDone)}>{showDone ? "Hide" : "Show"} done ({done.length})</button>
          {showDone && done.map((t) => (
            <div key={t.id} className="card p-3 flex items-center justify-between gap-2 text-sm">
              <span><span style={{ color: "var(--ok)" }}>✓ Done</span> · {t.title}</span>
              <button type="button" className="text-xs underline shrink-0" onClick={() => patch(t.id, { done_at: null })}>Not done</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**How the check mark works.** The green ✓ calls `patch(t.id, { done_at: new Date().toISOString() })`.

1. The screen updates instantly (optimistic update).
2. Then the change is saved straight to the database from the browser.
3. Row-level security allows it only for staff.

The item moves to "Show done." **"Not done"** sets `done_at` back to `null`.

**How items are added.** There's a big box at the top with a 🎤 mic, so he can talk. Then:

1. Three urgency buttons (Needed is preselected).
2. An optional due date.
3. "More" holds the notes and the reminder choice. Advanced things are hidden so a beginner sees one obvious action.
4. **➕ Add to my list** inserts the row and shows "Added ✓."

**How "stops reminding you" works.** The reminder only reads rows where `done_at is null`. Tapping ✓ fills `done_at`, so from the next reminder on, the item is gone. There's no other switch.

Other ways to quiet an item:

- 😴 **Snooze a week** sets `snooze_until`.
- The reminder choice set to **Don't remind me**.
- **Delete**, which moves the item to the recycle bin (🗑 Deleted), where it can be brought back.

**How the page groups items.** "⏰ Due now or soon" (due within 3 days or late) comes first, then Urgent, Needed and Someday, then 😴 Snoozed. Each card has a colored left edge in its urgency color.

**What it uses from the rest of the app** (bring these along or swap them; see 1.11):

- `getProfile()` and `createClient()` from `src/lib/supabase/server.ts` and `client.ts`.
- The `Mic` component from `src/components/Mic.tsx`. It's browser speech-to-text that restarts itself after Android's short silences.
- The CSS classes `card`, `btn`, `btn-primary`, `navbtn`, `input` and `muted`.
- The CSS colors `--danger`, `--accent`, `--line` and `--ok`, from `src/app/globals.css`.

### The badge and banner in the app menu

*Source: `src/app/app/layout.tsx, lines 9-16`*

```tsx
/** Today and 3 days out, as YYYY-MM-DD in Eastern time (for the to-do badge). */
function nyDays() {
  const f = (t: number) => new Date(t).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const now = Date.now();
  return { today: f(now), soon: f(now + 3 * 86400_000) };
}

export default async function AppLayout({ children }: LayoutProps<"/app">) {
```

*Source: `src/app/app/layout.tsx, lines 30-35`*

```tsx
  let pendingPeople = 0, pendingReview = 0, todoNow = 0, newFeedback = 0;
  if (staff) {
    const { today, soon } = nyDays();
    const { data: td } = await supabase.from("todos").select("priority, due_date, snooze_until").is("done_at", null);
    todoNow = (td || []).filter((t) => !(t.snooze_until && t.snooze_until > today) && (t.priority === "urgent" || (t.due_date && t.due_date <= soon))).length;
    pendingReview = (await supabase.from("items").select("id", { count: "exact", head: true }).eq("status", "pending_review")).count || 0;
```

The menu link shows `📝 To-do (N)`, and the green banner says "📝 N things on your to-do list need you. Tap to see." N counts items that aren't done or snoozed **and** are urgent or due within 3 days.

## 1.4 The twice-a-day email and text

### The code that builds it

It's one "automation" in `src/lib/automations.ts`, called `secretary`:

*Source: `src/lib/automations.ts, lines 632-662`*

```ts
const secretary: Automation = {
  key: "todo_reminders", name: "To-do reminders (your assistant)", schedule: "twice a day: 11 AM and 5 PM", sort_order: 2,
  what: "At 11 AM and 5 PM (Eastern) it sends you your whole open 📝 To-do list, urgent first, with how-to steps for the urgent ones. Comes by email and by text. Items stop once you tap ✓, and snoozed items wait until their date.",
  why: "You run a hundred things. Nothing you put on the list gets forgotten, and you see the full picture twice a day.",
  async run() {
    const d = db();
    const { data: rows } = await d.from("todos").select("id, title, notes, priority, due_date, remind, snooze_until").is("done_at", null);
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    const until = (x: string) => Math.round((new Date(x + "T12:00:00").getTime() - new Date(today + "T12:00:00").getTime()) / 86400_000);
    // remind: "weekly" (the default) = in every reminder; "due" = only once it's due within 3 days or late; "none" = never.
    const list = (rows || []).filter((t) => !(t.snooze_until && t.snooze_until > today) && (t.remind === "weekly" || (t.remind === "due" && !!t.due_date && until(t.due_date) <= 3)));
    if (!list.length) return { open: 0, sent: "list is empty" };
    const label = (t: { due_date: string | null }) => { if (!t.due_date) return ""; const n = until(t.due_date); return n < 0 ? ` (${-n}d LATE)` : n === 0 ? " (due TODAY)" : n === 1 ? " (due tomorrow)" : ` (due ${t.due_date})`; };
    const order = { urgent: 0, needed: 1, someday: 2 } as const;
    list.sort((a, b) => order[a.priority as keyof typeof order] - order[b.priority as keyof typeof order] || (a.due_date || "9").localeCompare(b.due_date || "9"));
    const icon = { urgent: "🔴", needed: "🟡", someday: "⚪" } as Record<string, string>;
    const urgent = list.filter((t) => t.priority === "urgent");
    const lateN = list.filter((t) => t.due_date && until(t.due_date) < 0).length;
    const waiting = (rows || []).filter((t) => t.snooze_until && t.snooze_until > today);
    const body = `Everything open on your list (${list.length}):\n` + list.map((t) => `${icon[t.priority] || "•"} ${t.title}${label(t)}`).join("\n")
      + (urgent.some((t) => t.notes) ? "\n\nHOW TO DO THE URGENT ONES\n" + urgent.filter((t) => t.notes).map((t) => `🔴 ${t.title}\n${t.notes}`).join("\n\n") : "")
      + (waiting.length ? `\n\nComing later: ${waiting.map((t) => `${t.title} (from ${t.snooze_until})`).join("; ")}` : "")
      + "\n\nTap ✓ on each one when it's done and it stops reminding you:";
    const subject = `📝 To-do: ${list.length} open${urgent.length ? `, ${urgent.length} urgent` : ""}${lateN ? `, ${lateN} late` : ""}`;
    const { alertStaff } = await import("@/lib/alert");
    const ok = await alertStaff(subject, body, "/app/todo", { longText: true });
    await d.from("todos").update({ last_reminded_at: new Date().toISOString() }).in("id", list.map((t) => t.id));
    return { open: list.length, urgent: urgent.length, sent: ok };
  },
};

```

### The exact rules

| Rule | Exactly |
|---|---|
| **Which items are sent** | Not done (`done_at is null`) **and** not snoozed (no `snooze_until`, or it's today or earlier) **and** either `remind = 'weekly'`, or `remind = 'due'` and the due date is within 3 days or past. `remind = 'none'` is never sent. |
| **Order** | Urgent, then Needed, then Someday. Inside each, the earliest due date first; no due date goes last. |
| **Dots** | 🔴 urgent, 🟡 needed, ⚪ someday. |
| **Urgent** | Only what the owner or Claude set as `priority = 'urgent'`. It is **not** automatic from the date. |
| **LATE** | The due date is before today (Eastern time): `(N d LATE)`. Today is `(due TODAY)`, tomorrow is `(due tomorrow)`, later is `(due YYYY-MM-DD)`. |
| **"Today"** | The calendar date in **America/New_York**, compared at noon so daylight saving can't shift a day. |
| **Subject line** | `📝 To-do: {count} open` + `, {N} urgent` if any + `, {N} late` if any. Example: `📝 To-do: 12 open, 5 urgent, 2 late`. |
| **HOW TO DO THE URGENT ONES** | For each urgent item that has notes: the 🔴 title, then the notes word for word. |
| **Coming later** | Every not-done item whose `snooze_until` is after today: `Title (from YYYY-MM-DD)`, separated by semicolons. It isn't counted in the subject. |
| **Bottom** | "Tap ✓ on each one when it's done and it stops reminding you:" plus the full link to /app/todo. The link is added by `alertStaff`. |
| **Nothing to send** | No email goes out. The run records "list is empty." |
| **Who it goes to** | Everyone in the alert list (see 1.6). |

### A real one, as sent on October 5, 2026 at 1:29 PM

```
Subject: 📝 To-do: 12 open, 5 urgent, 2 late

Everything open on your list (12):
🔴 Sign up for Amazon Associates (and eBay Partner Network) (1d LATE)
🔴 Google Shopping fix 1 of 4: Merchant Center business details (due tomorrow)
🔴 Google Shopping fix 2 of 4: Merchant Center return policy (due tomorrow)
🔴 Google Shopping fix 3 of 4: verify your identity if Merchant Center asks (due tomorrow)
🔴 Facebook Page auto-post: paste Page ID and token to Claude
🟡 Film your first Goodwill "Buy or pass?" video (1d LATE)
🟡 Confirm 2 promises on the new pages (or tell Claude new numbers) (due 2026-10-07)
🟡 Decide: Vercel Pro ($20/month) before real sales (due 2026-10-09)
🟡 Replace text alerts before Verizon ends email-to-text (due 2027-02-01)
🟡 Sales tax: decide and start collecting
🟡 Google Search Console: confirm the sitemap is submitted
⚪ Estate Pack: one short Virginia lawyer consult

HOW TO DO THE URGENT ONES
🔴 Google Shopping fix 1 of 4: Merchant Center business details
merchants.google.com → Settings (gear) → Business info → Edit business details. Name: Next Owner Market. ...
(each urgent item, with its full steps)

Coming later: Google Shopping fix 4 of 4: request ONE review (Thursday Oct 8 or later) (from 2026-10-08)

Tap ✓ on each one when it's done and it stops reminding you: https://nextownermarket.com/app/todo
```

### The automation frame it runs inside

Every automatic job in the app has a name, a plain-English "what" and "why," and a recorded last result, and can be switched off from the Operations page. The to-do reminder is one of them. The frame:

*Source: `src/lib/automations.ts, lines 21-23`*

```ts
type Result = Record<string, unknown>;
type Automation = { key: string; name: string; what: string; why: string; schedule: string; sort_order: number; run: () => Promise<Result> };

```

*Source: `src/lib/automations.ts, lines 739-759`*

```ts
export async function runAutomations(only?: string): Promise<Record<string, Result>> {
  const d = db();
  await registerAutomations();
  const { data: rows } = await d.from("automations").select("key, enabled");
  const enabled = new Map((rows || []).map((r) => [r.key, r.enabled]));
  const out: Record<string, Result> = {};
  for (const a of AUTOMATIONS) {
    if (only && a.key !== only) continue;
    if (!only && a.key === "held_money_timers") continue; // done inline in the daily job
    if (!only && a.key === "backups") continue;            // done inline too
    if (!only && a.key === "todo_reminders") continue;     // runs at 11 AM and 5 PM from /api/todo/remind
    if (enabled.get(a.key) === false) { out[a.key] = { skipped: "switched off" }; continue; }
    const started = Date.now();
    try { out[a.key] = await a.run(); } catch (e) { out[a.key] = { error: e instanceof Error ? e.message : String(e) }; }
    out[a.key].ms = Date.now() - started;
    await d.from("automations").update({ last_run_at: new Date().toISOString(), last_result: out[a.key] }).eq("key", a.key);
    await d.rpc("bump_automation_runs", { p_key: a.key }).then(() => {}, () => {});
  }
  return out;
}

```

The line `if (!only && a.key === "todo_reminders") continue;` keeps the reminder out of the 9 AM daily job, so it only runs at 11 and 5.

**If the new app has no automation frame,** call the reminder function directly from the route in 1.5. Copy the body of `run()` into an exported `async function sendTodoDigest()` and call that instead of `runAutomations("todo_reminders")`.

## 1.5 How it's scheduled

| Item | Exactly |
|---|---|
| **Service** | **Supabase pg_cron** (built-in, free) plus **pg_net**. The database itself calls the website. |
| **Why not Vercel cron** | On the free (Hobby) plan, Vercel cron runs at most once a day and only promises "sometime within the hour." The owner asked for 11:00 and 5:00 exactly. |
| **Job name** | `todo-reminders-11am-5pm` |
| **Schedule** | `0,20,40 15,16,21,22 * * *` (UTC). The :20 and :40 calls are retries. |
| **What it calls** | `GET https://nextownermarket.com/api/todo/remind?key=<secret from settings 'todo:remind'>` |
| **Daylight saving** | In summer (EDT, UTC−4), 15:00 UTC = 11 AM and 21:00 = 5 PM. In winter (EST, UTC−5), 16:00 UTC = 11 AM and 22:00 = 5 PM. All four fire; the route sends only when the New York hour is **11 or 17**. The other two calls answer "skipped" and send nothing. Nothing has to change when the clocks change. |
| **No doubles, no misses** | The route saves `last_slot` (e.g. `2026-10-05 17`) in settings and won't send the same slot twice. If the send fails, it releases the slot, so the :20 (or :40) call sends it instead. The release idea came from the political app (PP-T7). |
| **Checked live** | On October 5, 2026 the 21:00 and 22:00 UTC runs both ran "succeeded." The automation recorded a send at 5:00:07 PM: 12 open, 5 urgent. |

The route:

*Source: `src/app/api/todo/remind/route.ts`*

```ts
import { NextResponse } from "next/server";
import { admin } from "@/lib/stripe";
import { runAutomations } from "@/lib/automations";

/**
 * The owner's to-do list by email and text at 11 AM and 5 PM Eastern (asked for Oct 5, 2026).
 * Called by the database's scheduler (pg_cron) at :00, :20 and :40 of 15, 16, 21 and 22 UTC, so it lands on 11 and 5 in
 * both summer and winter time; only calls that fall in the 11 or 5 o'clock hour in New York count, and a slot sends once
 * (the :20 and :40 calls are retries in case :00 failed).
 * The key lives in settings "todo:remind" (readable by staff only).
 */
export const maxDuration = 60;
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key") || "";
  const db = admin();
  const { data } = await db.from("settings").select("value").eq("key", "todo:remind").maybeSingle();
  const v = (data?.value as { key?: string; last_slot?: string }) || {};
  if (!key || key !== v.key) return NextResponse.json({ error: "not allowed" }, { status: 403 });
  const now = new Date();
  const hour = Number(now.toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }));
  if (hour !== 11 && hour !== 17) return NextResponse.json({ skipped: `it's ${hour}:00 in New York` });
  const slot = `${now.toLocaleDateString("en-CA", { timeZone: "America/New_York" })} ${hour}`;
  if (v.last_slot === slot) return NextResponse.json({ skipped: "already sent this slot" });
  await db.from("settings").update({ value: { ...v, last_slot: slot } }).eq("key", "todo:remind");
  const ran = await runAutomations("todo_reminders");
  // If it didn't go out, release the slot so the retry call 20 minutes later can send it (pattern from the political posting app).
  const r = ran.todo_reminders as { sent?: unknown; error?: unknown } | undefined;
  if (!r || r.error || r.sent === false) await db.from("settings").update({ value: { ...v, last_slot: v.last_slot || null } }).eq("key", "todo:remind");
  return NextResponse.json({ slot, ran });
}
```

`admin()` is the server-only database client with full access (it lives in `src/lib/stripe.ts` in this app; see 1.11):

```ts
export function admin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}
```

**To see the schedule and its runs:**

```sql
select jobid, jobname, schedule, command, active from cron.job;
select status, start_time, return_message from cron.job_run_details order by start_time desc limit 10;
```

**To send one right now** (for testing, outside 11 and 5), use the single-use "kick" link. Claude puts a token in settings, then has the database call it:

```sql
insert into settings (key, value) values ('ops:kick', jsonb_build_object('token','pick-a-random-string','only',jsonb_build_array('todo_reminders'),
  'expires', to_char((now()+interval '10 minutes') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"')))
  on conflict (key) do update set value=excluded.value;
select net.http_get('https://nextownermarket.com/api/ops/kick?token=pick-a-random-string', timeout_milliseconds := 60000);
```

*Source: `src/app/api/ops/kick/route.ts`*

```ts
import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { runAutomations, setCatchup } from "@/lib/automations";

/**
 * Single-use trigger: runs chosen automations once when called with a token that staff (or Claude, via SQL)
 * just put in settings key "ops:kick". The token is erased before anything runs, so a link can't be reused.
 */
export const maxDuration = 300;
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  const db = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data } = await db.from("settings").select("value").eq("key", "ops:kick").maybeSingle();
  const v = data?.value as { token?: string; only?: string[]; catchup?: boolean; expires?: string } | undefined;
  if (!token || !v?.token || v.token !== token || (v.expires && v.expires < new Date().toISOString())) return NextResponse.json({ error: "not allowed" }, { status: 403 });
  await db.from("settings").delete().eq("key", "ops:kick");
  setCatchup(!!v.catchup);
  const out: Record<string, unknown> = {};
  try { for (const k of v.only || []) Object.assign(out, await runAutomations(k)); } finally { setCatchup(false); }
  return NextResponse.json({ ok: true, ran: out });
}
```

## 1.6 How the email and text are sent

| Item | Exactly |
|---|---|
| **Email service** | **Resend** (resend.com), through its HTTPS API. |
| **Free?** | Yes, on the free plan: **3,000 emails a month and 100 a day.** Two reminders a day uses 60 a month. Paid is $20/month for 50,000. |
| **The text message** | Also free. It's the same email sent to the phone company's email-to-text address. For Verizon, `8047207910@vtext.com` becomes a normal text. For the long to-do list it's switched to **`@vzwpix.com`** (picture message), so the whole list arrives instead of being cut at 160 characters. |
| **Who receives it** | The env var `STAFF_ALERT_TO` if set, otherwise `settings.business.alert_to` (comma-separated), otherwise `settings.business.contact_email`. In Next Owner Market it's `settings.business.alert_to` = the Verizon number's text address plus two email addresses. |
| **Sender** | `EMAIL_FROM` if set. Otherwise "Next Owner Market <onboarding@resend.dev>". Sending as your own domain requires verifying the domain in Resend (DNS records). An unverified domain fails; see T-26. |
| **Nothing lost** | Every alert is first written to the `notifications` table, then sent. |

*Source: `src/lib/alert.ts`*

```ts
import { admin } from "@/lib/stripe";

/**
 * Instant staff alert (new seller, new order, problem report, new message).
 * Sends by email through Resend when RESEND_API_KEY is set. A phone's email-to-text
 * address (e.g. 5551234567@vtext.com) in STAFF_ALERT_TO makes it arrive as a text, free.
 * Always queues a row in notifications so nothing is lost if sending isn't set up yet.
 */
export async function alertStaff(subject: string, body: string, link?: string, opts: { longText?: boolean } = {}) {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://nextownermarket.com";
  const url = link ? `${site}${link}` : site;
  const db = admin();
  const { data: biz } = await db.from("settings").select("value").eq("key", "business").maybeSingle();
  const b = (biz?.value as { contact_email?: string; alert_to?: string; name?: string }) || {};
  let to = (process.env.STAFF_ALERT_TO || b.alert_to || b.contact_email || "").split(",").map((s) => s.trim()).filter(Boolean);
  // A long message (the full to-do list) goes to Verizon's picture-message address so the whole thing arrives
  // as one text instead of being cut at 160 characters.
  if (opts.longText) to = to.map((a) => a.replace(/@vtext\.com$/i, "@vzwpix.com"));
  await db.from("notifications").insert({ contact: to[0] || null, channel: "email", subject, body: `${body} ${url}`, sent_at: process.env.RESEND_API_KEY && to.length ? new Date().toISOString() : null });
  if (!process.env.RESEND_API_KEY || !to.length) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM || `${b.name || "Next Owner Market"} <onboarding@resend.dev>`, to, subject, text: `${body}\n${url}` }),
    });
    return r.ok;
  } catch {
    return false;
  }
}
```

### Every environment variable this feature needs (names only)

| Name | What it is | Where it's set |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | The Supabase project address | Vercel → Project → Settings → Environment Variables (Production), and `.env.local` for local runs |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public ("publishable") key: page and browser client | Vercel env vars |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secret key: the server-only `admin()` client the reminder uses | Vercel env vars (never in browser code) |
| `RESEND_API_KEY` | Resend key (a send-only key is enough) | Vercel env vars |
| `EMAIL_FROM` | Optional. The "From" line, e.g. `Next Owner Market <alerts@nextownermarket.com>` | Vercel env vars |
| `STAFF_ALERT_TO` | Optional. Overrides who gets alerts | Vercel env vars |
| `NEXT_PUBLIC_SITE_URL` | The site address used in the link at the bottom | Vercel env vars |

**Not environment variables:**

- The reminder's secret key lives in the database: `settings` key `todo:remind`, readable by staff only.
- The alert list lives in `settings` key `business`, field `alert_to`.
- Claude sets env vars through the Vercel connector and never asks the owner to paste secrets into chat.

## 1.7 How the "how to do it" steps are written

The notes on an urgent item are what the owner reads on his phone at 11 AM. He should be able to do the task straight from the text without asking anything. The rules (from the operating rules, 2, 3 and 19, and the Merchant Center steps written on Oct 5):

1. **Start from the very first tap.** The web address to open, then each screen in order, joined with →. Example: `merchants.google.com → Settings (gear) → Business info → Edit business details.`
2. **Use the real button names, looked up, never guessed.** Search the provider's help page first and quote its menu words exactly ("Products & store → Shipping and returns → Return policies → Add return policy"). If it can't be looked up, say so and ask what he sees.
3. **Spell out every value to type or pick,** each one labeled: `Name: Next Owner Market. Customer service: website https://nextownermarket.com/contact, email …, phone 804-720-7910.` Full web addresses, exact numbers, exact choices ("Accept returns: Defective products only").
4. **Say what he'll see, and what to do if it's not there.** "If Merchant Center shows an identity check, upload your driver's license … If it never asks, tap ✓."
5. **Say when, and when not.** "Not before Thursday Oct 8 … each failed review makes the next wait longer." Use `snooze_until` so it can't show up early.
6. **Paste-ready text in quotes** when he has to type something (the review note, a bio, a message).
7. **One item = one sitting.** Split a long job into "1 of 4," "2 of 4"… so each ✓ is a real win.
8. **Plain words.** No jargon. No "simply." No "go check."
9. **Only things he must do himself.** If Claude can do it (code, database, hosting, DNS by API), Claude does it, and it never goes on his list.

## 1.8 How Claude adds items during a chat, and how they're cleared

**When to add one.** Something comes up in the chat that only the owner can do: his logins, his ID, a payment, a decision only he can make. Claude adds it right away, without being asked, and tells him in one line.

The SQL Claude runs (through the Supabase connector):

```sql
insert into todos (title, notes, priority, due_date, remind, snooze_until) values
('Google Shopping fix 1 of 4: Merchant Center business details',
 'merchants.google.com → Settings (gear) → Business info → Edit business details. Name: Next Owner Market. ...',
 'urgent', '2026-10-06', 'weekly', null),
('Google Shopping fix 4 of 4: request ONE review (Thursday Oct 8 or later)',
 'Not before Thursday Oct 8 ... Paste: "We added a Contact page, ..."',
 'urgent', '2026-10-08', 'weekly', '2026-10-08')   -- snoozed: appears on the 8th, not before
returning title, due_date;
```

**Rules for adding:**

- Check the list first so nothing is added twice: `select title, priority, due_date, done_at is not null done from todos order by done_at nulls first;`
- Urgent only if it blocks money, sales or a deadline. Due date when there's a real one.
- Steps go in `notes`, following 1.7.
- Escape apostrophes in SQL by doubling them (`driver''s`).

**How items get cleared:**

- **The owner taps ✓** on the page. That's the normal way.
- **When Claude can see it's done** (for example, it verified the Google review was requested, or the owner says "I did it"), Claude marks it: `update todos set done_at = now() where title like 'Google Shopping fix 1 of 4%' and done_at is null;`
- **Never delete** a to-do to clear it. Done items stay in "Show done" as a record. Deleting is only for mistakes, and it goes to the recycle bin.
- **If something changes,** update the notes rather than adding a new item.

## 1.9 What went wrong building this, and the fix

| What happened | Why | Fix (now in the code) |
|---|---|---|
| The first version only sent a Monday rundown plus due-date nudges. The owner wanted everything, twice a day. | The original design (Oct 1) was "like a secretary": quiet unless something was due. | Oct 5: full list at 11 AM and 5 PM; the 9 AM daily job skips it. |
| The first manual send failed with "not allowed." | The kick token's expiry was written as `now()::text` ("2026-10-05 17:…"), and the code compares it as text to an ISO time ("2026-10-05T17:…"). A space sorts before "T," so the token looked already expired. | Always write expiry as `to_char(... at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"')`. |
| The settings table was readable by anyone on the internet (counters, error logs, one-time tokens, the reminder key). | The original policy was "settings public read: true." | Keys with ":" are staff-only (migration 039). New private keys must contain ":". |
| Long reminders would be cut at 160 characters by text. | `@vtext.com` is SMS. | `alertStaff(..., { longText: true })` sends to `@vzwpix.com` (picture message). |
| After the switch, the page still said "a reminder every Monday," and "Only when it's coming due" did nothing different. | The wording and that option weren't updated with the change. | Fixed the same evening: the heading says 11 AM and 5 PM, and `due` means "only once it's due within 3 days." |
| A failed send would have been skipped until the next slot. | The slot was claimed before sending and never released. | Release on failure, plus retry calls at :20 and :40 (v1.2, from the political app). |
| (Earlier) Vercel cron couldn't do two exact times. | The free plan allows daily cron only, sometime within the hour. | pg_cron in the database, at four UTC hours, filtered by New York hour. |
| (Earlier, Oct 1) Free email-to-text is dying. | AT&T and Cricket ended it June 17, 2025; T-Mobile, Metro and Mint around Dec 2024. Verizon plans to end it by March 31, 2027. | It's on the to-do list: "Replace text alerts before Verizon ends email-to-text" (due Feb 1, 2027). Options then: paid SMS (Twilio, about 1¢ a text, ask first), or a push notification. |

## 1.10 Checklist to rebuild it in another app

1. Run the SQL in 1.2 ("one paste"), with the new app's address on the last line.
2. Add `src/app/app/todo/page.tsx` and `TodoClient.tsx` (1.3). Swap in the new app's profile and role check, CSS classes and mic (or drop the mic).
3. Add `alertStaff` (1.6) and the reminder function (1.4). If there's no automation frame, use `sendTodoDigest()` as described in 1.4.
4. Add `src/app/api/todo/remind/route.ts` (1.5).
5. Set the env vars in 1.6 on Vercel. Set the alert list in `settings.business.alert_to` (or `STAFF_ALERT_TO`).
6. Add the 📝 To-do link and badge to the app's menu.
7. Run `npx next typegen` (new route), then lint and build, then push and deploy.
8. Test:
   - The route with the key at a non-11/5 hour must answer `skipped: it's HH:00 in New York`.
   - Send one now with the kick link.
   - Confirm the email and the text arrived.
   - Tap ✓ on one item and send again: it's gone.

## 1.11 What won't carry over to a different app, and what to change

| In Next Owner Market | In a new app |
|---|---|
| Web address `https://nextownermarket.com` inside the pg_cron job | Change it to the new app's address (and re-run `cron.schedule` under the same name to replace it). |
| `admin()` lives in `src/lib/stripe.ts` (historical accident) | Put it in `src/lib/supabase/admin.ts` and import from there. |
| Staff check uses `profiles.role` in `('admin','staff')` and `getProfile()` | Use the new app's roles. Keep the database `is_staff()` and the anon grant. |
| `runAutomations("todo_reminders")` from the big automation file | Use the standalone `sendTodoDigest()` (1.4) unless you copy the whole frame (recommended: it gives you the Operations page). |
| `alertStaff` reads `settings.business` | Make sure the new app has a `settings` row `business` with `name`, `alert_to`, `contact_email`, or set `STAFF_ALERT_TO`. |
| Times are New York (America/New_York) | Change the time zone in the route, the reminder and the page if the owner moves. |
| Verizon picture-message trick | Only works for Verizon numbers, and only until Verizon ends it (by March 31, 2027). |
| CSS classes and colors from this app's `globals.css` | Copy those few classes, or map them to the new app's design. |
| `Mic` component | Copy `src/components/Mic.tsx` (no outside service, free), or remove the mic line. |
| Next.js 16 features (`PageProps`, `LayoutProps`, async `cookies()`, `proxy.ts`) | The same if the new app is Next.js 16. If it's older, adjust (read `node_modules/next/dist/docs/` first). |
| Vercel free plan | Free is "non-commercial." Before real sales, Vercel Pro ($20/month). |
| Political app note | It already has its own Stop hook and send scripts (`scripts/refresh_docs.sh`, `scripts/mark_sent.sh`, `scripts/stop_check.py`). Keep them; they're better than what this app has for "never forget to send" (Part 2, 16). |

# PART 2: The Playbook (for any app or website)

## 1. How we work: the partnership

**The idea.** Shayne knows the customer, because he does the job himself. Claude knows how to build, look things up and write. Shayne talks (by voice, from a Samsung Z Fold 6), tests on his phone like a stranger would, and says "no, that's wrong, it should work like this." Claude fixes it the same hour. Nothing sits between the idea and the fix. That's how a complete marketplace with AI tools got built in about a week.

**The rules, in short.** The full text is in Appendix A. Each one was earned by a real mistake.

1. **Do it yourself.** Code, database, hosting, DNS, env vars: if Claude can reach it, Claude does it. "We don't wait and should add. We do it all now."
2. **Never send him to look something up.** "That's why I have you." Search, fetch, query and read, then give the answer and the exact steps.
3. **Never guess at menus or buttons.** Look up the official steps and quote them. "You should know exactly … this shouldn't even ever happen."
4. **Deliverables: Word files, in ONE dated zip, sent without being asked** after every batch of work.
5. **Phone-first.** Big thumb buttons, readable (not gray), boxes that grow, a mic on text boxes.
6. **Zero cost** unless he says yes. Anything that costs per use is sold as a profitable add-on.
7. **Gallery first, camera second.**
8. **Deploy after every change** (and confirm it's live before telling him to test).
9. **Believe what he saw on screen.**
10. **Bottom line first, short, honest. Own mistakes in one sentence.**
11. **"What do you think?"** gets an opinion with reasons, then wait for "go." Don't build from a paper he only asked you to read.
12. **Plain English for people who've never done this.**
13. **Psychology-first design:**
    - one next step per screen;
    - show value before asking;
    - checklists start partly done;
    - upsell at happy moments;
    - celebrate wins.
14. **Automate everything;** what can't be automated goes on the Operations page or his to-do list, with steps.
15. **The owner sees everything.** Every number opens to its list, and nothing is ever really deleted.
16. **Test like a stranger:** signed out, at phone width, with real data.
17. **One complete answer the first time,** every field spelled out.
18. **Records kept and sent:** the verbatim Build Journal (both sides), the Change Log, the guides.
19. **Surgical fixes only.** When he asks for one fix, change only that.
20. **Record every mistake as a rule,** as it happens.
21. **Build it complete now.** Never quote "days" or "weeks." He built the first version in a day: "How could that take two weeks? We could do it all now."
22. **Build for growth; never rebuild.** "I don't want to have to redo the app or anything. I just want to be able to add it."
23. **Search, don't guess (the political app calls it RULE ZERO),** on every fact: prices, rules, policies, menus, limits, API details. If it can't be confirmed, say "I could not confirm this" and what was checked. "I don't ask you to guess. You need to go out and look on the Internet."
24. **Filter in code anything that must never appear.** A prompt rule alone fails: price talk leaked into listings (T-36), and em dashes leaked into his political posts (PP-T1). Both are now removed in code on every output.
25. **Copy what already won before adding generic advice.** Use the owner's own best results (his posts that reached 977,000 views, his listings that sold) as the model. Generic "best practices" come second.
26. **Never say "next I'm doing X" and then go quiet.** After a long stretch of work, send a one-line status.
27. **Prove a fix is surgical.** Before a deploy, list every file that will change (`scripts/diff_check.sh`). If anything shows up that wasn't asked for, stop.

**How he talks.** Voice-typed, so words run together and swear words mean urgency, not anger at the work. "Go," "do it all" and "sweet" mean build everything discussed. Questions like "is that against the rules?" want a researched answer with sources. He tests as different accounts (admin, a buyer, real sellers like Nikki), so ask which one.

## 2. Day zero: set up a new app in this order

Do these before the first feature. Every one was learned the hard way.

1. **Connect the tools first.**
   - GitHub (install the GitHub app and link the repo; personal tokens fail behind Claude's proxy, T-19).
   - Vercel (connector; deploy without a team ID, T-35).
   - Supabase (connector; then Claude runs all SQL itself).
2. **Write CLAUDE.md** with the owner's rules (Appendix A) and the project's facts. Turn on the account skills (shayne-operating-rules, app-builder-playbook).
3. **Records system before code:**
   - `scripts/journal.py`, `scripts/changelog.py`, `scripts/package.sh` (Appendix B);
   - the hooks in `.claude/settings.json`;
   - the Stop hook (`scripts/stop_check.py`) and `scripts/mark_sent.sh`, so a turn can't end with unsent changes;
   - `scripts/diff_check.sh`, which lists what a deploy will change;
   - `docs/` with the User Guide, White Paper, Complete Guide, Operating Rules, Mission Statement and Lessons_For_Next_App.
4. **Secrets go straight into Vercel env vars,** never pasted into chat. If one gets pasted, the journal script redacts it (GitHub push protection will block it otherwise, T-15).
5. **Database foundation** (one migration):
   - `profiles` with `role`; the first account becomes admin automatically;
   - `is_staff()` **with the anon grant** (T-29);
   - `settings` (private keys contain ":");
   - the `trash` recycle bin and its trigger on every table;
   - `notifications`, `automations`, `todos`, `feedback`, `ai_usage`, `email_log`.
6. **Design every table for the features coming later** (auctions, saved searches, favorites…), so new features plug in without a rebuild. Inspect the schema before adding a table (T-34: a duplicate `watches` table almost replaced `favorites`).
7. **Sign-up done on the server, confirmed instantly** (`auth.admin.createUser({ email_confirm: true })`). No confirmation-email setting to hunt for (T-22).
8. **The Operations page** (`/app/ops`) and the automation frame from day one: what/why/last result/on-off/run now for every automatic job, plus a "Read me first" so a new hire can run it.
9. **Owner tools from day one:**
   - 📝 To-do with reminders (Part 1);
   - 💡 Ideas & problems (feedback) page;
   - 🗑 Deleted (restore anything);
   - "👁 what a buyer sees" on every item.
10. **Trust pages before any Google, Facebook or payment account,** all linked in a footer on every page:
    - Contact, About, Returns, Shipping (if selling), Terms and Privacy;
    - **no blank "____" lines anywhere**;
    - real business name, city, phone and email (T-52).
11. **Search setup:**
    - sitemap, robots and feeds, marked `force-dynamic`, returning 503 on a DB error;
    - IndexNow;
    - Search Console meta tag (verify only after the deploy is live, T-7).
12. **Email:**
    - Resend, with the domain verified before claiming anything was sent (T-26);
    - free email forwarding (ImprovMX) for a branded address.
13. **Self-tests:**
    - a daily health check that opens every public page **signed out**, makes a real AI call and checks each outside service;
    - a weekly robot user that signs up, uses the main feature and deletes itself.
14. **Phone-width screenshots** (412px for the Fold, 360px for small phones) before any screen ships.

## 3. The stack

| Piece | Choice | Version / note |
|---|---|---|
| Framework | Next.js App Router | 16.3.7 (breaking changes vs older: read `node_modules/next/dist/docs/` first) |
| UI | React, Tailwind CSS | React 19.2.8, Tailwind 4 |
| Database, sign-in, files | Supabase | `@supabase/ssr` 0.12, `@supabase/supabase-js` 2.117 |
| Hosting | Vercel | Not git-linked here, so deploy after every push |
| Payments | Stripe (Checkout, Connect Express, subscriptions) | `stripe` 22.6 |
| Email | Resend | Free 3,000/month, 100/day |
| AI | Anthropic Claude | `@anthropic-ai/sdk` 0.129; Sonnet for vision and writing, Haiku for cheap help answers |
| Photos for AI | `sharp` | Server-side resize to 1,100px (halves AI cost) |
| Background removal | `@imgly/background-removal` | Runs on the phone, $0 |
| Other | `marked` (blog), `qrcode.react` (tags), `zipcodes` (ZIP to place, offline, no API) | |
| Texts | Carrier email-to-text gateways | Free, but dying (Part 1, 1.9) |

### Folder layout

```
CLAUDE.md, AGENTS.md          rules for Claude (AGENTS.md is rewritten by `next dev`)
.claude/settings.json         hooks: journal + change log before condensing and at session end
scripts/                      journal.py, changelog.py, package.sh, build_playbook.py
docs/                         every document (.md source + .docx), brand pictures, journal sources
supabase/                     schema.sql + migrations/NNN_name.sql (every live change saved as a file)
src/proxy.ts                  Next 16's middleware: session refresh + sign-in gate for /app and /account
src/lib/                      shared logic (supabase clients, ai-tool, usage, alert, automations, stripe, ...)
src/components/               shared pieces (Mic, PhotoPicker, PhotoEditor, Help hints, UsesMeter, ...)
src/app/app/                  the signed-in seller/staff app (role-aware menu in layout.tsx)
src/app/account/              the buyer area
src/app/api/                  server routes
src/app/feed/*.xml            Google, RSS feeds; sitemap.ts, robots.ts
```

## 4. Patterns that worked (reuse them)

### 4.1 Three database connections

- **Browser:** `createBrowserClient(URL, ANON)`. Obeys row-level security.
- **Server pages:** `createServerClient` with async `cookies()`. Obeys row-level security. `getProfile()` returns the signed-in person's profile.
- **Admin:** a service-role client that bypasses security. Only in cron jobs, webhooks, automations and feeds, and only after the route has checked who's calling.

*Source: `src/lib/supabase/server.ts`*

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component; proxy.ts refreshes sessions instead.
          }
        },
      },
    }
  );
}

/** Returns the signed-in user's profile (or null). */
export async function getProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  return profile;
}
```

*Source: `src/proxy.ts`*

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Runs on every request: refreshes the Supabase session cookie and
 * gates the /app area (admin, staff, consignors) behind login.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  if ((path.startsWith("/app") || path.startsWith("/account")) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  if ((path === "/login" || path === "/signup") && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

### 4.2 Roles and security rules

- `profiles.role` is admin, staff, consignor (seller) or buyer.
- The first account is admin.
- Every table has row-level security. The policy patterns are "your own row or staff," "public can read public statuses" and "staff write."
- Internal money functions have execute **revoked** from users.
- Column grants stop people editing their own plan or credits.
- **Test signed out every time.**

### 4.3 Nothing is ever lost

There's a BEFORE DELETE trigger on every table, which snapshots the row into `trash`. `restore_trash(batch)` puts a whole delete back (an item and its photos together). The 🗑 Deleted page lists it all.

### 4.4 The settings table

One key/value table holds:

- config (`business`, `stripe`);
- counters and rate limits (`bp:ip:*`);
- idempotency keys (`topup:<session>`);
- one-time tokens (`ops:kick`, `todo:remind`);
- error logs (`err:<feature>:<time>`).

Public keys have no ":"; private keys have one.

### 4.5 Automations and the Operations page

Each job has `what`, `why`, `schedule` and `run()`. Results go into the `automations` table and show on `/app/ops` in plain English, with on/off and ▶ Run now.

The list in this app:

- **Housekeeping:** health check, to-do reminders, AI spending watch, robot new user, held-money timers, payouts ready, nightly backup.
- **Emails to people:** welcome series, seller nudges, milestones, buyer digest, seller weekly report, win-back, review requests, Monday thrift tip.
- **Publishing:** weekly blog, Facebook Page posts, price drops, comp expiry, search-engine pings.
- **Weekly owner digest.**

Every automatic email:

- is logged;
- is never sent twice (`alreadySent`);
- is capped at 80 a day (`AUTOMATION_EMAIL_CAP`), under Resend's 100;
- respects unsubscribes.

### 4.6 AI calls: `askWithTool`

Every structured AI answer goes through one helper:

1. It forces a "tool" (a form the AI must fill in).
2. If the model refuses forced tools, it retries in auto mode with a plain instruction.
3. As a last resort it parses JSON out of the text.
4. It **awaits** the cost log.
5. If the answer was cut off at the token limit, it records `err:cutoff:<feature>`.

*Source: `src/lib/ai-tool.ts`*

```ts
import Anthropic from "@anthropic-ai/sdk";
import { logUsage } from "@/lib/usage";

/**
 * Ask the model to answer by calling one tool (so the answer has a fixed shape).
 * Some newer models reject a forced tool_choice with a 400 ("not supported for this model").
 * When that happens we retry with tool_choice "auto" plus a plain instruction to use the tool,
 * and as a last resort read a JSON object out of the text. Returns the tool input.
 */
export async function askWithTool<T = Record<string, unknown>>(client: Anthropic, p: {
  model: string; max_tokens: number; messages: Anthropic.MessageParam[];
  tool: { name: string; description: string; input_schema: Anthropic.Tool.InputSchema };
  log?: { ownerId: string | null; feature: string };
}): Promise<T> {
  const track = async (m: Anthropic.Message) => {
    if (p.log) await logUsage(p.log.ownerId, p.log.feature, p.model, m.usage);
    // tripwire: an answer cut off at the word limit comes back incomplete; record it so the limit gets raised
    if (m.stop_reason === "max_tokens") {
      const { admin } = await import("@/lib/stripe");
      await admin().from("settings").upsert({ key: `err:cutoff:${p.log?.feature || p.tool.name}:${Date.now()}`, value: { feature: p.log?.feature || p.tool.name, max_tokens: p.max_tokens, out: m.usage?.output_tokens } }).then(() => {}, () => {});
    }
  };
  const pick = (m: Anthropic.Message): T | null => {
    const call = m.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === p.tool.name);
    if (call) return call.input as T;
    const text = m.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    const a = text.indexOf("{"), z = text.lastIndexOf("}");
    if (a >= 0 && z > a) { try { return JSON.parse(text.slice(a, z + 1)) as T; } catch { /* fall through */ } }
    return null;
  };
  try {
    const m = await client.messages.create({ model: p.model, max_tokens: p.max_tokens, messages: p.messages, tools: [p.tool], tool_choice: { type: "tool", name: p.tool.name } });
    await track(m);
    const r = pick(m); if (r) return r;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/tool_choice/i.test(msg)) throw e;
  }
  // Retry without forcing: say it plainly.
  const msgs = [...p.messages];
  const last = msgs[msgs.length - 1];
  const nudge = { type: "text" as const, text: `\n\nAnswer ONLY by calling the "${p.tool.name}" tool with every required field filled in. Do not write anything else.` };
  msgs[msgs.length - 1] = { ...last, content: typeof last.content === "string" ? [{ type: "text", text: last.content }, nudge] : [...last.content, nudge] };
  const m2 = await client.messages.create({ model: p.model, max_tokens: p.max_tokens, messages: msgs, tools: [p.tool], tool_choice: { type: "auto" } });
  await track(m2);
  const r2 = pick(m2);
  if (!r2) throw new Error("No structured answer returned");
  return r2;
}

/**
 * Oct 9, 2026: the AI account ran out of prepaid credit and every tool told customers "try a clearer photo."
 * These tell an outage apart from a bad photo: out of credit, bad key, rate limit, overloaded or server errors.
 */
export function aiServiceDown(e: unknown): boolean {
  const status = Number((e as { status?: number } | null)?.status || 0);
  const msg = e instanceof Error ? e.message : String(e);
  return status === 401 || status === 403 || status === 429 || status >= 500 || /credit balance|billing|overloaded|rate.?limit|authentication|api key/i.test(msg);
}
export const AI_DOWN_MESSAGE = "Our AI is taking a short break right now. Nothing was used or charged. Please try again in a little while.";

/** Text and email the owner the first time the AI goes down (at most once an hour). Never throws. */
export async function reportAiDown(e: unknown): Promise<void> {
  try {
    const { admin } = await import("@/lib/stripe");
    const d = admin();
    const key = "err:ai_down:last_alert";
    const { data } = await d.from("settings").select("value").eq("key", key).maybeSingle();
    const last = Number((data?.value as { at?: number } | null)?.at || 0);
    const now = new Date().getTime();
    if (now - last < 3600_000) return;
    await d.from("settings").upsert({ key, value: { at: now } });
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 200);
    const credit = /credit balance|billing/i.test(msg);
    const { alertStaff } = await import("@/lib/alert");
    await alertStaff(credit ? "AI is OFF: out of prepaid credit" : "AI tools are failing",
      credit
        ? "Every AI tool (What's it worth, listings, Sort the pile, Buy or Pass, Help) is stopped until credit is added. Customers see a short-break message and aren't charged. Fix: platform.claude.com, sign in, Settings, Billing, Buy credits. Turn on Auto-reload there so it can't run out again."
        : `The AI service is refusing requests: ${msg}. Customers see a short-break message and aren't charged. Tell Claude.`,
      "/app/ops");
  } catch { /* alerts must never break a request */ }
}
```

### 4.7 AI money: log every call, give allowances, sell top-ups

*Source: `src/lib/usage.ts, lines 1-37`*

```ts
import type Anthropic from "@anthropic-ai/sdk";
import { admin } from "@/lib/stripe";

/**
 * AI money, in one place.
 *  - logUsage: every AI call writes what it really cost (tokens x price) to ai_usage. Operations adds it up.
 *  - aiImage: the AI reads a smaller copy of each photo (about half the cost per photo); buyers still see the full photo.
 *  - allowanceFor: what someone has left this month, for the meter and friendly limit messages.
 * Prices checked Oct 2, 2026 (platform.claude.com/docs/en/about-claude/pricing). Per million tokens.
 */
const PRICES: { match: RegExp; inp: number; out: number }[] = [
  { match: /haiku/i, inp: 1, out: 5 },
  { match: /opus/i, inp: 5, out: 25 },
  { match: /sonnet/i, inp: 2, out: 10 },
];
export const PRO_USES = 300;
export const POWER_USES = 1000;
export const THRIFT_DAILY = 30;

export function costOf(model: string, u: Partial<Anthropic.Usage> | null | undefined) {
  const p = PRICES.find((x) => x.match.test(model)) || PRICES[2];
  const inp = Number(u?.input_tokens || 0), out = Number(u?.output_tokens || 0);
  const cr = Number(u?.cache_read_input_tokens || 0), cw = Number(u?.cache_creation_input_tokens || 0);
  // web searches (Find it for less) are $10 per 1,000 on top of tokens
  const searches = Number((u as { server_tool_use?: { web_search_requests?: number } } | null | undefined)?.server_tool_use?.web_search_requests || 0);
  return (inp * p.inp + out * p.out + cr * p.inp * 0.1 + cw * p.inp * 1.25) / 1e6 + searches * 0.01;
}

export async function logUsage(ownerId: string | null | undefined, feature: string, model: string, u: Partial<Anthropic.Usage> | null | undefined) {
  if (!u) return;
  try {
    await admin().from("ai_usage").insert({
      owner_id: ownerId && /^[0-9a-f-]{36}$/.test(ownerId) ? ownerId : null, feature, model,
      input_tokens: u.input_tokens || 0, output_tokens: u.output_tokens || 0,
      cache_read_tokens: u.cache_read_input_tokens || 0, cache_write_tokens: u.cache_creation_input_tokens || 0,
      cost_usd: costOf(model, u),
    });
```

- One database function (`spend_ai_credit`) decides whether a use is allowed. It locks the row and resets monthly/daily counts in Eastern time. Order: staff and comped are unlimited; Pro gets 300 a month; Power Seller 1,000; Thrift Pro 30 a day; free accounts use credits, then packs.
- A failed AI call refunds the use.
- The meter shows "214 of 300."
- At 80% the member gets a friendly email. Past $10 of cost in a month, the owner gets an alert.
- Photos go to the AI at 1,100px: 1,213 tokens instead of 2,507, measured.

### 4.8 Stripe

- Prices are made in code (`price_data`), so no dashboard setup.
- `metadata.plan` goes on both the checkout and the subscription.
- The webhook checks the signature against the raw body.
- Every money step is **idempotent**: update `where status = 'pending_payment'`, refund only when paid or disputed, and pack top-ups keyed by `topup:<checkout id>`.
- Comped accounts are never downgraded by a webhook.
- Upgrading cancels the old subscription.
- Sellers' money is **held** until hand-off (pickup code, or delivery + 3 days), and **Buy now works before the seller sets up payouts.** The money waits, and they're emailed "$55 is waiting for you" (T-18).

### 4.9 Testing the live site from the database

The sandbox can't reach the live site, but the database can:

```sql
select net.http_get('https://YOUR-SITE/some/page') id;           -- returns an id
select status_code, left(content, 300) from net._http_response where id = <that id>;
```

Note: `ilike '%____%'` doesn't find underscores, because `_` is a wildcard. Use `position('____' in content)`.

### 4.10 Search engines and sharing

- Sitemap and feeds are generated on request (`export const dynamic = "force-dynamic"`), never baked at build time (an empty Google feed shipped once). They return 503, not an empty feed, on a database error.
- IndexNow is pinged on every new page.
- Every item and lookup can become a public page ("Share this find"), with a branded preview image (`opengraph-image.tsx`).
- Pages grow on their own: city pages, "about" hubs, a weekly blog.

### 4.11 Small things that mattered

- **Tapping the current page's menu button** must reload it (`NavLink`), or a stuck form can't be escaped.
- **Text boxes grow** with `fieldSizing: "content"`.
- **The mic restarts itself** after Android Chrome's short silences, stops after 30 seconds of quiet, and says "Listening… tap when done."
- **"Apply to new photos" checkboxes don't work,** because people pick photos first. Use buttons that fix the photos already there.
- **Photo files keep the originals;** the AI and the editor make copies.
- **Location comes from the seller's profile,** not the item.
- **`cleanAiTells()`** (`src/lib/listing.ts`) runs on every AI title and description, and on the copies for other sites. Em and en dashes become commas, except between numbers (1985-1989 keeps a hyphen). Curly quotes, the ellipsis character and hidden spaces become plain keyboard characters. Adapted from the political app's `noLinks` (PP-T1).

## 4B. The engine room: every outside service and behind-the-scenes workaround

This is everything that makes the app run beyond its own code: the outside companies, how each is wired in, and the workarounds ("back doors") that let Claude run it all from its side without sending the owner into dashboards. The political posting app uses most of the same pieces. Copy this list.

### A. The outside services the app depends on

This is the same list the Operations page shows under "Outside the site" (stored in the `integrations` table and checked daily by the Health automation).

| Service | What it does here | How it's wired in | How Claude runs it from its side | Back doors and workarounds | Cost |
|---|---|---|---|---|---|
| **Vercel** (hosting) | Serves every page; runs the daily 9 AM job (`vercel.json` cron calling `/api/notify/send`) | Project `next-owner-market`; env vars hold every key | Vercel connector: `create_deployment` (production, git source, **no team ID**), `get_deployment` until READY, env vars set through the connector | Not git-linked, so every push needs a deploy call. Cron is once a day on the free plan, so exact times use pg_cron (below). The sandbox can't open the live site, so live checks go through the database (pg_net). | Free (non-commercial); Pro $20/month before real sales |
| **Supabase** (database, sign-in, photo storage) | Every account, item, order, message and photo; row-level security | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase connector `execute_sql` for all reads, schema changes and data fixes; `list_tables` and `get_advisors` for checks | **pg_net** (`net.http_get`/`http_post`) is Claude's window to the live site and outside URLs. **pg_cron** gives exact schedules. `apply_migration` gets cancelled, so use `execute_sql`. Mixed `drop policy`/`revoke` batches get cancelled, so use DO blocks or run them alone. Approvals nobody answers cancel the change. Nightly JSON backup to a private bucket (the free plan has no managed backups). | Free to 1 GB of files; Pro $25 |
| **GitHub** (code) | The code and its history; the Change Log is built from it | Repo `wholesale30/next-owner-market`, linked through the GitHub app | `git` in the sandbox; the session's proxy supplies the login | Personal tokens don't work behind the proxy; install the GitHub app. Always `git pull --rebase` (other sessions push). Push protection blocks secrets; the journal script redacts them. | Free |
| **Stripe** (payments) | Checkout, held money, paying sellers (Connect Express), Pro / Power / Thrift subscriptions, top-up packs | `STRIPE_SECRET_KEY`; the webhook secret and Pro price are in `settings.stripe`, written by the one-tap `/api/stripe/setup` | Prices made in code (`price_data`); the webhook and price created by the setup route | The Connect platform questionnaire can only be done by the owner in the live dashboard (no API). Watch Sandbox vs live. Every money step is guarded so it can't run twice. | 2.9% + 30¢ a charge; +0.7% subscriptions |
| **Resend** (email) | Every email: orders, alerts, welcome series, digests, to-do reminders. **Both apps send through the same Resend account,** so the 100-a-day and 3,000-a-month limits are shared. | `RESEND_API_KEY` (send-only), `EMAIL_FROM`; domain verified with DNS records | Sends from server code; every send logged (`email_log`, `notifications`) | A send-only key can't read account info (401), so health is judged by real sends. Capped at 80 automatic emails a day. The sandbox can't reach Resend directly, so test by triggering the live site. | Free 3,000/month, 100/day |
| **Phone carriers' email-to-text** (texts) | Owner alerts and seller texts | An address like `8047207910@vtext.com` in `settings.business.alert_to`; sellers pick a carrier in Profile | Same as email | `@vzwpix.com` carries long messages. Dead carriers (AT&T, Cricket, T-Mobile, Metro, Mint) are marked "texts not available"; Verizon ends by March 31, 2027. | Free |
| **Anthropic web search** (live prices for Find it for less) | Searches stores right now so prices and links are real | A server tool in the same Messages call: `{type: "web_search_20250305", name: "web_search", max_uses: 5, user_location: {type: "approximate", country: "US"}}`, plus our own `record_results` tool | Tested from the sandbox (api.anthropic.com is reachable) on real examples before building screens | Handle `stop_reason: "pause_turn"` by sending the assistant turn back; read `usage.server_tool_use.web_search_requests` to log cost; keep only URLs that appeared in `web_search_tool_result` blocks. Amazon's Product API needs 3 sales in 30 days first, so live search is the way in. | $10 per 1,000 searches plus tokens (about 10 to 15 cents a find) |
| **Anthropic** (the AI) | Lookups, listings, pile sorting, Buy or Pass, weight guesses, rewrites, help answers, weekly blog | `ANTHROPIC_API_KEY`; model names in `CLAUDE_MODEL` and similar | `.env.local` has the key, so Claude tests prompts from the sandbox (api.anthropic.com is reachable) | `askWithTool` with fallback; photos shrunk to 1,100px; every call's cost logged in `ai_usage`; a cutoff tripwire; refund on failure; allowances in one database function. | Pennies per use |
| **Shippo** (shipping labels) | Live rates and labels (when a key is added) | `SHIPPO_API_KEY` (not set yet) | | Without a key, a built-in estimate by weight and distance tracks USPS Ground Advantage. The Google feed uses the farthest-zone estimate. | Pay per label; the app adds a markup |
| **Google Search Console** | Indexing reports | Verified with a meta tag in `src/app/layout.tsx` (`verification.google`) | Claude adds the tag and submits nothing by hand | Verify only after the deploy is READY. | Free |
| **Google Merchant Center** (Shopping tab) | Free product listings | Scheduled fetch of `/feed/google.xml` | Claude controls the feed's content | Only the store's own shippable items; honest shipping and condition; trust pages; one review request (T-52). | Free |
| **IndexNow** (Bing, DuckDuckGo, Yandex) | New pages indexed in minutes | Key file in `/public`; `src/lib/indexnow.ts` | Pinged on publish, share and daily | No account needed. | Free |
| **Meta / Facebook Page** | Auto-posts new items, shared finds and the weekly blog (once a Page token is added) | Page ID and token in settings (still to do) | The `facebookPage` automation | No API for Marketplace or Groups; copy-paste text instead. Page tokens expire in about 60 days. | Free |
| **OpenStreetMap Overpass** | "Safe meet spots" (police stations) near a pickup | `/api/safe-spots`, cached 30 days in settings | | No key needed. | Free |
| **ImprovMX** (planned) | Free email forwarding for a branded address | MX `mx1/mx2.improvmx.com` (priority 10/20), SPF `v=spf1 include:spf.improvmx.com ~all` | DNS records | Keep exactly one SPF record per domain. | Free |
| **GoDaddy and Wix** (shayneforva.com) | The owner's other domain and site | DNS at GoDaddy, site on Wix | Public DNS lookups through `https://dns.google/resolve?name=DOMAIN&type=TXT` from the sandbox | Rule 19 came from a 30-minute DNS job. | |

### B. Claude's own machinery (the part nobody sees)

| Piece | What it is | How it's used | Gotcha |
|---|---|---|---|
| **Connectors (MCP)** | Supabase, Vercel and the GitHub app, linked to Claude | Claude does database work, deploys and env vars directly | Connect them on day zero; after that the owner never pastes SQL or keys. |
| **The sandbox** | A private Linux machine Claude works in | Code, builds, scripts, documents | Its internet is limited: it can't reach the live site, Resend, Supabase storage or Google Fonts. It can reach api.anthropic.com, npm and GitHub. Live checks go through pg_net. |
| **pg_net as a window** | The database calls URLs for Claude | Test live pages and feeds, trigger jobs, read the answers in `net._http_response` | `ilike '%____%'` matches any 4 characters (`_` is a wildcard); use `position()`. |
| **One-time kick link** | `settings ops:kick` token, then `/api/ops/kick` | Run any automation now (first emails, a test reminder) | Write the expiry as ISO with "T" (T-53). The token is erased before the job runs. |
| **pg_cron** | The database's clock | Exact-time jobs (11 AM / 5 PM reminders) | Fire at both UTC hours and filter by New York hour for daylight saving. |
| **Error log in settings** | `err:<feature>:<time>` rows | Claude reads real failures without a paid logging service | Keys with ":" are private. |
| **Health automation** | A daily check of every outside service and every public page, signed out | Red status plus an alert to the owner | Judge each service by what it actually did. |
| **Robot new user** | A weekly fake customer on the live site | Finds breakage before customers do | Deletes everything it made. |
| **Headless Chromium (Playwright)** | Pre-installed in the sandbox | Phone-width screenshots (412px, 360px) of new screens before shipping | Kill old servers by port, not `pkill`; wait for CSS to load. |
| **Hooks** (`.claude/settings.json`) | Commands that run on their own | Journal and change log before condensing and at session end. A **Stop hook** (`scripts/stop_check.py`, in both apps) refuses to end a turn while code changes haven't been sent. | Hooks can't send files to the chat; they can only stop Claude and remind it. The hook allows the second stop attempt, so it can't loop. |
| **Skills** | Saved instructions on the Claude account | `shayne-operating-rules` and `app-builder-playbook` load in every chat | Rules must also be in CLAUDE.md and the project. |
| **Claude project docs** | The "Warehouse items" project | A copy of the Operating Rules and guides, visible in every chat of the project | Text only (.docx isn't accepted there). |
| **The file tool** | Sends the zip into the chat | After every batch | The only way files reach the owner. |
| **Helper agents** | Extra Claude workers for big reading jobs | Used to read the 628 KB journal in parallel for this playbook | Give them exact files and sections; check what they bring back. |
| **`.env.local`** | Local copy of keys in the sandbox | Local builds and AI prompt tests | Never committed; never pasted in chat. |

### C. Reusing this in another app

1. Connect Supabase, Vercel and GitHub (the app, not tokens) on day zero.
2. Copy:
   - `src/lib/alert.ts`, `ai-tool.ts` and `usage.ts`;
   - the automation frame (`automations.ts`: health, robot, secretary and the email helpers);
   - `ops/kick`;
   - the settings, trash and todos SQL;
   - the scripts and hooks.
3. Add pg_cron jobs for anything that needs an exact time.
4. Fill in the new app's `integrations` rows, so its Operations page shows every outside service with what it does, who holds the login and its live health.

## 5. Design rules (psychology first)

- **ONE obvious next step per screen.** Fewer choices means more action.
- **Show value in the first minute,** from their own stuff ("try it free" writes a listing from their photo), and only then ask them to sign up to keep it.
- **What a beginner uses first goes at the top.** Advanced things go under "More."
- **Checklists start partly done** ("Account made ✓"), in the order things really happen. Green ✓ "Done," never crossed-out text. The next step is highlighted with one button.
- **Ask for the upgrade at happy moments** (right after a great result) and at limits, never cold. Show what they saved.
- **Celebrate wins** (first listing, first sale, $25, $50, $100…). Make sharing a top action.
- **Plain words.** "Item number," not SKU. "Seller," not consignor. Big, bright, thumb-sized buttons; no faint gray.
- **First pages stay upbeat.** Rules and protections come later ("a buzzkill for the very first page").
- **Defaults must never hurt the result.** Background cleaning is off by default; people choose.
- **Users fix their own problems.** Buyer and seller settle things on the order page; staff only break ties.
- **The owner sees everything.** Every number opens to the people behind it, and there's a "what a buyer sees" view.
- **Every screen:** a one-line hint at the top, a "?" sheet, and an "Ask anything" box answered from the User Guide.
- **The test:** would someone who has never sold online know exactly what to tap next?

## 6. Testing like a stranger

Most bugs here hid because testing was done signed in. "It's like a new house: the leaks only show the first time it rains."

- After every change: signed out, at phone width (412px and 360px), with real data and real photos.
- Daily, automatically:
  - open every public page signed out, and look inside the HTML for hidden error screens;
  - one real AI call;
  - check each outside service by what it actually did (Resend: real sends), not by an account call that can fail.
- Weekly: the robot user tries the main feature, signs up, lists, gets approved, looks as a shopper, and deletes everything it made. It caught the AI breakage the first day.
- Test the AI on the owner's real items and report the real output.
- Before telling the owner to tap something, confirm the deploy is live.
- End each build with "what I couldn't test from here" and the first real test he should do.

## 7. The records system (the book)

- **Build Journal.** Every conversation, both sides, word for word, including the arguments, cussing, corrections and compliments. "That's the biggest part of this whole thing is how me and AI have built all this stuff."
  - `journal.py` rebuilds it from the chat transcript.
  - It keeps an **append-only** copy, because condensing the chat rewrites the transcript (T-14).
  - It removes any keys or passwords.
- **Change Log.** Built from git history by `changelog.py`, so **commit messages must be plain English about what the user will notice.**
- **One dated zip.** `package.sh` rebuilds everything, writes `<App>_Files_YYYY-MM-DD_HHMM.zip` (24-hour time, so the newest sorts last) with READ_ME_FIRST.txt, deletes the older zip and prints the path. Claude sends it with the file tool after every batch, at session end and at least every two hours. **No hook can put a file in the chat; only Claude can.**
- **Hooks** run the journal and change log before the chat is condensed and at session end. The political app also has a **Stop hook** that refuses to end a turn if there's a change newer than the last send. Use it on every app.
- **Kept current:** User Guide (for users), Complete Guide (technical rebuild), White Paper, Presentation Walkthrough, Mission Statement (his words about why, with Claude's reply), Operating Rules, File Index, Lessons for the Next App, and this Playbook.
- **The same rules live in three places:** CLAUDE.md in the code, the Claude account skill, and the Claude project doc. Then nothing is lost when the model or chat changes. Hand-off line for a new chat: *"Load the shayne-operating-rules and app-builder-playbook skills and read CLAUDE.md before anything else."*

The scripts are in Appendix B.

## 8. Deploy and operations routine (every change)

1. Make the change. For a new route, run `npx next typegen`.
2. Lint and type-check (`npx tsc --noEmit`, `npx eslint <files>`), then `npm run build`.
3. Commit with a plain-English message plus the trailers.
4. `git pull --rebase` (other sessions push too), then push.
5. Run `bash scripts/diff_check.sh` and confirm only the intended files are listed. Then deploy: Vercel `create_deployment` with project, target production and the git source, and **no team ID**. One build at a time.
6. Wait for READY, then check live (pg_net, or the page itself). Then run `bash scripts/diff_check.sh --mark`.
7. Update the guides. Run `package.sh`, commit the records, push, deploy, **send the zip**, then run `bash scripts/mark_sent.sh`. The Stop hook won't let the turn end until this is done.
8. Tell the owner, bottom line first. Include a forwardable message if a user reported it.

**Database changes:**

- Use the Supabase connector's `execute_sql` (here `apply_migration` gets cancelled).
- `drop policy` and `revoke` mixed with other statements also get cancelled. Put policies in a `DO $$ … $$` block and run revokes alone.
- Save every live change as `supabase/migrations/NNN_name.sql` with "Applied live <date>."
- Approval prompts that nobody answers cancel, and the owner sees "database declined" (T-28).

## 9. Costs and free limits (October 2026)

| Service | Free | When it costs |
|---|---|---|
| Vercel Hobby | Hosting, SSL, daily cron. **Non-commercial only.** | Pro $20/month before real sales |
| Supabase free | 1 GB of files (about 5,000 photos at 200 KB), 5 GB transfer, pg_cron and pg_net | Pro $25/month when photos pass 1 GB |
| Resend | 3,000 emails/month, 100/day | $20/month for 50,000 |
| Anthropic | Pay per use: Sonnet $2 in / $10 out per million tokens; Haiku $1 / $5; batch half off | Measured: lookup 2¢, lot 3.6¢, listing 2.7¢, quick verdict 1.5¢, pile 5–10¢, help answer 0.5¢ |
| Stripe | No monthly fee; 2.9% + 30¢ a card charge, + 0.7% for subscriptions | |
| Texts | Free by email-to-text (Verizon only now) | Twilio about 1¢ a text (ask first) |
| Photo touch-up and background removal | On the phone, $0 | Google "deep clean" 3.4¢ a photo (sell it in packs) |
| IndexNow, sitemap, RSS, Google free listings, ZIP lookup, safe-spot map | Free | |
| Domain | | About $20/year |

**Pricing lesson.** "Unlimited" lost money: one heavy $15 member cost about $26 in AI. So the plans became:

- Pro: 300 uses a month.
- Top-ups: 100 for $6.99 or 300 for $14.99, which never expire.
- Power Seller: $39 for 1,000.
- The first 2 fixes on any answer are free.
- The owner, staff and comped members are unlimited.

Measure real costs from the log before setting prices.

## 10. Platform gotchas (with the fix)

**Next.js 16**

- Middleware is now `src/proxy.ts`.
- `cookies()` is async.
- Pages are typed `PageProps<"/route">`; run `npx next typegen` after adding a route.
- Route files may export only handlers and config.
- Lint forbids `Date.now()` and `Math.random()` in render code; put them in a helper outside the component.
- Data routes need `force-dynamic`, or they're baked empty.
- The sandbox can't load Google Fonts; use system fonts.
- Long AI routes set `maxDuration`.

**Vercel**

- No team ID or slug on deploys (403 "scope" on a personal account; T-35, PP-T2).
- Deploys made from uploaded files (not from GitHub) must list **every** file. A file the tool has never stored must be included in full. A partial list drops pages from the live site (PP-T4). Deploying from GitHub (`gitSource`) avoids all of this.
- `list_deployment_files` cuts off deep folders; use `get_deployment_file_contents` with the file ID.
- Env vars marked sensitive can't be read back.
- Builds take about 2 minutes; wait before telling anyone to verify.
- Background work after the response gets killed, so **await every write.**
- Cron on the free plan is daily, within the hour; use pg_cron for exact times.
- Hobby is non-commercial.

**Supabase**

- New key names: `sb_publishable_…` is the old anon key; the "secret" key is the service role. The project URL has no `/rest/v1/`.
- A migration is one transaction: one error applies nothing. Keep views separate.
- Search columns maintained by a trigger, not "generated."
- PostgREST joins through views are unreliable; use a second query.
- A public rule that calls `is_staff()` fails for signed-out visitors unless anon can execute it.
- Users could edit their own plan or credits through their profile row; fix with column grants.
- Money functions must be revoked from users.
- The settings table was public; keep private keys behind ":".

**Stripe**

- Connect accounts can't be created until the platform owner fills out the Connect platform questionnaire in the live dashboard. There's no API for it.
- Watch the dark "Sandbox" bar: test mode isn't live.
- Ask only for card payments and transfers.
- Guard comped accounts in the webhook.

**Resend**

- Domain not verified means sends fail; check the response.
- The `resend.dev` test sender only emails the account owner (PP-T6).
- The free plan allows 3 domains, but the **100 a day and 3,000 a month are per account**. Next Owner Market caps its automatic emails at 80 a day; the political app sends about 5 a day. Watch the total if either grows.
- A send-only key returns 401 on account calls, so judge health by real sends.

**Anthropic AI**

- The API is **prepaid**. When the balance hits zero, every call fails with 400 "Your credit balance is too low." Turn on auto-reload (Console → Settings → Billing → Auto-reload) on day zero (T-57).
- Free-form JSON breaks ($ signs, ranges like "50-80"); use forced tools (`askWithTool`).
- One model update rejected forced tool choice and broke five tools; keep the fallback and a daily real-call check.
- Bigger output means a bigger `max_tokens`. Adding keywords cut off 9 of 26 listings at 1,200 tokens; now 2,500–9,000 plus the cutoff tripwire.
- The model ignores "don't include X." **Clean the output in code** (the price-talk scrubber).
- Prompt caching only pays if calls come within 5 minutes; sending only the relevant guide sections was cheaper.
- Haiku was too thin for rewriting; Sonnet for quality, Haiku for quick help.

**Email-to-text**

- AT&T, Cricket, T-Mobile, Metro and Mint have ended it; Verizon will by March 31, 2027.
- 160-character limit on `@vtext.com`; `@vzwpix.com` carries long text.

**Google**

- Search Console: verify with the meta tag after the deploy is live, then submit the sitemap.
- Merchant Center (the T-52 suspension):
  - every Terms blank filled;
  - Contact, About, Returns and Shipping pages linked site-wide;
  - **a standard account may list only your own items** (other sellers need a Marketplace account);
  - pickup-only items must not be sent as $0 shipping;
  - "like new" isn't "refurbished";
  - shipping is flat-rate or a real maximum, with handling and transit times;
  - returns are "defective products only," which is better than "no returns";
  - wait 2–3 days after fixing, then request **one** review (failed reviews lengthen the wait).

**Facebook / Meta**

- Feed ranking (from third-party sources; Meta's own pages couldn't be fetched): it rewards comments, private shares, "See more" taps, time spent and original content, and reduces clickbait and engagement bait. Links in the body hurt reach, so put links in the first comment. A **follow ask** is not on Meta's engagement-bait list (PP-T8).
- Instagram shows about 125 characters before "more" and has no clickable links in captions. X shows about 280 before "Show more."
- No API to post Marketplace listings; use copy-paste text. Automation risks the account.
- The Groups API ended April 2024: apps can't post to groups. Post to a business Page instead, which needs a Page token with `pages_manage_posts`; it expires in about 60 days.
- Marketplace listings with an outside web address can be removed even after approval. The owner chose to leave the address off.
- Cover photo 1640×924 with text in the center. Profile picture 720×720. Bio 101 characters.

**Marketplace rules for copy the app writes for users** (so users don't get banned)

- eBay: no links or ".com," no keyword spam, one listing per identical item.
- Mercari: 3 hashtags, no keyword lists.
- Craigslist: no keyword lists, no links, repost every 48 hours at most.
- Etsy: only vintage (20+ years) or handmade.
- Depop: 1,000 characters, 5 hashtags.
- Poshmark: limited categories.
- Everywhere: no other brands as keywords ("like Dyson") and no comparisons.

**GitHub**

- A signup "blocked" message is a flagged network; switch wifi/data or browsers.
- Personal tokens don't work through Claude's proxy; install the GitHub app.

**Sales tax (Virginia)**

- Consignment sales are taxable from the first sale.
- Marketplace-facilitator duty starts at $100,000 or 200 sales.

## 11. Trial and error: what went wrong and the rule it became

Numbered T-1 onward so other documents can point to them. Dates are 2026.

**Research and answers**

- **T-1. Prices from memory (Sept 7).** A drill press was priced at $175–250 without looking it up; it sold new for $599.97. *"I don't ask you to guess. You need to go out and look on the Internet."* **Rule:** search real retail and sold prices before any number.
- **T-2. Wrong item from a photo (Sept 22).** Round speakers were called mist makers, then "AppleDesign M6082." *"Those comparison photos don't even have a fucking anything close to looking the same."* **Rule:** confirm from a label or a second angle; say how sure you are.
- **T-3. Assumed better condition than the photos showed.** **Rule:** price as-is from the photos; show the cleaned and tested values separately (the condition ladder).
- **T-4. The owner's own knowledge beat the box label** (Vance & Hines exhaust fits both bikes). **Rule:** his firsthand experience counts as a fact.
- **T-6. A wrong tool setting given as an instruction** (polisher speed). **Rule:** look up settings; own it fast when wrong.
- **T-9. Wrong claim that switching models loses context.** **Rule:** check product facts before stating them.
- **T-11. Claude guessed Claude-app menus (Sept 30).** *"You should know exactly … this shouldn't even ever happen."* **Rule 3:** never guess menus.
- **T-24. Sent him to "go look it up" (Sept 30).** *"There's so many things you say, well, go check it out … That's why I have you."* **Rule 2.** Also: ask whether he's on his phone or computer when the steps differ.
- **T-25. Wrong facts copied forward** ("three warehouses"; he has one, with over 300 pallets). **Rule:** a "facts never to get wrong" list in every rules file.
- **T-37. Guessed his account type and argued with what he saw.** **Rule 9:** believe what he saw; check the database before saying anything about his account.

**Process**

- **T-7/8. Deliverables not made automatically; a handoff that left out the goal.** **Rule:** make the documents without being asked; handoffs say exactly what we're building, in a paste-ready message.
- **T-10. "A couple of weeks."** *"How could that take two weeks? We could do it all now."* **Rule:** never quote days; build it.
- **T-12. Holding features for "later."** *"We don't wait and should add. We do it all now and make the thing complete."*
- **T-13. He thought a rule was written down; it wasn't.** **Rule:** rules go into CLAUDE.md, the skill and the project, not memory.
- **T-13b. Built from a paper he only asked Claude to read (Sept 30).** **Rule:** opinion first, then wait for "go."
- **T-17. Trivial items pushed as "do now" (Sept 30).** *"some of this stuff seems like trivial shit."* **Rule:** lead with what blocks sales or growth; the rest goes on a Later list.
- **T-16. A model ran out mid-work; the next model "lost the thread."** **Rule:** the rules and journal are the memory. Open a new chat with "load the skills and read CLAUDE.md."
- **T-39. Push refused because another session pushed.** **Rule:** always `git pull --rebase` and merge, never overwrite.
- **Oct 2, DNS: 30+ minutes for a 5-minute job.** **Rule 19:** one complete answer, every field, the first time.
- **Oct 2: a fix deployed but the files weren't sent.** **Rule:** send after every batch; a Stop hook enforces it.
- **Oct 3, political app: side changes made during a requested fix.** **Rule:** surgical fixes only.

**Setup and infrastructure**

- **T-14. GitHub signup blocked:** a flagged network. **T-19. An hour lost on GitHub tokens:** the proxy only allows linked repos; install the GitHub app.
- **T-15. Supabase keys pasted one at a time,** with the URL ending in `/rest/v1/`. Claude can build the URL from the project ID. Secrets in chat also blocked a git push of the journal until they were redacted.
- **T-16b. The owner was asked to paste SQL.** Once connectors were linked, Claude ran everything. **Rule:** connect first, then never ask.
- **T-17b. A generated search column failed the whole migration.** Use a trigger-kept column; one transaction means nothing applies on error.
- **T-21. Output token limit hit mid-build.** Work in smaller pieces.
- **T-35. Vercel "not authorized" (Oct 1).** The owner was told to reconnect, but the real cause was the team ID in Claude's own call. **Rule:** check your own call before sending the owner to re-authorize anything.
- **T-43. Database batches with `drop policy`/`revoke` got cancelled.** Use a DO block, and run revokes alone.

**Product bugs**

- **T-22. The sign-up confirmation email depended on a setting he couldn't find.** *"Look, it's not fucking there."* Sign-up moved to the server, confirmed instantly. This became the "do it yourself" rule.
- **T-23. The camera opened instead of the gallery.** **Rule:** gallery first.
- **T-26. An alert reported as "queued" was actually rejected** (domain not verified). **Rule:** never report success without the provider's answer.
- **T-27. "No Buy button,"** with three causes: payouts not set up, the wrong owner on the item, and row-level security hiding the seller's status. Fixed with a public seller view and Buy now before payout setup (T-18).
- **T-28. Messages showed email addresses.** Contact info is scrubbed from listings and messages; usernames everywhere.
- **T-33. A frozen order with no way to fix it.** *"why wasn't there a place for me to fix the problem?"* Actions now sit on the same page; buyer and seller can settle it themselves.
- **T-35b. Raw code on screen** when the AI's JSON broke. Structured output, a plain error message, the credit refunded, the error logged.
- **T-36. The AI's price range leaked into listings.** The prompt alone failed, so a code scrubber removes price talk.
- **T-4b. Background cleaning on by default made photos worse.** Off by default; the choice is theirs.
- **T-5. The mic cut off after a few seconds on Android.** It restarts itself, with a 30-second silence limit.
- **T-18. Sales blocked until payout setup.** *"people are lazy."* Buy now on everything; the money waits; the seller is emailed.
- **T-19b. Admin inventory mixed every seller's items.** Grouped by seller, with a buyer-view link.
- **T-21b. Deletes were permanent.** The recycle bin everywhere.
- **T-22b. Checklist in the wrong order, with crossed-out text.** *"Remember, this all has to be in layman's terms."* Real order, green ✓.
- **T-23b. No automatic email had ever gone out** (the cron hadn't run yet, and Claude couldn't call it). The database calls the site with a one-time token.
- **T-29. Every listing gave 404 to signed-out visitors (Oct 1).** Anon couldn't run `is_staff()`. Fixed with a grant and a daily signed-out sweep.
- **T-30. Six features quietly empty:** they queried a city column items don't have. Join the seller profile; check pages daily signed out.
- **T-32. A model change broke forced tools (Oct 1).** The fallback in `askWithTool`; the weekly robot found it.
- **T-33b. The Google feed shipped empty.** `force-dynamic` plus 503 on error.
- **T-38. "Share" looked like it did nothing** (the phone's share sheet came first). Publish first, show "✓ Shared," then the share sheet as an option.
- **T-40. The dust remover erased digits.** A guard compares each speck against nearby marks.
- **T-41. Cost logs lost on serverless.** Await every write.
- **T-44. Saved lookups were where nobody looked.** Put things where a person would look first (Inventory), not where it's logical to the builder.
- **T-46. The owner's notes leaked into listings word for word** (*"it puts all my fucking shit in there"*). Notes are facts for the AI, never quoted; plus a talk-to-edit box.
- **T-47/48. Keywords missing; then adding them cut off listings at the token limit (9 of 26 blank).** Doubled limits, structured output, a cutoff tripwire, a 90-second timeout with Try again / Fill it in myself, an Edit button on every listing, and ➕ Add resets the page.
- **T-49/50. Copy that could get users banned** (web address on eBay; keyword lists on Craigslist; Etsy rules). Each site's rules are built into its copy. *"We get them new customers and they get shut down because of it."*
- **T-51. "Clean all backgrounds" did nothing on a new listing** (Nikki). Checkboxes for future photos became buttons that fix the photos already there.
- **T-52. Google Merchant Center "Misrepresentation" suspension (Oct 5).** Blank "operated by ____" in the Terms; no Contact/About/Returns/Shipping; other sellers' items in the feed; pickup items sent as free shipping; "like new" sent as "refurbished." All fixed. The owner's steps went on his to-do list with reminders.
- **T-53. The reminder test link expired at once:** wrong date format (Part 1, 1.9).
- **T-54. Private settings readable by anyone.** Keys with ":" are staff-only.
- **T-55. Em dashes in AI listings (fixed before anyone complained, Oct 5).** Learned from PP-T1. **Rule 24:** filter in code. `cleanAiTells()` now runs on every AI title, description and cross-post copy.
- **T-56. A failed reminder would silently skip a slot.** The slot is released on failure and retried at :20 and :40 (from PP-T7).
- **T-57. The AI account ran out of prepaid credit (Oct 9).** Every AI tool stopped, and customers were told "try a clearer photo," which blamed them for an outage. The daily health check caught it and texted the owner at 9:24 AM. **Fix:** `aiServiceDown()` and `reportAiDown()` in `src/lib/ai-tool.ts`. Out of credit, bad key, rate limit or overload now shows "Our AI is taking a short break. Nothing was used or charged," and texts the owner immediately, at most once an hour. **Rule:** tell customers the truth about outages; turn on **auto-reload** for any prepaid service on day zero.
- **T-58. A merged button hid a feature the owner used (Oct 9).** The new 📤 Share button also made the find's page on our site, so the separate "📣 Share this find" box was removed. To the owner, his "put it on our site" step was simply gone. **Fix:** both buttons are back, sharing one page, so there are no duplicates. **Rule:** when combining features, keep every step the owner can see and name, unless he says to drop it.
- **T-59. A restored feature went back to its old spot, not the spot the owner had fought for (Oct 9).** "Share this find" came back at the bottom of the page, two days after he got it moved to the top. *"I ask you to change one thing and you change a fucking other thing."* **Rule:** layouts the owner has settled are written down as LOCKED in CLAUDE.md, and anything brought back goes where he last asked for it.
- **T-60. Live prices without making up links (Oct 9).** An AI asked for "the cheapest place to buy X" will happily write product URLs that look right and don't exist. **Fix:** Find it for less uses Anthropic's web search tool and collects every URL the searches actually returned; a product link is kept only if it is one of those, otherwise the button becomes a search at that store. Also: the search results make each call cost 10 to 15 cents (mostly input tokens, plus $10 per 1,000 searches), so the free cap for signed-out visitors is lower than the photo tools. **Rule:** never show an AI-written URL the code hasn't seen come back from a real search; count server-tool fees in your cost log from day one.
- **T-61. A long tool answer came back tangled (Oct 9).** With live web search plus a big nested answer schema, about 1 in 4 finds came back with empty lists, fields flattened out of their box, or bits of tool markup inside the text, and one test on the live site showed a result with no stores at all. **Fix:** `strict: true` on the answer tool (the API then guarantees the schema; every object closed, every field required, list lengths trimmed in code), and if the model records twice, keep the fuller one. 8 of 8 live tests clean afterward. **Rule:** any AI tool with nested objects gets `strict: true`; test 5+ real runs in parallel before calling it done, not one.
- **T-62. A button only appeared on one path to the page (Oct 9).** "📸 Check another item" was put inside the "Your listing is written" box, which only shows right after the AI writes a listing. Open the same listing from Inventory, or after it's listed or approved, and the button was gone, so the owner hit it again after asking several times. **Fix:** the button now sits at the top of every listing page. **Rule:** when the owner asks for a button "after X," check every way a person reaches that screen, not just the one you tested.
- **The political app's own trial and error** (PP-T1 to PP-T10: em dashes, Vercel 403, copy slips and dropped files in hand-built deploys, cancelled SQL, the Resend test sender, cron limits, an over-claim about the algorithm, slogans, shared prompts) is in its section below and applies to every app.

## 12. What worked and should be repeated

1. Own a mistake in one sentence, then fix it; he keeps going.
2. Search and cite sources on every fact, price and policy.
3. Paste-ready messages and exact values (and a message he can forward to a user).
4. Do the "can't do" parts anyway (IndexNow, Google setup down to "paste me the meta line").
5. Build the whole database for future features on day one.
6. Ship in batches; deploy each; end each with a short plain "what landed."
7. Phone-width screenshots before anything ships.
8. Real test accounts and test orders, including a $1 order and a real outside seller (Nikki).
9. Turn every complaint into a design rule, not a patch.
10. Let people use one thing free and lock the rest (Facebook copy free, eight other sites Pro).
11. Honest pushback when it matters: "the code isn't the moat anymore … what nobody can build in a week is 5,000 sellers."
12. Safe defaults: contact info stripped, usernames, safe meet spots at police stations, held payments.
13. Measure real costs before pricing; take a second look and change the plan if needed.
14. The Operations page a new hire could run.
15. Growth loops that run themselves: shared pages, IndexNow, city and hub pages, a weekly blog, branded previews, an embed widget, milestones with referral links.
16. The to-do list that nags until it's done (Part 1).
17. Tell the owner to keep selling while it's being built.
19. **Promo videos for $0, built from code (Oct 9).** One HTML page holds the whole video, with a `render(t)` function that draws second `t`. Playwright screenshots 30 frames a second and ffmpeg joins them into a vertical 1080×1920 MP4. Use the owner's real photos and real AI results, big captions (most people watch muted), and keep key text out of the bottom quarter, where the Reels buttons sit. Source and rebuild steps: `docs/ads/source/`. The first one (a 26-second "What's it worth?" reel) took about 1 minute to render.
18. Two apps teaching each other. The political app's lessons fixed Next Owner Market the same night it read them, and the same goes the other way. Keep carrying the Playbook back and forth.

## 13. Why we do this (for the book)

*Shayne, Sept 29:* "I used to recycle 80,000 pounds a week of Goodwill donations before they ever even searched through them … I got a warehouse, 25,000 square foot warehouse full of shit … That'd be the dream."

*Shayne, Sept 30:* "Even me with over 300 pallets of random surplus. That why I originally wanted to build this. It is just overwhelming to attempt. Now with this app I feel energized and free."

*Shayne, Sept 30:* "This is getting so nice. We did it in a day … why haven't they ever thought of this?"

*Claude:* "What's rare is the whole thing in one place, built for the seller instead of for the platform … The code isn't the moat anymore … What nobody can build in a week is 5,000 sellers who use it … Just keep your eye on the numbers, not the build."

*Shayne, Oct 1:* "That's the biggest part of this whole thing is how me and AI have built all this stuff … Like two computers, one's human with a, with an organic brain and you're the, the computer with the, the, the digital brain."

*Claude, Oct 1:* "Until recently, 'complete' cost a fortune … Now one person who knows exactly what the customer needs can build it with AI and change it the same day. You got in at the moment that changed."

*Shayne, Oct 2:* "nobody can touch this app because nobody's going to think of all these things. But why don't they think of all these things?"

*Claude, Oct 2:* "Most apps are built by people who never do the job, test at a desk, and miss what you hit in five minutes … there's no meeting between your idea and the fix."

*Shayne, Oct 5:* "This app that we've done and everything we've been doing is like phenomenal. And I want all that documented … to build the app and put it strong and right the first time. And then we start fine-tuning it."

## 14. Starting the next app: the first conversation

1. Shayne says what it's for, who uses it, and what they're overwhelmed by.
2. Claude asks at most the few questions whose answers change the build, then gives a one-screen plan: the screens, in the order a beginner meets them; what's free and what's paid; what it costs to run.
3. On "go": day-zero setup (section 2), then the whole first version in one push, not a minimum version.
4. Deploy. Phone screenshots. A signed-out sweep. Send the zip.
5. Shayne tests like a customer. Every "no, that's wrong" becomes a fix plus a rule.
6. Then fine-tune: costs, automations, growth loops, trust pages, the Operations page.

## 15. Things to do better on the next app

- **Link the repo to Vercel** so pushes deploy themselves. This removes a whole class of deploy work (the political app's lesson too).
- **Put `admin()` in `lib/supabase/admin.ts`,** not the Stripe file.
- **Number every migration and always save the file.** Here, 010–029 exist only in the live history.
- **Use the Stop hook from day one** (from the political app). *Done in Next Owner Market Oct 5, along with `mark_sent.sh` and `diff_check.sh`.*
- **Make `journal.py` follow daylight saving** (it's fixed at UTC−4).
- **Trust pages and the settings privacy rule** on day one, not after a suspension.
- **Plan for text alerts after email-to-text ends** (push notifications or paid SMS).

## 16. Adding lessons from other apps (the format)

Each app adds one section at the end of this document, never editing the others:

```
## Lessons from <App name> (<dates>)

### New rules
- <rule> — why (the moment it happened, with the owner's words)

### Trial and error
- <AppCode>-T1. <what went wrong> (<date>). Cause: <why>. Fix: <what changed>. Rule: <the rule>.

### Better than Next Owner Market
- <what this app does better, and how to copy it>

### Platform gotchas
- <platform>: <gotcha> — <fix>

### Patterns worth reusing
- <pattern> — <file path> — <short real code>
```

Then raise the version number at the top. Shayne brings the file back, and Claude merges the lessons into the main sections (keeping the originals under the app's heading) as the next version.

## Lessons from the Political Posting App (Oct 2 to 5, 2026)

Built by Shayne Snavely for his Virginia politics page. Next.js on Vercel plus Supabase. It finds the top stories, writes Facebook, X and Instagram posts in his voice, builds graphics, tracks what was posted, and emails him the latest articles and his to-do list. Four days of building. Facts below come from the project files and the verbatim journal.

### New rules

- **RULE ZERO: never guess.** Search and fetch the real source before stating any step, menu, price, limit or API detail. If it can't be confirmed, say "I could not confirm this" and say what was checked. He said it "a thousand times." It outranks speed.
- **Surgical fixes only, one change at a time.** When he asks for one fix, change only that. Say the one change in a line, make only that edit, run scripts/diff_check.sh before deploying and stop if any other file or line shows up, deploy, check the live file matches the local one, then tell him exactly what changed and what did not. He tests every fix, so any extra change forces him to re-test everything.
- **Zero-knowledge steps for anything outside the app.** Write for someone who has never done it: which app to open, the exact address, "Desktop site" when needed, what he will see, what to tap, what to type in every box, what to do if the screen looks different. One complete numbered list, written after looking up the real steps.
- **Do it yourself.** If a change can be made from here (code, database, Vercel, DNS by API, env vars), make it. Never send him to look something up that can be reached from here.
- **Anything that must never appear is filtered in code, not only requested in a prompt.** On Oct 5 he was racing a 7:30 posting deadline and the draft had em dashes. His words: "Everybody knows, damn sure Facebook algorithm knows, that those fucking dashes ... is obviously AI." A prompt rule had failed, so the filter now lives in src/lib/writer.ts and runs on every output. When he is racing a deadline, fix his actual post first.
- **Copy what already won before adding generic advice.** His 11 posts reached up to 977,000 views. The winning structure (headline hook with names and numbers, dated named sources, exact quotes, calling out both sides, one concrete private-share ask, one real question) is in the writer prompt and outranks generic algorithm advice except for the dash, link and slogan bans.
- **Keep the follow ask.** Followers grew by 4,000 after he started asking people to follow. Meta's five engagement bait types (vote, react, share for a reward, tag, meaningless comment) do not include a follow ask.
- **Update the journal automatically, every time.** "Always update the journal. That should be an automatic thing." scripts/journal.py runs from refresh_docs.sh and from the hooks, and the Stop hook blocks the end of a session until the records were sent.
- **Send the records after every batch as ONE dated zip** (Political_Posting_Records_YYYY-MM-DD_HHMM.zip), then run mark_sent.sh. Never wait to be asked.
- **Posted is frozen.** The Posted tab must show exactly what was posted. It is enforced in the database (drafts.posted_snapshot and trigger trg_snap_posted), never read from live drafts.
- **Scheduled jobs run in parallel, log FAILED to run_log, and stay under 300 seconds.** Check run_log the next morning without being asked. A long serial morning loop is not allowed.
- **No paid services without asking.** Keep costs at zero.
- **Never say "next I'm doing X" and then do nothing.** After a long silence send a short status line.
- **Phone-first screens.** Copy buttons on every page. List screens show one line per item (thumbnail, headline, date), tap to open, and a "Back to the list" button.
- **Banned slogans** (his Oct 4 order): "Read that again," "Don't trust me. Check it yourself," "Today, not tomorrow," "This moves fast and the clock is already running." Posts are Facebook 300 to 450 words (never over 500), X 100 to 160, Instagram 100 to 200, and the closing catch-up block stays.

### Trial and error

- **PP-T1. Em dashes in a post (Oct 5).** Cause: the no-dashes rule lived only in the prompt. Fix: noLinks in src/lib/writer.ts turns em dashes, en dashes and spaced hyphens into commas, and converts curly quotes, the ellipsis character and hidden spaces to plain keyboard characters, on every output. Rule: filter in code what must never appear.
- **PP-T2. Vercel 403 "scope wholesale30" (Oct 5).** Cause: passing teamId or slug to the deploy tools on a personal Hobby account. Fix: leave both out. Rule: never pass teamId or slug for this account.
- **PP-T3. Copy slips in deploys (Oct 4).** A live page once said "X marked undone" instead of "X mark undone" because text pasted into a deploy call picked up a typo. Cause: files inlined by hand into the deploy call. Fix: compare each live file's uid to the local sha1sum and redeploy until they match. Rule: copy errors are changes.
- **PP-T4. missing_files and a deploy that dropped files (Oct 5).** The deploy tool refuses a sha it has never stored (queue page, comments page, writer.ts). A retry that left three files out would have broken the site. Cause: rebuilding a long file list by hand under pressure. Fix: inline any file whose sha is unknown, always send the full list, cancel a partial deploy at once. Rule: every deploy lists ALL files.
- **PP-T5. The approval layer cancelling SQL (Oct 4).** DELETE statements and big batches were cancelled. Fix: small, single-purpose execute_sql calls.
- **PP-T6. Email stopped at the account owner (Oct 5).** Resend's test sender only emails the account owner. Fix: send from the verified domain (nextownermarket.com) with a real key. The key was pasted in chat, so it was stored as a sensitive Vercel env var and never repeated. Rule: keys are account-level, so one verified domain serves every app.
- **PP-T7. Vercel Hobby only allows daily crons (Oct 5).** Fix: pg_cron inside Supabase calls the app with net.http_get. Each route checks the Eastern hour and claims a slot (todo_slots, cron_todo_claim and unclaim) so daylight saving and double firing can never send twice.
- **PP-T8. An over-claim about the algorithm (Oct 5).** Cause: saying every source treats like and share asks as bait. Fix: fetched Edgar and Revive Social, then corrected it: Meta's own list has no follow ask, and plain like or share asks are a gray area. Rule: do not generalize past what was fetched.
- **PP-T9. Slogan posts (Oct 4).** The writer produced catchphrases he found stupid. Fix: a banned list in the prompts. Rule: if a line sounds like a slogan, state the plain fact instead.
- **PP-T10. Partial prompts getting edited twice.** The prompt file (src/lib/prompts.ts) is shared by every writer, so a length change must be made in every prompt that mentions it, including the review prompt and the redo route.

### Better than Next Owner Market

- **The journal is verbatim and automatic.** scripts/journal.py rebuilds it from the transcript, hooks run it, and a Stop hook (scripts/stop_check.py) plus mark_sent.sh force the records to be sent. Copy these on day one.
- **diff_check.sh and a deployed snapshot.** docs/.deployed_snapshot holds exactly what is live, and scripts/diff_check.sh lists every file that differs before a deploy. This is how surgical fixes are enforced instead of promised.
- **Per-account row-level security** with a server pass: cron_*(p_pass, ...) functions guarded by _server_ok(p_pass), so scheduled jobs can read one account's data without a service key in the browser.
- **His voice is stored verbatim** (acct.voice_profile, about 74,700 characters of his own posts) and fed to the writer, instead of a summary of his style.
- **Idempotent schedules** with slot claims and an Eastern-hour check, so a retry never double sends.

### Platform gotchas

- **Vercel:** teamId or slug gives a 403 on a personal account. Hobby crons are daily only. Non-git deploys must list every file. Sensitive env vars can't be read back, and env values are never decrypted unless he asks. list_deployment_files truncates deep folders, so use get_deployment_file_contents with the fileId. The deploy tool decodes escape sequences in inlined files, so a live uid can differ from the local sha1 while behaving the same.
- **Supabase:** pg_cron runs in UTC. pg_net (net.http_get, results in net._http_response) is the only way to test the live site, because the shell and the Vercel fetch tools can't reach it. The approval layer cancels DELETE and big batches.
- **Resend:** the resend.dev sender only emails the account owner. Keys are account-level. The free plan is 3,000 emails a month.
- **Verizon:** the email-to-text gateway (vtext.com and vzwpix.com) ends 03/31/2027. Plan push notifications or paid SMS before then.
- **Facebook ranking (third-party sources; Meta's own pages could not be fetched):** it predicts clicks, time spent, comments, shares and "informative" value, and reduces clickbait and engagement bait. Longer thoughtful comments, private shares and "See more" taps are strong signals. Original content wins. Links in the body hurt reach, so links go in the pinned comment. Fast replies help.
- **Instagram and X:** Instagram shows about 125 characters before "more" and no clickable links in captions. X shows about 280 characters before "Show more." None of the three publishes how it detects AI text, so the safe move is removing every known tell.

### Patterns worth reusing

- **Code filter for AI tells and links** (src/lib/writer.ts). Real code:

```ts
export const noLinks = (t: string) => (t || "")
  .replace(/(?:https?:\/\/|www\.)\S+/gi, "")
  .replace(/[ \t]*[\u2014\u2013][ \t]*/g, ", ").replace(/[ \t]-{1,2}[ \t]/g, ", ")
  .replace(/,\s*,/g, ",").replace(/,\s*([.;:!?])/g, "$1")
  .replace(/[\u201c\u201d\u201e]/g, '"').replace(/[\u2018\u2019\u201b]/g, "'")
  .replace(/\u2026/g, "...").replace(/[\u00a0\u202f\u2009\u200b\u2060]/g, " ")
  .replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
```

- **Guaranteed closing** (src/lib/writer.ts): ensureClosing appends the share and follow lines if the writer left them out, so the closing ask can never go missing.
- **Three prompt blocks kept separate** (src/lib/prompts.ts): HUMAN_TELLS (never look AI written), ALGO_RULES (what the feed rewards), WINNER_RULES (copy his own best posts). Each is edited alone, and the review prompt also acts as an AI-detector pass.
- **A box before writing**: on every article a talk-or-type box tells the writer what to add; its text is passed as the owner's instructions into writePost.
- **Scheduled email routes** (src/app/api/articles/send/route.ts): GET with a key, runs only at Eastern hours 9 and 16, claims a slot, loops the accounts, logs FAILED to run_log, unclaims the slot on failure. Latest articles at 9 AM and 4 PM, to-do at 9 AM, 11 AM and 5 PM.
- **Records pipeline** (scripts/refresh_docs.sh, make_zip.sh, mark_sent.sh): one command rebuilds the journal, change log and rule documents, one command zips them with a dated name, and the Stop hook keeps them from being forgotten.


## From Next Owner Market back to the Political Posting App (v1.2)

What Next Owner Market has that would make the political app stronger, most valuable first. Each one has its full explanation and real code earlier in this Playbook.

1. **Deploy from GitHub, not from uploaded files.** Next Owner Market deploys with `create_deployment` and `gitSource: { type: "github", org, repo, ref: "main" }`, so Vercel builds from the pushed code. That makes PP-T3 (copy slips) and PP-T4 (missing or dropped files) impossible, and diff checks become `git diff`. If the political app has no GitHub repo, make one first and push; then deploy this way (Part 2, section 8).
2. **Your dash filter changes number ranges.** `noLinks` turns "1985–1989" into "1985, 1989" and "10–12" into "10, 12." For dates, vote counts or polling ranges in posts, add the number rule from Next Owner Market's `cleanAiTells` before the comma rule: `.replace(/(\d)\s*[\u2013\u2014]\s*(\d)/g, "$1-$2")`.
3. **Retry after a failed send.** Releasing the slot only helps if something calls again in the same hour. Schedule pg_cron at `0,20,40` of each hour you use (Part 1, 1.5).
4. **Shared email allowance.** Both apps send through one Resend account: 100 a day and 3,000 a month in total. The free plan allows 3 domains, so the political app can verify its own domain (shayneforva.com) and stop sending as nextownermarket.com. That's worth doing before any email goes to people other than Shayne.
5. **AI calls through one helper (`askWithTool`, Part 2, 4.6).** It retries when a model refuses forced tool choice (that broke five tools here in one day, T-32), logs the cost of every call (awaited, so nothing is lost on Vercel), and records when an answer was cut off at the token limit.
6. **A daily health check, signed out** (Part 2, section 6). It opens every public page as a stranger, makes one real AI call, checks each outside service by what it actually did, and alerts Shayne if anything is red. A weekly robot user does the main task end to end.
7. **Nothing is ever lost:** the `trash` table and trigger on every table, plus a Deleted page that restores (Part 2, 4.3).
8. **Signed-out visitors need `grant execute on is_staff() to anon`** if any public rule calls it (T-29). Every listing here showed 404 to strangers until this was found.
9. **The Playbook rebuilds itself from the real code** (`scripts/build_playbook.py`, Appendix B), so the code in it is never out of date. Copy the script and the template into the political app's records pipeline.
10. **An Operations page** (Part 2, 4.5 and 4B): every automation with what, why, last result, on/off and Run now, plus every outside service with live health. Your `run_log` holds the facts; this page shows them to Shayne in plain English.
11. **Trust pages before any ad, Google or payment account:** Contact, About, Terms and Privacy linked on every page, with no blank lines (T-52).

# Appendix A: The Operating Rules (full text)

*Source: `docs/Next_Owner_Market_Operating_Rules.md`*

```markdown
# How We Work: Operating Rules

*The rules Claude follows on every Next Owner Market chat (and every project). They're saved in three places so nothing gets lost: the shayne-operating-rules skill on your Claude account, CLAUDE.md in the code, and Operating_Rules in the "Warehouse items" project.*

1. **Do it yourself.** If a change can be made from Claude's side (code, database, hosting, web addresses, settings), Claude makes it. It sends you into a dashboard only when there is no other way. Then it says so in one line and gives exact copy-paste values and exact taps.
2. **Never send you to look something up** or "go view" anything Claude can reach. Claude searches the web, reads the help page, checks the database and reads the code, then gives you the answer and the exact steps. It only sends you somewhere when that's truly out of its reach (your logins, your phone screen, a payment), and says so first.
3. **Never guess at menus or buttons** in apps Claude can't see. Look up the official steps first and quote them. Ask whether you're on your phone or your computer when the steps differ.
4. **Deliverables are Word (.docx) files, sent as ONE zip (rule changed Oct 2, 2026).**
    - Every send is a single zip with every current file in it, named with the date and time, for example `Next_Owner_Market_Files_2026-10-02_2015.zip (24-hour time, so the newest always sorts last)`.
    - The newest one is obvious in Downloads. Keep it and delete the older zips; there's no deleting files one by one.
    - File names inside never change, so they replace old copies one for one. A READ_ME_FIRST.txt inside lists what's in it and when it was made.
    - Never Google Drive, never links, never markdown only. A copy also stays in the project's docs folder.
    - `bash scripts/package.sh` rebuilds the journal, change log and every Word file, makes the zip, and prints its path.
5. **Everything works on a phone** (Samsung Z Fold 6): big thumb buttons, readable text, short instructions, text boxes that grow, a mic on text boxes.
6. **Zero cost.** No paid services without asking.
7. **Photos:** pick from the phone's gallery first, camera second. Every pricing tool has both buttons.
8. **After every code change, publish the site** (Vercel production).
9. **Believe what you saw on screen.** Ask for a screenshot if needed, and fix the layout so it can't be misread.
10. **Bottom line first, short and honest.** Own mistakes in one sentence and fix them.
11. **"What do you think?"** gets an opinion with reasons, then Claude waits for your go, unless you already said "do it all."
12. **Plain English for people who have never done this.** No crossed-out text, no jargon, steps in the order they happen. First pages stay upbeat; fine print comes later.
13. **Design for how people actually think (psychology first).**
    - One obvious next step on every screen.
    - Show value before asking for anything.
    - What a beginner uses first goes at the top.
    - Checklists start partly done.
    - Ask for the upgrade at happy moments and at limits, never cold.
    - Celebrate wins. Sharing is a top action.
14. **The tool leads; the store is the bonus.** In all marketing: "the AI writes your listings for nine sites; listing in our store is free."
15. **Automate everything that can be automated.** Whatever can't be automated goes on the Operations page or your 📝 To-do list, with exact steps.
16. **The owner sees everything.**
    - Every number opens to the people behind it.
    - You can see exactly what a buyer sees.
    - Everything deleted can be brought back.
17. **Test like a stranger:** signed out, at phone width, with real data.
18. **Records are kept and sent without being asked.**
    - **Build Journal:** every conversation, both sides word for word (your messages and Claude's replies). It includes the arguments, the cussing, the corrections, the compliments and the back-and-forth, because how you and AI work together is the heart of the book. It runs from the first warehouse chats (Prologue, September 7–29), through day one (September 29), to now. Nothing is summarized in place of the real words.
    - **Change Log:** every change.
    - Both are sent after every batch of work, at the end of every session, and at least every two hours.
    - Anything you say about AI, the journey or why you do this goes into the Mission Statement, with Claude's reply.
    - The User Guide, White Paper, Complete Guide and Presentation Walkthrough stay current.
19. **One complete answer, first time, every field spelled out (added Oct 2, 2026).**
    - If something is knowable, the first answer is the final answer. Look it up first and check the real current state, including who controls it.
    - Give ONE message with the exact count up front ("6 new, 2 edits"), then every item with every field written out (type, name, value, priority) and what to leave alone.
    - Never change the list midstream, and keep the same order every time. If something has to change, say what changed and that you do not have to redo anything.
    - Know how the screen behaves before you hit it (gray text in a box is a hint, not a value; Save stays gray until every opened form is filled or deleted). Read every field of your screenshots and spot empty required boxes before you have to ask.
    - After you save, Claude checks it live and tells you. You are never sent to check.
    - Why this exists: the shayneforva.com DNS fix took over 30 minutes and should have taken 5.
20. **Send the records after EVERY batch, however small (added Oct 2, 2026).**
    - No "too small to send." After any deploy or change, the zip with every current file (rule 4) comes into the chat.
    - The back and forth is the book, and the updated files are what gets passed to the next app.
    - These rules live in the master files (this document, the Claude skill, each project's CLAUDE.md), not only in Claude's memory.
    - On the political posting app a Stop hook blocks Claude from ending a turn if there is a change newer than the last send. Every new project gets the same scripts and hook first.
    - Why this exists: a fix on Oct 2 at 6:14 PM was deployed and the files were not sent until he pointed it out.

21. **Keep the App Builder's Playbook current (added Oct 5, 2026).**
    - The Playbook is the master guide for building any app or website the way we built this one.
    - Claude adds every new mistake and its fix, every new rule, and every new outside service or workaround as it happens.
    - It's rebuilt from the real code and sent in every zip, like the journal.
    - The other apps (the political posting app) add their own lessons in the same format; Shayne brings each copy back here to be merged into one master.

22. **Learned from the political posting app (added Oct 5, 2026).**
    - **Filter in code anything that must never appear.** A prompt rule alone doesn't hold (AI price talk in listings; em dashes in posts). Listings now pass through a code filter for AI tells.
    - **Copy what already won** (the owner's own best posts and sales) before generic advice.
    - **Never say "next I'm doing X" and then go quiet.** Send a one-line status after a long stretch.
    - **Prove a fix is surgical:** `bash scripts/diff_check.sh` lists every file a deploy will change. Stop if anything shows up that wasn't asked for.
    - **The Stop hook enforces rule 20:** a turn can't end while code changes haven't been sent. After sending the zip, run `bash scripts/mark_sent.sh`.

23. **Locked layouts (Oct 9, 2026).**
    - Once the owner settles where something goes, it's written down as LOCKED in CLAUDE.md and never moved without his say.
    - Anything brought back goes where he last asked for it.

**Facts to never get wrong:** one 25,000 sq ft warehouse with over 300 pallets. Never "three warehouses" or "400 pallets."
```

# Appendix B: The records scripts (full code)

*Source: `.claude/settings.json`*

```json
{
  "hooks": {
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python3 scripts/journal.py; python3 scripts/changelog.py"
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python3 scripts/journal.py; python3 scripts/changelog.py"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python3 scripts/stop_check.py"
          }
        ]
      }
    ]
  }
}
```

*Source: `scripts/package.sh`*

```bash
#!/usr/bin/env bash
# One download with every current file. Shayne's rule (Oct 2, 2026): every send is ONE zip,
# named with the date and time so the newest is obvious in Downloads and nothing has to be deleted one by one.
# Usage: bash scripts/package.sh   -> prints the zip path to send with SendUserFile.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 scripts/journal.py >/dev/null
python3 scripts/changelog.py >/dev/null
python3 scripts/build_playbook.py >/dev/null   # App Builder's Playbook: re-reads the real code every time
# rebuild every Word copy from its source so nothing in the zip is stale
for md in docs/Next_Owner_Market_*.md; do
  docx="${md%.md}.docx"
  pandoc "$md" --from gfm-tex_math_dollars -o "$docx"
done
stamp=$(TZ=America/New_York date +%Y-%m-%d_%H%M)  # 24-hour so names sort newest-last correctly
out=/home/claude/deliverables
mkdir -p "$out"
rm -f "$out"/Next_Owner_Market_Files_*.zip
dir=$(mktemp -d)/Next_Owner_Market_Files_$stamp
mkdir -p "$dir/Pictures"
cp docs/Next_Owner_Market_*.docx "$dir/"
cp docs/brand/*.png "$dir/Pictures/" 2>/dev/null || true
{
  echo "Next Owner Market: every current file"
  echo "Made $(TZ=America/New_York date '+%A, %B %-d, %Y at %-I:%M %p') Eastern."
  echo
  echo "This zip replaces any older one. Keep the newest zip and delete the rest."
  echo "File names never change, so these replace your old copies one for one."
  echo
  echo "What's inside:"
  (cd "$dir" && find . -type f ! -name READ_ME_FIRST.txt | sed 's|^\./|  - |' | sort)
} > "$dir/READ_ME_FIRST.txt"
zip_path="$out/Next_Owner_Market_Files_$stamp.zip"
(cd "$(dirname "$dir")" && zip -qr "$zip_path" "$(basename "$dir")")
echo "$zip_path"
```

*Source: `scripts/changelog.py`*

```python
#!/usr/bin/env python3
"""Rebuild docs/Next_Owner_Market_Change_Log.md (+ .docx) from git history: every change, when, what, which files."""
import subprocess, os, datetime, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, "docs")
OUT = os.path.join(DOCS, "Next_Owner_Market_Change_Log.md")

def git(*a): return subprocess.run(["git", *a], cwd=ROOT, capture_output=True, text=True).stdout

AREA = [
  ("src/app/api/", "Server routes (API)"), ("src/app/app/", "Seller / staff app"), ("src/app/account/", "Buyer account & orders"),
  ("src/app/item/", "Public item page"), ("src/app/", "Public site pages"), ("src/lib/", "Shared code (logic)"), ("src/components/", "Shared UI pieces"),
  ("supabase/", "Database (migrations)"), ("docs/", "Documents"), ("scripts/", "Automation scripts"), ("public/", "Static files (logo, icons)"),
  (".claude/", "Project automation"), ("CLAUDE.md", "Project rules"), ("package", "Dependencies"),
]
def area(path):
    for pre, name in AREA:
        if path.startswith(pre): return name
    return "Other"

def main():
    log = git("log", "--reverse", "--date=iso-local", "--pretty=format:%H%x1f%ad%x1f%s%x1f%b%x1e")
    commits = [c for c in log.split("\x1e") if c.strip()]
    out = ["# Next Owner Market — Change Log\n", f"*Every change to the code, database, and documents, oldest first. Generated {datetime.datetime.now().strftime('%B %-d, %Y %-I:%M %p')} from the project history ({len(commits)} changes).*\n"]
    byday = collections.OrderedDict()
    for c in commits:
        h, date, subj, body = (c.split("\x1f") + ["", "", "", ""])[:4]
        day = date[:10]
        files = [f for f in git("show", "--stat=200", "--format=", "--name-only", h.strip()).split("\n") if f.strip()]
        byday.setdefault(day, []).append((date[11:16], subj.strip(), body, files, h.strip()[:7]))
    for day, items in byday.items():
        out.append(f"\n## {datetime.date.fromisoformat(day).strftime('%A, %B %-d, %Y')}\n")
        for t, subj, body, files, h in items:
            out.append(f"### {t} — {subj}\n")
            notes = "\n".join(l for l in body.split("\n") if l.strip() and not l.startswith("Co-Authored-By") and not l.startswith("Claude-Session")).strip()
            if notes: out.append(notes + "\n")
            groups = collections.OrderedDict()
            for f in files: groups.setdefault(area(f), []).append(f)
            for g, fs in groups.items():
                out.append(f"- **{g}:** " + ", ".join(f"`{f}`" for f in fs[:12]) + (f" (+{len(fs)-12} more)" if len(fs) > 12 else ""))
            out.append(f"\n<sub>change id {h}</sub>\n")
    open(OUT, "w").write("\n".join(out))
    docx = OUT.replace(".md", ".docx")
    subprocess.run(["pandoc", OUT, "-o", docx, "--from", "gfm-tex_math_dollars", "--to", "docx"], check=False)
    if os.path.isdir("/home/claude/deliverables"): subprocess.run(["cp", docx, "/home/claude/deliverables/"], check=False)
    print("change log updated:", docx, len(commits), "changes")

if __name__ == "__main__": main()
```

*Source: `scripts/journal.py`*

```python
#!/usr/bin/env python3
import re
"""Rebuild docs/Next_Owner_Market_Build_Journal.md (+ .docx) from the chat transcript.

Usage:
  python3 scripts/journal.py                 # finds the newest transcript for this project
  python3 scripts/journal.py <transcript.jsonl>
Reads a PreCompact hook payload from stdin (JSON with transcript_path) when piped.
Part 1 (reconstructed day one) is kept verbatim from docs/journal_part1.md; Part 2 is regenerated.
"""
import json, re, sys, glob, os, datetime, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, "docs")
OUT_MD = os.path.join(DOCS, "Next_Owner_Market_Build_Journal.md")
PART1 = os.path.join(DOCS, "journal_part1.md")
DELIV = os.path.expanduser("~/../claude/deliverables") if os.path.isdir("/home/claude/deliverables") else DOCS

def find_transcript():
    try:
        import select
        if not sys.stdin.isatty() and select.select([sys.stdin], [], [], 0.2)[0]:
            payload = json.load(sys.stdin)
            if payload.get("transcript_path"): return payload["transcript_path"]
    except Exception: pass
    if len(sys.argv) > 1: return sys.argv[1]
    cands = glob.glob(os.path.expanduser("~/.claude/projects/*next-owner-market*/*.jsonl"))
    cands = [c for c in cands if os.path.getsize(c) > 10000]
    return max(cands, key=os.path.getmtime) if cands else None

def local(ts):
    d = datetime.datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(datetime.timezone(datetime.timedelta(hours=-4)))
    return d.strftime("%b %-d, %-I:%M %p")

SECRET_PATTERNS = [
    r"sk-ant-[A-Za-z0-9_\-]{20,}", r"sb_secret_[A-Za-z0-9_\-]{10,}", r"sb_publishable_[A-Za-z0-9_\-]{10,}",
    r"gh[pousr]_[A-Za-z0-9]{20,}", r"github_pat_[A-Za-z0-9_]{20,}",
    r"(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{10,}", r"whsec_[A-Za-z0-9]{10,}", r"re_[A-Za-z0-9]{8,}_[A-Za-z0-9]{8,}",
    r"eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}", r"vcp_[A-Za-z0-9]{20,}", r"shippo_(?:live|test)_[A-Za-z0-9]{10,}",
    r"AIza[0-9A-Za-z_\-]{30,}", r"EAA[A-Za-z0-9]{40,}",
]
def redact(txt):
    """The book never contains passwords or keys (he sometimes pastes them into chat)."""
    for pat in SECRET_PATTERNS: txt = re.sub(pat, "[key removed]", txt)
    return txt

def rows_from(path):
    rows = []
    for line in open(path):
        try: j = json.loads(line)
        except Exception: continue
        t = j.get("type"); ts = j.get("timestamp", "")
        c = (j.get("message") or {}).get("content")
        if t == "user":
            txt = c if isinstance(c, str) else "\n".join(x.get("text", "") for x in c if isinstance(x, dict) and x.get("type") == "text") if isinstance(c, list) else None
            if txt:
                txt = re.sub(r"<system-reminder>.*?</system-reminder>", "", txt, flags=re.S).strip()
                if txt and not txt.startswith("This session is being continued"): rows.append(("U", ts, redact(txt)))
        elif t == "assistant" and isinstance(c, list):
            txt = "\n".join(x.get("text", "") for x in c if isinstance(x, dict) and x.get("type") == "text").strip()
            if txt: rows.append(("A", ts, redact(txt)))
    return rows

def render(rows, session_label):
    out = [f"\n## Session: {session_label}\n"]
    i = 0
    while i < len(rows):
        kind, ts, txt = rows[i]
        if kind == "U":
            out.append(f"### {local(ts)} — Shayne\n\n> " + txt.replace("\n", "\n> ") + "\n"); i += 1
            replies = []
            while i < len(rows) and rows[i][0] == "A": replies.append(rows[i][2]); i += 1
            if replies: out.append("**Claude:**\n\n" + "\n\n".join(replies) + "\n")
        else:
            out.append("**Claude:**\n\n" + txt + "\n"); i += 1
    return "\n".join(out)

def merge_rows(cache_path, rows):
    """Append-only cache: the transcript file is rewritten when the chat is condensed, so never trust it alone."""
    old = []
    if os.path.exists(cache_path):
        try: old = json.load(open(cache_path))
        except Exception: old = []
    seen = {(r[0], r[1], r[2][:120]) for r in old}
    for r in rows:
        k = (r[0], r[1], r[2][:120])
        if k not in seen: old.append(list(r)); seen.add(k)
    old = [[r[0], r[1], redact(r[2])] for r in old]
    old.sort(key=lambda r: r[1])
    json.dump(old, open(cache_path, "w"))
    return [tuple(r) for r in old]

def main():
    path = find_transcript()
    if not path or not os.path.exists(path): print("no transcript found"); return
    rows = rows_from(path)
    part1 = open(PART1).read() if os.path.exists(PART1) else "# Next Owner Market — The Build Journal\n"
    sess_dir = os.path.join(DOCS, "journal_sessions"); os.makedirs(sess_dir, exist_ok=True)
    sid = os.path.basename(path).split(".")[0]
    rows = merge_rows(os.path.join(sess_dir, f"{sid}.rows.json"), rows)
    if not rows: print("no rows"); return
    # An .archive.md holds text captured before a condense wiped the transcript; new rows after its end are appended.
    archive = os.path.join(sess_dir, f"{sid}.archive.md")
    if os.path.exists(archive):
        a = open(archive).read()
        meta = os.path.join(sess_dir, f"{sid}.archive.json")
        end = json.load(open(meta))["end"] if os.path.exists(meta) else "0000"
        fresh = [r for r in rows if r[1] > end]
        text = a + ("\n" + render(fresh, "continued").split("\n", 2)[2] if fresh else "")
        # keep the session heading's end time current (the archive was written with its old end time)
        text = re.sub(r"(## Session: [^→\n]+→ )[^\n]+", lambda m: m.group(1) + local(rows[-1][1]) + " (continuing)", text, count=1)
    else:
        label = f"{local(rows[0][1])} → {local(rows[-1][1])} ({len([r for r in rows if r[0]=='U'])} messages from Shayne)"
        text = render(rows, label)
    open(os.path.join(sess_dir, f"{sid}.md"), "w").write(redact(text))
    for extra in glob.glob(os.path.join(sess_dir, "*.md")) + [os.path.join(DOCS, "journal_prologue.md"), PART1]:
        if os.path.exists(extra):
            t = open(extra).read(); r = redact(t)
            if r != t: open(extra, "w").write(r)
    sessions = sorted(glob.glob(os.path.join(sess_dir, "*.md")), key=os.path.getmtime)
    sessions = [s for s in sessions if not s.endswith(".archive.md")]
    # Day one (Sep 29, the first build session, saved from its own transcript) always comes first
    sessions.sort(key=lambda s: 0 if os.path.basename(s) == "day1.md" else 1)
    prologue_path = os.path.join(DOCS, "journal_prologue.md")
    prologue = ("\n\n---\n\n" + open(prologue_path).read()) if os.path.exists(prologue_path) else ""
    body = part1 + prologue + "\n\n---\n\n## Part 2 · Verbatim sessions: every word, both sides\n" + "".join(open(s).read() for s in sessions)
    open(OUT_MD, "w").write(redact(body))
    try:
        docx = os.path.join(DOCS, "Next_Owner_Market_Build_Journal.docx")
        subprocess.run(["pandoc", OUT_MD, "-o", docx, "--from", "gfm-tex_math_dollars", "--to", "docx"], check=True)
        if os.path.isdir("/home/claude/deliverables"): subprocess.run(["cp", docx, "/home/claude/deliverables/"], check=False)
        print("journal updated:", docx)
    except Exception as e:
        print("markdown updated; docx failed:", e)

if __name__ == "__main__": main()
```

*Source: `scripts/build_playbook.py`*

````python
#!/usr/bin/env python3
"""Build docs/Next_Owner_Market_App_Builder_Playbook.md from docs/playbook/template.md.

The template quotes real code with markers, so the playbook always shows the code as it is today:
  {{FILE path lang}}            the whole file, in a fenced block
  {{LINES path start end lang}} lines start..end (1-based, inclusive)
  {{BETWEEN path "start text" "end text" lang}}  from the line containing start text up to (not including) the line containing end text
Run by scripts/package.sh before the Word files are made.
"""
import os, re, shlex

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TPL = os.path.join(ROOT, "docs", "playbook", "template.md")
OUT = os.path.join(ROOT, "docs", "Next_Owner_Market_App_Builder_Playbook.md")


def read(p):
    with open(os.path.join(ROOT, p), encoding="utf-8") as f:
        return f.read().rstrip("\n").split("\n")


def fence(lines, lang, src):
    body = "\n".join(lines)
    ticks = "````" if "```" in body else "```"
    return f"*Source: `{src}`*\n\n{ticks}{lang}\n{body}\n{ticks}"


def render(m):
    parts = shlex.split(m.group(1))
    kind, path = parts[0], parts[1]
    lines = read(path)
    if kind == "FILE":
        return fence(lines, parts[2] if len(parts) > 2 else "", path)
    if kind == "LINES":
        a, b = int(parts[2]), int(parts[3])
        return fence(lines[a - 1:b], parts[4] if len(parts) > 4 else "", f"{path}, lines {a}-{b}")
    if kind == "BETWEEN":
        s, e = parts[2], parts[3]
        i = next(n for n, l in enumerate(lines) if s in l)
        j = next(n for n, l in enumerate(lines) if n > i and e in l)
        return fence(lines[i:j], parts[4] if len(parts) > 4 else "", f"{path}, lines {i + 1}-{j}")
    raise ValueError(kind)


def main():
    with open(TPL, encoding="utf-8") as f:
        t = f.read()
    out = re.sub(r"\{\{(.+?)\}\}", render, t)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(out)
    print(OUT)


if __name__ == "__main__":
    main()
````

# Appendix C: Every environment variable in Next Owner Market (names only)

| Name | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project address |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public key for browser and page clients |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret key for server-only admin work |
| `NEXT_PUBLIC_SITE_URL` | The site's address for links, sitemap and emails |
| `ANTHROPIC_API_KEY` | AI |
| `CLAUDE_MODEL`, `CLAUDE_GROUP_MODEL`, `CLAUDE_ASK_MODEL` | Which AI model each feature uses (optional) |
| `STRIPE_SECRET_KEY` | Payments (the webhook secret and Pro price live in `settings.stripe`) |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email |
| `STAFF_ALERT_TO` | Who gets owner alerts (optional) |
| `CRON_SECRET` | Protects the daily job (Vercel cron sends it automatically) |
| `SHIPPO_API_KEY` | Shipping labels and live rates (optional) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | Paid texts (not used) |
| `AUTOMATION_EMAIL_CAP` | Daily automatic-email limit (default 80) |
| `AMAZON_TAG`, `EBAY_CAMPID` | Affiliate IDs (optional) |
| `FORCE_DIGEST`, `FORCE_WEEKLY_BLOG`, `ROBOT_ANY_DAY` | Test switches |

All are set in Vercel → the project → Settings → Environment Variables (Production), by Claude through the Vercel connector. Local copies are in `.env.local`, which is never committed.
