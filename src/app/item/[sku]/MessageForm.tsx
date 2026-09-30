"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** "Message about this item". Needs a free account; the message goes out under the account's own email, so both sides know who they're dealing with. */
export default function MessageForm({ itemId, title, sku, signedIn, accountEmail }: { itemId: string; title: string; sku: string; signedIn: boolean; accountEmail?: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const { data: cid, error } = await createClient().rpc("start_conversation", { p_item_id: itemId, p_name: null, p_contact: null, p_body: body });
    if (!error && cid) fetch("/api/messages/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId: cid }) }).catch(() => {});
    setBusy(false);
    if (error) return setErr(error.message.replace(/^.*?: /, ""));
    setDone(true);
  }

  const quick = ["Is this still available?", "What's your best price?", "Can I see more photos?", "Does it work? Been tested?", "When can I pick it up?"];

  if (!open) return <button className="btn btn-primary flex-1" onClick={() => (signedIn ? setOpen(true) : router.push(`/signup?buyer=1&next=/item/${sku}`))}>💬 Message about this</button>;

  return (
    <form onSubmit={send} className="card p-3 space-y-2 text-sm w-full">
      {done ? (
        <div className="space-y-1">
          <p className="font-semibold">Sent.</p>
          <p className="muted">Replies come to {accountEmail || "your account"} and show under My account → Messages.</p>
        </div>
      ) : (
        <>
          <p className="font-semibold">Message about &quot;{title}&quot;</p>
          <div className="flex gap-1 flex-wrap">{quick.map((q) => <button key={q} type="button" className="pill" onClick={() => setBody((b) => (b ? b + " " + q : q))}>{q}</button>)}</div>
          <textarea className="input" rows={3} placeholder="Your message" value={body} onChange={(e) => setBody(e.target.value)} required />
          <p className="text-[11px] muted">Sent from {accountEmail || "your account"}. Phone numbers and emails typed here are removed; pay through checkout so you&apos;re protected.</p>
          {err && <p style={{ color: "var(--danger)" }}>{err}</p>}
          <div className="flex gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary flex-1" disabled={busy}>{busy ? "Sending…" : "Send message"}</button>
          </div>
        </>
      )}
    </form>
  );
}
