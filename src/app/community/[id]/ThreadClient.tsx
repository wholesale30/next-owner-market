"use client";

import Mic from "@/components/Mic";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Reply = { id: string; body: string; hidden: boolean; created_at: string; author_id: string; author: string };
type Thread = { id: string; title: string; body: string; photo_url: string | null; author: string; author_id: string; created_at: string; locked: boolean; hidden: boolean; pinned: boolean; item: { sku: string; title: string; price: number } | null };

export default function ThreadClient({ thread, replies, meId, staff }: { thread: Thread; replies: Reply[]; meId: string | null; staff: boolean }) {
  const router = useRouter();
  const sb = createClient();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [reported, setReported] = useState<string | null>(null);
  const when = (d: string) => new Date(d).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  async function reply(e: React.FormEvent) {
    e.preventDefault();
    if (!meId) { router.push(`/signup?buyer=1&next=/community/${thread.id}`); return; }
    setBusy(true); setErr(null);
    const { error } = await sb.from("replies").insert({ thread_id: thread.id, author_id: meId, body: body.trim() });
    setBusy(false);
    if (error) return setErr(error.message);
    setBody(""); router.refresh();
  }
  async function report(kind: "thread" | "reply", id: string) {
    if (!meId) { router.push(`/login?next=/community/${thread.id}`); return; }
    const reason = prompt("What's wrong with it? (spam, scam, rude, wrong board…)") || "";
    await sb.from("reports").insert({ kind, target_id: id, reporter_id: meId, reason });
    setReported(id);
  }
  async function moderate(kind: "thread" | "reply", id: string, hide: boolean) { await sb.rpc("moderate", { p_kind: kind, p_id: id, p_hide: hide }); router.refresh(); }
  async function setFlag(patch: Record<string, boolean>) { await sb.from("threads").update(patch).eq("id", thread.id); router.refresh(); }
  async function remove(kind: "thread" | "reply", id: string) { if (!confirm("Delete this?")) return; await sb.from(kind === "thread" ? "threads" : "replies").delete().eq("id", id); if (kind === "thread") router.push("/community"); else router.refresh(); }

  return (
    <div className="space-y-3">
      <article className="card p-4 space-y-2" style={thread.hidden ? { opacity: .5 } : undefined}>
        <h1 className="text-xl font-extrabold leading-tight">{thread.pinned ? "📌 " : ""}{thread.title}</h1>
        <p className="text-xs muted">@{thread.author} · {when(thread.created_at)}{thread.hidden ? " · hidden" : ""}</p>
        {thread.photo_url && <img src={thread.photo_url} alt="" className="w-full rounded-xl max-h-96 object-contain" style={{ background: "var(--line)" }} />}
        <p className="whitespace-pre-line">{thread.body}</p>
        {thread.item && <Link href={`/item/${thread.item.sku}`} className="card p-2 text-sm block">🏷 {thread.item.title} · ${thread.item.price}</Link>}
        <div className="flex gap-2 flex-wrap text-xs">
          {reported === thread.id ? <span className="muted">Reported, thanks.</span> : <button type="button" className="pill" onClick={() => report("thread", thread.id)}>⚑ Report</button>}
          {(staff || meId === thread.author_id) && <button type="button" className="pill" onClick={() => remove("thread", thread.id)}>Delete</button>}
          {staff && <>
            <button type="button" className="pill" onClick={() => moderate("thread", thread.id, !thread.hidden)}>{thread.hidden ? "Unhide" : "Hide"}</button>
            <button type="button" className="pill" onClick={() => setFlag({ pinned: !thread.pinned })}>{thread.pinned ? "Unpin" : "Pin"}</button>
            <button type="button" className="pill" onClick={() => setFlag({ locked: !thread.locked })}>{thread.locked ? "Unlock" : "Lock"}</button>
          </>}
        </div>
      </article>

      <h2 className="font-semibold">{replies.length} {replies.length === 1 ? "reply" : "replies"}</h2>
      {replies.map((r) => (
        <div key={r.id} className="card p-3 space-y-1" style={r.hidden ? { opacity: .5 } : undefined}>
          <p className="text-xs muted">@{r.author} · {when(r.created_at)}{r.hidden ? " · hidden" : ""}</p>
          <p className="text-sm whitespace-pre-line">{r.body}</p>
          <div className="flex gap-2 text-xs">
            {reported === r.id ? <span className="muted">Reported.</span> : <button type="button" className="muted" onClick={() => report("reply", r.id)}>⚑</button>}
            {(staff || meId === r.author_id) && <button type="button" className="muted" onClick={() => remove("reply", r.id)}>Delete</button>}
            {staff && <button type="button" className="muted" onClick={() => moderate("reply", r.id, !r.hidden)}>{r.hidden ? "Unhide" : "Hide"}</button>}
          </div>
        </div>
      ))}

      {thread.locked ? <p className="card p-3 text-sm muted text-center">This post is closed to new replies.</p> : (
        <form onSubmit={reply} className="card p-3 space-y-2">
          <textarea className="input" rows={3} maxLength={4000} placeholder={meId ? "Write a reply…" : "Sign in to reply"} value={body} onChange={(e) => setBody(e.target.value)} required />
          <Mic onText={(t) => setBody((b) => (b ? b + " " : "") + t)} />
          {err && <p className="text-sm" style={{ color: "var(--danger)" }}>{err}</p>}
          <button className="btn btn-primary w-full" disabled={busy || !body.trim()}>{meId ? "Reply" : "Sign in to reply"}</button>
        </form>
      )}
    </div>
  );
}
