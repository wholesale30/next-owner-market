"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** One button that does the right thing: not signed in → seller sign-up; buyer → become a seller; seller → their listings. */
export default function StartSelling({ signedIn, role, className = "btn btn-primary", label = "Start selling free" }: { signedIn: boolean; role: string | null; className?: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function go() {
    if (!signedIn) return router.push("/signup?next=/app");
    if (role && role !== "buyer") return router.push("/app");
    setBusy(true);
    const r = await fetch("/api/become-seller", { method: "POST" });
    setBusy(false);
    if (!r.ok) { const j = await r.json().catch(() => ({})); alert(j.error || "Couldn't switch your account. Message us."); return; }
    router.push("/app");
    router.refresh();
  }
  return <button type="button" className={className} disabled={busy} onClick={go}>{busy ? "One sec…" : label}</button>;
}
