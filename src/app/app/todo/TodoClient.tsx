"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Mic from "@/components/Mic";

export type Todo = { id: string; title: string; notes: string | null; priority: "urgent" | "needed" | "someday"; due_date: string | null; remind: "weekly" | "due" | "none"; done_at: string | null; snooze_until: string | null; created_at: string };

const PRI = { urgent: { label: "🔴 Urgent", color: "var(--danger)" }, needed: { label: "🟡 Needed", color: "var(--accent)" }, someday: { label: "⚪ Someday", color: "var(--line)" } } as const;
const REMIND = { weekly: "Every Monday + when due", due: "Only when it's coming due", none: "Don't remind me" } as const;
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
