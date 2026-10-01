"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
export default function OptOutButton() {
  const [done, setDone] = useState<string | null>(null);
  async function go(off: boolean) {
    const sb = createClient(); const { data: { user } } = await sb.auth.getUser(); if (!user) return;
    await sb.from("profiles").update({ marketing_opt_out: off }).eq("id", user.id);
    setDone(off ? "Done. No more tips or nudges." : "Turned back on.");
  }
  return <div className="space-y-2">{done ? <p className="text-sm">{done}</p> : <button className="btn btn-primary w-full" onClick={() => go(true)}>Turn off tips & nudges</button>}{done && <button className="text-xs underline muted" onClick={() => go(false)}>Turn them back on</button>}</div>;
}
