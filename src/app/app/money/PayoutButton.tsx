"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function PayoutButton({ consignorId, amount, saleIds }: { consignorId: string; amount: number; saleIds: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function pay() {
    const method = prompt(`Record a payout of $${amount.toFixed(2)}. How did you pay? (cash, zelle, check…)`, "cash");
    if (method === null) return;
    setBusy(true);
    const supabase = createClient();
    const { data: payout, error } = await supabase.from("payouts").insert({ consignor_id: consignorId, amount, status: "paid", method, paid_at: new Date().toISOString() }).select("id").single();
    if (error) { alert(error.message); setBusy(false); return; }
    await supabase.from("payout_sales").insert(saleIds.map((sale_id) => ({ payout_id: payout.id, sale_id })));
    setBusy(false);
    router.refresh();
  }
  return <button className="pill pill-active mt-1" disabled={busy} onClick={pay}>{busy ? "…" : "Mark paid"}</button>;
}
