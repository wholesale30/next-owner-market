"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/listing";

interface Offer { id: string; amount: number; counter_amount: number | null; fulfillment: string; status: string; message: string | null; expires_at: string; created_at: string; items: { id: string; sku: string; title: string; price: number; item_photos: { url: string; is_primary: boolean }[] } | null; seller_public: { display_name: string; rating_avg: number | null; rating_count: number; city: string | null; state: string | null } | null }

export default function OffersClient({ offers }: { offers: Offer[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [counter, setCounter] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  async function act(o: Offer, action: "accept" | "decline" | "counter") {
    setBusy(o.id); setErr(null);
    const { error } = await supabase.rpc("respond_offer", { p_offer: o.id, p_action: action, p_counter: action === "counter" ? Number(counter[o.id]) : null });
    setBusy(null);
    if (error) return setErr(error.message.replace(/^.*?: /, ""));
    fetch("/api/offers/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ offerId: o.id, event: action === "accept" ? "accepted" : action === "decline" ? "declined" : "countered" }) }).catch(() => {});
    router.refresh();
  }
  const open = offers.filter((o) => o.status === "pending" && new Date(o.expires_at) > new Date());
  const rest = offers.filter((o) => !open.includes(o));
  const Row = ({ o, live }: { o: Offer; live: boolean }) => {
    const p = o.items?.item_photos?.find((x) => x.is_primary)?.url || o.items?.item_photos?.[0]?.url;
    const b = o.seller_public;
    return (
      <div className="card p-3 space-y-2 text-sm" style={live ? { borderColor: "var(--accent)" } : undefined}>
        <div className="flex gap-3 items-center">
          <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0" style={{ background: "var(--line)" }}>{p && <img src={p} alt="" className="w-full h-full object-cover" />}</div>
          <div className="min-w-0 flex-1">
            <Link href={`/app/items/${o.items?.id}`} className="font-semibold truncate block">{o.items?.title}</Link>
            <p className="muted">Asking {money(o.items?.price || 0)} • {o.fulfillment} • {b?.display_name || "Buyer"}{b?.city ? ` (${b.city}${b.state ? ", " + b.state : ""})` : ""}{b?.rating_count ? ` ★ ${b.rating_avg}` : ""}</p>
          </div>
          <div className="text-right shrink-0"><p className="text-xl font-extrabold">{money(o.amount)}</p><p className="text-xs muted">{live ? `expires ${new Date(o.expires_at).toLocaleString([], { weekday: "short", hour: "numeric" })}` : o.status}{o.counter_amount ? ` • countered ${money(o.counter_amount)}` : ""}</p></div>
        </div>
        {o.message && <p className="muted">&quot;{o.message}&quot;</p>}
        {live && (
          <div className="flex gap-2 flex-wrap">
            <button className="btn btn-primary" disabled={busy === o.id} onClick={() => act(o, "accept")}>Accept {money(o.amount)}</button>
            <button className="btn btn-secondary" disabled={busy === o.id} onClick={() => act(o, "decline")}>Decline</button>
            <div className="flex gap-1 flex-1"><input className="input" type="number" inputMode="decimal" placeholder="Counter $" value={counter[o.id] || ""} onChange={(e) => setCounter({ ...counter, [o.id]: e.target.value })} /><button className="btn btn-secondary" disabled={busy === o.id || !counter[o.id]} onClick={() => act(o, "counter")}>Counter</button></div>
          </div>
        )}
      </div>
    );
  };
  return (
    <div className="space-y-3">
      <div><h1 className="text-2xl font-bold">Offers</h1><p className="muted text-sm">{open.length ? `${open.length} waiting for you` : "No open offers"}. Accepting gives the buyer 48 hours to pay at that price; other offers on the item are declined automatically.</p></div>
      {err && <p className="text-sm" style={{ color: "var(--danger)" }}>{err}</p>}
      {open.map((o) => <Row key={o.id} o={o} live />)}
      {rest.length > 0 && <p className="font-semibold pt-2">Past</p>}
      {rest.map((o) => <Row key={o.id} o={o} live={false} />)}
    </div>
  );
}
