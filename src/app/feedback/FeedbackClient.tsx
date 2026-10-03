"use client";

import { useState } from "react";
import Mic from "@/components/Mic";
import { compressImage } from "@/lib/photo";

/** Two big choices, then one box. Type or talk; a screenshot is optional. */
export default function FeedbackClient({ signedIn, startKind, from }: { signedIn: boolean; startKind: "idea" | "problem" | null; from: string }) {
  const [kind, setKind] = useState<"idea" | "problem" | null>(startKind);
  const [text, setText] = useState("");
  const [email, setEmail] = useState("");
  const [shot, setShot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pick(f: File | undefined) {
    if (!f) return;
    const blob = await compressImage(f, 1400, 0.8);
    const r = new FileReader();
    r.onload = () => setShot(String(r.result));
    r.readAsDataURL(blob);
  }
  async function send() {
    setBusy(true); setErr(null);
    const r = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, message: text, page: from || null, email: email || null, image: shot }) });
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    setBusy(false);
    if (!r.ok || !j.ok) return setErr(j.error || "Couldn't send. Try again.");
    setDone(true);
  }

  if (done) return (
    <div className="card p-6 text-center space-y-3" style={{ borderColor: "var(--ok)", borderWidth: 2 }}>
      <p className="text-2xl font-extrabold">🙏 Thank you!</p>
      <p>{kind === "problem" ? "We got it and we'll fix it. Sorry for the trouble." : "We got your idea. The best ones come from people using the site every day."}</p>
      {signedIn && <p className="text-sm muted">You&apos;ll see it below, and when it&apos;s done.</p>}
      <button type="button" className="btn btn-secondary w-full" onClick={() => { setDone(false); setText(""); setShot(null); setKind(null); }}>Send another</button>
    </div>
  );

  if (!kind) return (
    <div className="grid gap-3">
      <button type="button" className="card p-5 text-left" style={{ borderColor: "var(--brand)", borderWidth: 2, minHeight: 88 }} onClick={() => setKind("idea")}>
        <p className="text-xl font-extrabold">💡 Suggest an upgrade</p>
        <p className="text-sm muted">An idea that would make the site better or easier.</p>
      </button>
      <button type="button" className="card p-5 text-left" style={{ borderColor: "var(--danger)", borderWidth: 2, minHeight: 88 }} onClick={() => setKind("problem")}>
        <p className="text-xl font-extrabold">🐞 Something&apos;s not working</p>
        <p className="text-sm muted">A button that does nothing, a wrong number, a page that won&apos;t load.</p>
      </button>
    </div>
  );

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-bold text-lg">{kind === "problem" ? "🐞 What isn't working?" : "💡 What's your idea?"}</p>
        <button type="button" className="text-sm underline" onClick={() => setKind(null)}>Change</button>
      </div>
      <div className="space-y-1">
        <textarea className="input" rows={4} style={{ minHeight: 110, fieldSizing: "content" } as React.CSSProperties} placeholder={kind === "problem" ? "What were you doing, and what happened? (e.g. I tapped List it and nothing happened)" : "What would make it better? (e.g. let me sort my lookups by price)"} value={text} onChange={(e) => setText(e.target.value)} />
        <Mic onText={(t) => setText((x) => (x ? x.trimEnd() + " " : "") + t)} />
      </div>
      <div className="flex items-center gap-2">
        <label className="btn btn-secondary cursor-pointer">📷 Add a screenshot<input type="file" accept="image/*" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} /></label>
        {shot && <><img src={shot} alt="" className="w-12 h-12 rounded object-cover" /><button type="button" className="text-sm underline" onClick={() => setShot(null)}>Remove</button></>}
        {!shot && <span className="text-xs muted">optional</span>}
      </div>
      {!signedIn && <input className="input" type="email" inputMode="email" placeholder="Your email, if you'd like an answer (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />}
      <button type="button" className="btn btn-primary w-full text-lg" style={{ minHeight: 52 }} disabled={busy || text.trim().length < 3} onClick={send}>{busy ? "Sending…" : "Send it"}</button>
      {err && <p className="text-sm text-center" style={{ color: "var(--danger)" }}>{err}</p>}
    </div>
  );
}
