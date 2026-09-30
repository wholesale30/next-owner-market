"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function BuyerPanel({ itemId, sku }: { itemId: string; sku: string; title?: string; canPickup?: boolean }) {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [fav, setFav] = useState(false);
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
      if (user) { const { data } = await supabase.from("favorites").select("item_id").eq("item_id", itemId).maybeSingle(); setFav(!!data); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);
  async function toggleFav() {
    if (!userId) { window.location.href = `/login?next=/item/${sku}`; return; }
    if (fav) await supabase.from("favorites").delete().eq("item_id", itemId).eq("profile_id", userId);
    else await supabase.from("favorites").insert({ item_id: itemId, profile_id: userId });
    setFav(!fav);
  }
  return (
    <div className="space-y-2">
      <button className="btn btn-secondary w-full" onClick={toggleFav}>{fav ? "♥ Saved" : "♡ Save for later"}</button>
      {!userId && <p className="text-xs muted text-center"><Link href={`/signup?buyer=1&next=/item/${sku}`} className="underline">Create a free account</Link> to buy, message, save items, and get alerts.</p>}
    </div>
  );
}
