---
title: "App Builder's Playbook"
subtitle: "How Shayne and Claude build apps strong and right the first time. Everything learned building Next Owner Market (Sept 29 to Oct 5, 2026), ready to reuse on any app or website."
---

# How to use this

**Version 1.0, October 5, 2026.** Written from Next Owner Market (nextownermarket.com): 7 days of building, 240+ changes, about 8,000 lines of verbatim conversation.

This has two parts.

- **Part 1: the Owner's To-do and twice-a-day reminder.** It's an exact handoff. Another Claude can rebuild it in a different app without guessing. The code is the real code, pulled straight from the project files when this was made.
- **Part 2: the Playbook.** How we work, the order to set up a new app, the patterns that worked, every trial and error with its fix, costs, platform gotchas and the rules. Use it for any app or website.

**For Shayne:** give this file to Claude at the start of any new project. Say: *"Read the App Builder's Playbook first, then follow it."* The same rules are also saved as a Claude skill (app-builder-playbook), so they load on their own in any chat.

**For any Claude reading this:**

1. Read Part 2, section 1 (the rules) and section 2 (the day-zero checklist) before writing any code.
2. Follow the operating rules in Appendix A exactly. They are the owner's own words, earned the hard way.
3. Add what you learn using the format in Part 2, section 16, so the next app gets it too.

**For the Claude building the political posting app:**

1. Keep this file whole. Add a new section at the end: **"Lessons from the Political Posting App,"** in the format of Part 2, section 16.
2. Where your app found a better way than this one, say so plainly under **"Better than Next Owner Market."** Don't delete anything here.
3. Bump the version (1.1) and date at the top.

Shayne will bring it back here and the two will be merged into one master copy.

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

{{FILE supabase/migrations/032_owner_todos.sql sql}}

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

{{FILE supabase/migrations/031_anon_is_staff.sql sql}}

The recycle bin, which catches deletes (from migration 030):

{{LINES supabase/migrations/030_payout_pending_and_recycle_bin.sql 6 23 sql}}

### The private-settings rule and the reminder's schedule (migration 039)

{{FILE supabase/migrations/039_todo_twice_daily.sql sql}}

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

{{FILE src/app/app/todo/page.tsx tsx}}

{{FILE src/app/app/todo/TodoClient.tsx tsx}}

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

{{LINES src/app/app/layout.tsx 9 16 tsx}}

{{LINES src/app/app/layout.tsx 30 35 tsx}}

The menu link shows `📝 To-do (N)`, and the green banner says "📝 N things on your to-do list need you. Tap to see." N counts items that aren't done or snoozed **and** are urgent or due within 3 days.

## 1.4 The twice-a-day email and text

### The code that builds it

It's one "automation" in `src/lib/automations.ts`, called `secretary`:

{{BETWEEN src/lib/automations.ts "const secretary: Automation = {" "// ---------------------------------------------------------------- Monday thrift" ts}}

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

{{BETWEEN src/lib/automations.ts "type Result = Record<string, unknown>;" "export async function sendAutoEmail" ts}}

{{BETWEEN src/lib/automations.ts "export async function runAutomations" "export { slugify };" ts}}

The line `if (!only && a.key === "todo_reminders") continue;` keeps the reminder out of the 9 AM daily job, so it only runs at 11 and 5.

**If the new app has no automation frame,** call the reminder function directly from the route in 1.5. Copy the body of `run()` into an exported `async function sendTodoDigest()` and call that instead of `runAutomations("todo_reminders")`.

## 1.5 How it's scheduled

| Item | Exactly |
|---|---|
| **Service** | **Supabase pg_cron** (built-in, free) plus **pg_net**. The database itself calls the website. |
| **Why not Vercel cron** | On the free (Hobby) plan, Vercel cron runs at most once a day and only promises "sometime within the hour." The owner asked for 11:00 and 5:00 exactly. |
| **Job name** | `todo-reminders-11am-5pm` |
| **Schedule** | `0 15,16,21,22 * * *` (UTC) |
| **What it calls** | `GET https://nextownermarket.com/api/todo/remind?key=<secret from settings 'todo:remind'>` |
| **Daylight saving** | In summer (EDT, UTC−4), 15:00 UTC = 11 AM and 21:00 = 5 PM. In winter (EST, UTC−5), 16:00 UTC = 11 AM and 22:00 = 5 PM. All four fire; the route sends only when the New York hour is **11 or 17**. The other two calls answer "skipped" and send nothing. Nothing has to change when the clocks change. |
| **No doubles** | The route saves `last_slot` (e.g. `2026-10-05 17`) in settings and won't send the same slot twice. |
| **Checked live** | On October 5, 2026 the 21:00 and 22:00 UTC runs both ran "succeeded." The automation recorded a send at 5:00:07 PM: 12 open, 5 urgent. |

The route:

{{FILE src/app/api/todo/remind/route.ts ts}}

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

{{FILE src/app/api/ops/kick/route.ts ts}}

## 1.6 How the email and text are sent

| Item | Exactly |
|---|---|
| **Email service** | **Resend** (resend.com), through its HTTPS API. |
| **Free?** | Yes, on the free plan: **3,000 emails a month and 100 a day.** Two reminders a day uses 60 a month. Paid is $20/month for 50,000. |
| **The text message** | Also free. It's the same email sent to the phone company's email-to-text address. For Verizon, `8047207910@vtext.com` becomes a normal text. For the long to-do list it's switched to **`@vzwpix.com`** (picture message), so the whole list arrives instead of being cut at 160 characters. |
| **Who receives it** | The env var `STAFF_ALERT_TO` if set, otherwise `settings.business.alert_to` (comma-separated), otherwise `settings.business.contact_email`. In Next Owner Market it's `settings.business.alert_to` = the Verizon number's text address plus two email addresses. |
| **Sender** | `EMAIL_FROM` if set. Otherwise "Next Owner Market <onboarding@resend.dev>". Sending as your own domain requires verifying the domain in Resend (DNS records). An unverified domain fails; see T-26. |
| **Nothing lost** | Every alert is first written to the `notifications` table, then sent. |

{{FILE src/lib/alert.ts ts}}

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
23. **Search, don't guess,** on every fact: prices, rules, policies. "I don't ask you to guess. You need to go out and look on the Internet."

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
   - the political app's Stop hook (`stop_check.py`), so a turn can't end with unsent changes;
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

{{FILE src/lib/supabase/server.ts ts}}

{{FILE src/proxy.ts ts}}

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

{{FILE src/lib/ai-tool.ts ts}}

### 4.7 AI money: log every call, give allowances, sell top-ups

{{LINES src/lib/usage.ts 1 37 ts}}

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
| **Resend** (email) | Every email: orders, alerts, welcome series, digests, to-do reminders | `RESEND_API_KEY` (send-only), `EMAIL_FROM`; domain verified with DNS records | Sends from server code; every send logged (`email_log`, `notifications`) | A send-only key can't read account info (401), so health is judged by real sends. Capped at 80 automatic emails a day. The sandbox can't reach Resend directly, so test by triggering the live site. | Free 3,000/month, 100/day |
| **Phone carriers' email-to-text** (texts) | Owner alerts and seller texts | An address like `8047207910@vtext.com` in `settings.business.alert_to`; sellers pick a carrier in Profile | Same as email | `@vzwpix.com` carries long messages. Dead carriers (AT&T, Cricket, T-Mobile, Metro, Mint) are marked "texts not available"; Verizon ends by March 31, 2027. | Free |
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
| **Hooks** (`.claude/settings.json`) | Commands that run on their own | Journal and change log before condensing and at session end; a Stop hook in the political app | Hooks can't send files to the chat. |
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
5. Deploy: Vercel `create_deployment` with project, target production and the git source, and **no team ID**. One build at a time.
6. Wait for READY, then check live (pg_net, or the page itself).
7. Update the guides. Run `package.sh`, commit the records, push, deploy, and **send the zip**.
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

- No team ID on deploys.
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
- A send-only key returns 401 on account calls, so judge health by real sends.

**Anthropic AI**

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
- **Use the Stop hook from day one** (from the political app).
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

# Appendix A: The Operating Rules (full text)

{{FILE docs/Next_Owner_Market_Operating_Rules.md markdown}}

# Appendix B: The records scripts (full code)

{{FILE .claude/settings.json json}}

{{FILE scripts/package.sh bash}}

{{FILE scripts/changelog.py python}}

{{FILE scripts/journal.py python}}

{{FILE scripts/build_playbook.py python}}

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
