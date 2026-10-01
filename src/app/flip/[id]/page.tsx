import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import StoreHeader from "../../StoreHeader";
import { admin } from "@/lib/stripe";
import { getProfile } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const money = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString()}`;
const V: Record<string, { label: string; color: string }> = { buy: { label: "BUY", color: "var(--ok)" }, maybe: { label: "MAYBE", color: "var(--accent)" }, pass: { label: "PASS", color: "var(--danger)" } };

async function getScan(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data } = await admin().from("buy_pass_scans").select("id, what, paid, resale_low, resale_high, net_low, net_high, verdict, photo_url, created_at").eq("id", id).maybeSingle();
  return data;
}

export async function generateMetadata({ params }: PageProps<"/flip/[id]">): Promise<Metadata> {
  const s = await getScan((await params).id);
  if (!s) return { title: "Buy or pass?" };
  const t = s.paid ? `Paid ${money(s.paid)}, sells for ${money(s.resale_low)}–${money(s.resale_high)}` : `${s.what}: sells for ${money(s.resale_low)}–${money(s.resale_high)}`;
  return { title: `${String(s.verdict).toUpperCase()}: ${s.what}`, description: `${t}. Checked free with Buy or Pass. Check your own thrift find in 10 seconds.`, robots: { index: false } };
}

/** A shared "look what I found" card. Every share is an invitation to try it free. */
export default async function FlipPage({ params, searchParams }: PageProps<"/flip/[id]">) {
  const [{ id }, sp, me] = await Promise.all([params, searchParams, getProfile()]);
  const s = await getScan(id);
  if (!s) notFound();
  const ref = typeof sp.ref === "string" ? sp.ref.replace(/[^a-z0-9_-]/gi, "").slice(0, 32) : "";
  const v = V[s.verdict] || V.maybe;
  return (
    <div className="flex-1">
      <StoreHeader business={{ name: "Next Owner Market" }} signedIn={!!me} />
      <main className="max-w-md mx-auto p-4 space-y-4">
        <div className="card p-5 text-center space-y-2" style={{ borderColor: v.color, borderWidth: 3 }}>
          <p className="text-sm muted">Someone checked this thrift find</p>
          {s.photo_url && <img src={s.photo_url} alt="" className="mx-auto h-48 w-48 object-cover rounded-2xl" />}
          <p className="font-bold text-lg">{s.what}</p>
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div><p className="text-xs muted">Paid</p><p className="text-xl font-extrabold">{s.paid ? money(s.paid) : "?"}</p></div>
            <div><p className="text-xs muted">Sells for</p><p className="text-xl font-extrabold">{money(s.resale_low)}–{money(s.resale_high)}</p></div>
            <div><p className="text-xs muted">Keeps</p><p className="text-xl font-extrabold" style={{ color: v.color }}>{money(s.net_high)}</p></div>
          </div>
          <p className="text-6xl font-extrabold" style={{ color: v.color }}>{v.label}</p>
        </div>
        <div className="card p-4 text-center space-y-3">
          <p className="font-bold text-xl">What&apos;s your find worth?</p>
          <p className="text-sm muted">One photo plus the price on the tag. You get what it sells for, the fees, your profit, and a straight answer. Free, no app, no account.</p>
          <Link href={ref ? `/buy-or-pass?ref=${ref}` : "/buy-or-pass"} className="btn btn-primary w-full text-lg" style={{ minHeight: 56 }}>📸 Check my find free</Link>
        </div>
        <p className="text-xs muted text-center">Estimates, not guarantees. Not affiliated with any thrift store.</p>
      </main>
    </div>
  );
}
