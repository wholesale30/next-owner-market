"use client";

import Mic from "@/components/Mic";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/listing";

interface Convo {
  id: string; buyer_name: string | null; subject: string | null; status: string;
  last_message_at: string; unread_for_staff: boolean; unread_for_seller?: boolean;
  items: { id: string; sku: string; title: string; price: number | null; status: string; item_photos: { url: string; is_primary: boolean }[] } | null;
}
interface Msg { id: string; sender: string; body: string; created_at: string }

const when = (iso: string) => {
  const d = new Date(iso), diff = Date.now() - d.getTime();
  if (diff < 3600000) return `${Math.max(1, Math.round(diff / 60000))}m`;
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
};
const isPhone = (s: string) => /^[\d\s()+-]{7,}$/.test(s.trim());

export default function InboxClient({ convos, active, messages, showAll, staff, contact }: { convos: Convo[]; active: string | null; messages: Msg[]; showAll: boolean; staff: boolean; contact: string | null }) {
  const router = useRouter();
  const supabase = createClient();
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const conv = convos.find((c) => c.id === active) || null;
  const canned = ["Yes, still available.", "Best I can do is $", "Tested and working.", "Pickup is at the warehouse, pick a time from the item page.", "I can ship that. Let me get you a quote.", "Sorry, that one just sold."];

  async function send() {
    if (!conv || !reply.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc("staff_reply", { p_conversation_id: conv.id, p_body: reply });
    setBusy(false);
    if (error) return alert(error.message);
    fetch("/api/messages/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId: conv.id }) }).catch(() => {});
    setReply("");
    router.refresh();
  }
  async function setStatus(status: string) {
    if (!conv) return;
    await supabase.from("conversations").update({ status }).eq("id", conv.id);
    router.refresh();
  }

  if (conv) {
    const photo = conv.items?.item_photos?.find((p) => p.is_primary) || conv.items?.item_photos?.[0];
    return (
      <div className="space-y-3 pb-32">
        <Link href="/app/inbox" className="text-sm muted">← Inbox</Link>
        <div className="card p-3 flex gap-3 items-center">
          <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0" style={{ background: "var(--line)" }}>{photo && <img src={photo.url} alt="" className="w-full h-full object-cover" />}</div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold truncate">{conv.buyer_name || "Buyer"} {contact && <span className="muted font-normal text-sm">• {contact}</span>}</p>
            {conv.items ? <Link href={`/app/items/${conv.items.id}`} className="text-sm underline truncate block">{conv.items.title} • {money(conv.items.price)} • {conv.items.status}</Link> : <p className="text-sm muted">General question</p>}
          </div>
          <div className="flex flex-col gap-1">
            {contact && (isPhone(contact) ? <a className="pill" href={`sms:${contact.replace(/\s/g, "")}`}>Text</a> : <a className="pill" href={`mailto:${contact}`}>Email</a>)}
            <button className="pill" onClick={() => setStatus(conv.status === "closed" ? "open" : "closed")}>{conv.status === "closed" ? "Reopen" : "Close"}</button>
          </div>
        </div>

        <div className="space-y-2">
          {messages.map((m) => (
            <div key={m.id} className={`max-w-[85%] p-3 rounded-2xl text-sm ${m.sender === "staff" ? "ml-auto" : ""}`} style={{ background: m.sender === "staff" ? "var(--brand)" : "var(--surface)", color: m.sender === "staff" ? "var(--brand-ink)" : "var(--ink)", border: m.sender === "staff" ? "none" : "1px solid var(--line)" }}>
              <p className="whitespace-pre-wrap">{m.body}</p>
              <p className="text-[10px] opacity-70 mt-1">{new Date(m.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
            </div>
          ))}
        </div>

        <div className="fixed bottom-0 inset-x-0 p-3 border-t" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
          <div className="max-w-3xl mx-auto space-y-2">
            <div className="flex gap-1 overflow-x-auto">{canned.map((c) => <button key={c} className="pill whitespace-nowrap" onClick={() => setReply((r) => (r ? r + " " : "") + c)}>{c}</button>)}</div>
            <div className="flex gap-2">
              <textarea className="input" rows={2} placeholder="Reply…" value={reply} onChange={(e) => setReply(e.target.value)} />
              <Mic onText={(t) => setReply((r) => (r ? r + " " : "") + t)} />
              <button className="btn btn-primary" disabled={busy || !reply.trim()} onClick={send}>Send</button>
            </div>
            <p className="text-[11px] muted">{staff ? "Your reply is emailed to the buyer right away (or saved for phone-only buyers; tap Text) and shows in their account." : "Your reply goes to the buyer right away. Contact details stay private both ways; phone numbers and emails typed here are removed. Sales go through checkout so you're guaranteed payment."}</p>
          </div>
        </div>
      </div>
    );
  }

  const unread = convos.filter((c) => (staff ? c.unread_for_staff : c.unread_for_seller)).length;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Inbox</h1><p className="muted text-sm">{unread ? `${unread} unread` : "All caught up"}{!staff && " • messages about your items"}</p></div>
        <div className="flex gap-1">
          <Link href="/app/inbox" className={`pill px-3 py-2 ${!showAll ? "pill-active" : ""}`}>Open</Link>
          <Link href="/app/inbox?show=all" className={`pill px-3 py-2 ${showAll ? "pill-active" : ""}`}>All</Link>
          {staff && <Link href="/app/subscribers" className="pill px-3 py-2">📧 List</Link>}
        </div>
      </div>
      {!convos.length && <div className="card p-6 text-center muted text-sm">No messages yet. Every item page has a &quot;Message about this&quot; button; they land here.</div>}
      {convos.map((c) => {
        const photo = c.items?.item_photos?.find((p) => p.is_primary) || c.items?.item_photos?.[0];
        return (
          <Link key={c.id} href={`/app/inbox?c=${c.id}${showAll ? "&show=all" : ""}`} className="card p-3 flex gap-3 items-center" style={(staff ? c.unread_for_staff : c.unread_for_seller) ? { borderColor: "var(--accent)" } : undefined}>
            <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0" style={{ background: "var(--line)" }}>{photo && <img src={photo.url} alt="" className="w-full h-full object-cover" />}</div>
            <div className="min-w-0 flex-1">
              <p className={`truncate ${(staff ? c.unread_for_staff : c.unread_for_seller) ? "font-bold" : "font-semibold"}`}>{c.buyer_name || "Buyer"}</p>
              <p className="text-sm muted truncate">{c.items?.title || c.subject || "General question"}</p>
            </div>
            <div className="text-right shrink-0 text-xs muted">
              <p>{when(c.last_message_at)}</p>
              <span className={`pill ${c.status === "answered" ? "pill-active" : c.status === "closed" ? "pill-sold" : "pill-draft"}`}>{c.status}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
