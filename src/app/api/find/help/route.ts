import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { admin } from "@/lib/stripe";
import { alertStaff } from "@/lib/alert";
import { bump, ipKey, nyDay } from "@/lib/caps";
import { FINDER_FEE } from "@/lib/find";

/**
 * "Too hard? Let us find it for you." The request goes on the same Wanted list staff already work
 * (sourcing_requests, kind 'find') with the AI's answer attached, and staff get an instant email/text.
 * Free to ask; the finder's fee (FINDER_FEE) is only owed if we find it and they want it.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const b = (await req.json().catch(() => ({}))) as { query?: string; what_it_is?: string; best_price?: number | null; shop_price_high?: number | null; name?: string; contact?: string; budget?: number | string; notes?: string; install?: boolean; lookup_id?: string };
  const contact = String(b.contact || "").trim().slice(0, 120);
  const what = String(b.what_it_is || b.query || "").trim().slice(0, 300);
  if (!what) return NextResponse.json({ error: "Tell us what you need first." }, { status: 400 });
  const okContact = /\S+@\S+\.\S+/.test(contact) || contact.replace(/\D/g, "").length >= 7;
  if (!okContact) return NextResponse.json({ error: "Add a phone number or email so we can reach you." }, { status: 400 });
  if (!(await bump(`findhelp:ip:${nyDay()}:${ipKey(await headers())}`, 5))) return NextResponse.json({ error: "We've got your requests for today. We'll be in touch." }, { status: 429 });
  const budget = Number(String(b.budget ?? "").replace(/[^\d.]/g, "")) || null;
  const notes = String(b.notes || "").trim().slice(0, 800);
  const d = admin();
  const { error } = await d.from("sourcing_requests").insert({
    requester_id: user?.id || null, name: String(b.name || "").trim().slice(0, 80) || null, contact,
    description: `🔎 FIND IT FOR ME: ${what}${notes ? `\nNotes: ${notes}` : ""}${b.install ? "\nWants help getting it installed too." : ""}`,
    budget_max: budget, will_ship: true, kind: "find",
    details: { query: b.query || null, what_it_is: b.what_it_is || null, best_price_found: b.best_price ?? null, shop_price_high: b.shop_price_high ?? null, install: !!b.install, lookup_id: b.lookup_id || null, fee: FINDER_FEE.text },
  });
  if (error) return NextResponse.json({ error: "Couldn't send that. Try again." }, { status: 500 });
  await alertStaff(`🔎 Find-it-for-me request: ${what.slice(0, 60)}`, `${what}\nBudget: ${budget ? `$${budget}` : "not given"}. Best online price the AI found: ${b.best_price ? `$${b.best_price}` : "none"}.${b.install ? " Wants install help too." : ""}\nReach them: ${contact}${notes ? `\nNotes: ${notes}` : ""}`, "/app/requests").catch(() => false);
  return NextResponse.json({ ok: true });
}
