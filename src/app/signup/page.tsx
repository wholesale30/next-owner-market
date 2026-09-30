"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const buyer = params.get("buyer") === "1";
  const next = params.get("next") || "";
  const ref = params.get("ref") || "";
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.email, password: form.password, full_name: form.full_name, phone: form.phone, role: buyer ? "buyer" : "consignor", ref }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) { setBusy(false); return setError(json.error || "Could not create account."); }
    // Account is created and confirmed; sign in right away.
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
    setBusy(false);
    if (error) { setDone(true); return; }
    router.push(next || (buyer ? "/account" : "/app"));
    router.refresh();
  }

  if (done)
    return (
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="card w-full max-w-sm p-6 space-y-3 text-center">
          <h1 className="text-xl font-bold">You&apos;re in.</h1>
          <p className="muted text-sm">{buyer ? "Sign in to save items and set up alerts." : "Your account is ready; sign in below. We approve every new consignor before their items go live, so you may see \"pending approval\" at first."}</p>
          <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="btn btn-primary w-full">Sign in</Link>
        </div>
      </main>
    );

  return (
    <main className="flex-1 flex items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">{buyer ? "Create a free account" : "Sell with us"}</h1>
          <p className="muted text-sm">{buyer ? "Save items, bid in auctions, and get alerts when what you want shows up." : "Create a consignor account. You list, we sell, you get paid."}</p>
        </div>
        <div><label className="label">Your name</label><input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></div>
        <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
        <div><label className="label">Phone</label><input className="input" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div><label className="label">Password</label><input className="input" type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></div>
        {error && <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
        <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
        <p className="text-sm muted text-center">Already have one? <Link href="/login" className="underline">Sign in</Link></p>
        <p className="text-xs muted text-center">{buyer ? <Link href="/signup" className="underline">Want to sell with us instead?</Link> : <Link href="/signup?buyer=1" className="underline">Just want to buy? Create a buyer account.</Link>}</p>
      </form>
    </main>
  );
}

export default function SignupPage() {
  return <Suspense><SignupForm /></Suspense>;
}
