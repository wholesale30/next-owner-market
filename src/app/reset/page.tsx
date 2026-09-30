"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("t") || "";
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw !== pw2) return setErr("Passwords don't match.");
    setBusy(true); setErr(null);
    const r = await fetch("/api/auth/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password: pw }) });
    const j = (await r.json()) as { error?: string; email?: string };
    if (!r.ok) { setBusy(false); return setErr(j.error || "Failed"); }
    if (j.email) {
      const { error } = await createClient().auth.signInWithPassword({ email: j.email, password: pw });
      if (!error) { router.push("/account"); router.refresh(); return; }
    }
    router.push("/login");
  }
  return (
    <main className="flex-1 flex items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-6 space-y-4">
        <h1 className="text-2xl font-bold">Choose a new password</h1>
        <div><label className="label">New password</label><input className="input" type="password" minLength={8} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required /></div>
        <div><label className="label">Again</label><input className="input" type="password" minLength={8} autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} required /></div>
        {err && <p className="text-sm" style={{ color: "var(--danger)" }}>{err}</p>}
        <button className="btn btn-primary w-full" disabled={busy || !token}>{busy ? "Saving…" : "Save and sign in"}</button>
      </form>
    </main>
  );
}
export default function ResetPage() { return <Suspense><ResetForm /></Suspense>; }
