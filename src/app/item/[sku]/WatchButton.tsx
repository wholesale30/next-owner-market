"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Heart/save button + a one-time view ping. */
export default function WatchButton({ itemId, sku, price, signedIn, watching, saves }: { itemId: string; sku: string; price: number | null; signedIn: boolean; watching: boolean; saves: number }) {
  const router = useRouter();
  const [on, setOn] = useState(watching);
  const [n, setN] = useState(saves);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    try {
      const k = `v:${itemId}`;
      if (sessionStorage.getItem(k)) return;
      sessionStorage.setItem(k, "1");
      createClient().rpc("bump_view", { p_item: itemId }).then(() => {}, () => {});
    } catch { /* private mode */ }
  }, [itemId]);
  async function toggle() {
    if (!signedIn) { router.push(`/signup?buyer=1&next=/item/${sku}`); return; }
    setBusy(true);
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { setBusy(false); return; }
    if (on) { await sb.from("favorites").delete().eq("profile_id", user.id).eq("item_id", itemId); setOn(false); setN((x) => Math.max(0, x - 1)); }
    else { await sb.from("favorites").insert({ profile_id: user.id, item_id: itemId }); setOn(true); setN((x) => x + 1); }
    setBusy(false);
  }
  return (
    <button type="button" className={`pill px-3 py-2 ${on ? "pill-active" : ""}`} disabled={busy} onClick={toggle} aria-pressed={on}>
      {on ? "♥ Saved" : "♡ Save"}{n ? ` · ${n}` : ""}
    </button>
  );
}
