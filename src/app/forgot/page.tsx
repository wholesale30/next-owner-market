"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await fetch("/api/auth/forgot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    setBusy(false); setDone(true);
  }
  return (
    <main className="flex-1 flex items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-6 space-y-4">
        <h1 className="text-2xl font-bold">Forgot your password?</h1>
        {done ? (
          <p className="text-sm">If that email has an account, a reset link is on its way. Check spam if it&apos;s not there in a minute. The link works for 1 hour.</p>
        ) : (
          <>
            <p className="muted text-sm">Enter the email you signed up with and we&apos;ll send a link to choose a new one.</p>
            <div><label className="label">Email</label><input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
          </>
        )}
        <p className="text-sm muted text-center"><Link href="/login" className="underline">Back to sign in</Link></p>
      </form>
    </main>
  );
}
