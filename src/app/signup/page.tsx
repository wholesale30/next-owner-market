"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.full_name, phone: form.phone, role: "consignor" } },
    });
    setBusy(false);
    if (error) return setError(error.message);
    setDone(true);
  }

  if (done)
    return (
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="card w-full max-w-sm p-6 space-y-3 text-center">
          <h1 className="text-xl font-bold">You&apos;re in.</h1>
          <p className="muted text-sm">Check your email to confirm your account (if asked), then sign in. We approve every new consignor before their items go live, so you may see &quot;pending approval&quot; at first.</p>
          <Link href="/login" className="btn btn-primary w-full">Sign in</Link>
        </div>
      </main>
    );

  return (
    <main className="flex-1 flex items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Sell with us</h1>
          <p className="muted text-sm">Create a consignor account. You list, we sell, you get paid.</p>
        </div>
        <div><label className="label">Your name</label><input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></div>
        <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
        <div><label className="label">Phone</label><input className="input" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div><label className="label">Password</label><input className="input" type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></div>
        {error && <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
        <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
        <p className="text-sm muted text-center">Already have one? <Link href="/login" className="underline">Sign in</Link></p>
      </form>
    </main>
  );
}
