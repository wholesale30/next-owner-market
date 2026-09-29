"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface C { id: string; subject: string | null; status: string; last_message_at: string; items: { sku: string; title: string } | null; messages: { id: string; sender: string; body: string; created_at: string }[] }

export default function MyMessages({ convos }: { convos: C[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  if (!convos.length) return null;

  async function reply(id: string) {
    if (!text.trim()) return;
    setBusy(true);
    const { error } = await createClient().rpc("reply_conversation", { p_conversation_id: id, p_body: text });
    setBusy(false);
    if (error) return alert(error.message);
    setText("");
    router.refresh();
  }

  return (
    <section className="space-y-2">
      <h2 className="font-semibold">My messages</h2>
      {convos.map((c) => {
        const msgs = [...c.messages].sort((a, b) => a.created_at.localeCompare(b.created_at));
        const last = msgs[msgs.length - 1];
        const isOpen = open === c.id;
        return (
          <div key={c.id} className="card p-3 text-sm space-y-2">
            <button className="w-full text-left" onClick={() => setOpen(isOpen ? null : c.id)}>
              <p className="font-semibold">{c.items ? c.items.title : c.subject || "Message"}</p>
              <p className="muted truncate">{last ? `${last.sender === "staff" ? "Seller: " : "You: "}${last.body}` : ""}</p>
            </button>
            {isOpen && (
              <div className="space-y-2">
                {msgs.map((m) => (
                  <div key={m.id} className={`max-w-[85%] p-2 rounded-xl ${m.sender === "buyer" ? "ml-auto" : ""}`} style={{ background: m.sender === "buyer" ? "var(--brand)" : "var(--bg)", color: m.sender === "buyer" ? "var(--brand-ink)" : "var(--ink)" }}>
                    <p className="whitespace-pre-wrap">{m.body}</p>
                  </div>
                ))}
                {c.items && <Link href={`/item/${c.items.sku}`} className="text-xs underline">View item</Link>}
                <div className="flex gap-2">
                  <input className="input" placeholder="Reply…" value={text} onChange={(e) => setText(e.target.value)} />
                  <button className="btn btn-primary" disabled={busy} onClick={() => reply(c.id)}>Send</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
