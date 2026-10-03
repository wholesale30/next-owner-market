import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/supabase/server";
import { admin } from "@/lib/stripe";
import { allowanceFor, ALLOW_SELECT } from "@/lib/usage";

export const metadata = { title: "AI spending" };
export const dynamic = "force-dynamic";

const FEATURE: Record<string, string> = {
  worth: "What's it worth?", worth_fix: "What's it worth? fixes", buy_or_pass: "Buy or Pass", sort_pile: "Sort the pile", listing: "AI-written listings",
  snap_sort: "Snap mode sorting", weight_guess: "Weight guesses", help_question: "Help questions", try_demo: "Try-it demo (signed out)", weekly_blog: "Weekly blog post",
};
const sinceDays = (n: number) => new Date(Date.now() - n * 86400_000).toISOString();
const usd = (n: number) => `$${n < 1 ? n.toFixed(3) : n.toFixed(2)}`;

/** Every AI dollar, by feature and by person. Tap a person to see each of their AI calls. */
export default async function AiSpendPage({ searchParams }: PageProps<"/app/ops/ai">) {
  const me = await getProfile();
  if (!me || (me.role !== "admin" && me.role !== "staff")) redirect("/app");
  const sp = (await searchParams) as { member?: string; days?: string };
  const days = [1, 7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const since = sinceDays(days);
  const d = admin();
  let q = d.from("ai_usage").select("owner_id, feature, model, input_tokens, output_tokens, cost_usd, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(20000);
  if (sp.member && /^[0-9a-f-]{36}$/.test(sp.member)) q = q.eq("owner_id", sp.member);
  const { data: rows } = await q;
  const all = rows || [];
  const total = all.reduce((a, r) => a + Number(r.cost_usd), 0);
  const byF = new Map<string, { n: number; c: number }>();
  const byM = new Map<string, { n: number; c: number }>();
  for (const r of all) {
    const f = byF.get(r.feature) || { n: 0, c: 0 }; f.n++; f.c += Number(r.cost_usd); byF.set(r.feature, f);
    const k = r.owner_id || "none"; const m = byM.get(k) || { n: 0, c: 0 }; m.n++; m.c += Number(r.cost_usd); byM.set(k, m);
  }
  const ids = [...byM.keys()].filter((k) => k !== "none");
  const { data: people } = ids.length ? await d.from("profiles").select(`id, full_name, username, email, ${ALLOW_SELECT}`).in("id", ids) : { data: [] };
  const who = new Map((people || []).map((p) => [p.id, p]));
  const member = sp.member ? who.get(sp.member) : null;
  const plan = (p: Parameters<typeof allowanceFor>[0]) => { const a = allowanceFor(p); return a.kind === "pro" ? "Pro $15" : a.kind === "power" ? "Power $39" : a.kind === "thrift" ? "Thrift Pro $3.99" : a.kind === "free" ? "Free" : a.kind === "comped" ? "Free Pro (comped)" : "Staff"; };
  const pay: Record<string, number> = { "Pro $15": 15, "Power $39": 39, "Thrift Pro $3.99": 3.99 };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm"><Link href="/app/ops" className="underline">← Operations</Link></p>
        <h1 className="text-2xl font-bold">🤖 AI spending</h1>
        <p className="text-sm muted">What the AI really cost us, from the bill for every call (tokens × price). One AI use is usually 1–5¢. If anyone passes $10 in a month you get an alert.</p>
      </div>
      <div className="flex gap-1">{[1, 7, 30, 90].map((n) => <Link key={n} href={`/app/ops/ai?days=${n}${sp.member ? `&member=${sp.member}` : ""}`} className={`pill px-3 py-2 ${n === days ? "pill-active" : ""}`}>{n === 1 ? "Today" : `${n} days`}</Link>)}</div>

      <div className="card p-4 text-center">
        <p className="text-xs muted uppercase tracking-wide">{member ? `${member.full_name || member.username || member.email}, ` : ""}last {days === 1 ? "24 hours" : `${days} days`}</p>
        <p className="text-4xl font-extrabold">{usd(total)}</p>
        <p className="text-sm muted">{all.length.toLocaleString()} AI calls · about {usd(all.length ? total / all.length : 0)} each</p>
        {member && <p className="text-sm pt-1">Plan: <b>{plan(member)}</b>{pay[plan(member)] ? <> · pays {usd(pay[plan(member)])}/mo</> : null} · <Link href="/app/ops/ai" className="underline">everyone</Link></p>}
      </div>

      <section className="card p-4 space-y-1">
        <p className="font-bold">By feature</p>
        {[...byF.entries()].sort((a, b) => b[1].c - a[1].c).map(([k, v]) => (
          <div key={k} className="flex justify-between text-sm border-t pt-1" style={{ borderColor: "var(--line)" }}><span>{FEATURE[k] || k}</span><span><b>{usd(v.c)}</b> <span className="muted">· {v.n} calls · {usd(v.c / v.n)} each</span></span></div>
        ))}
        {!byF.size && <p className="text-sm muted">No AI calls in this window yet. (Logging started Oct 2, 2026.)</p>}
      </section>

      {!member && (
        <section className="card p-4 space-y-1">
          <p className="font-bold">By person <span className="muted font-normal text-sm">· tap to see their calls</span></p>
          {[...byM.entries()].sort((a, b) => b[1].c - a[1].c).slice(0, 200).map(([k, v]) => {
            const p = who.get(k);
            const pl = p ? plan(p) : "Signed out";
            const over = days >= 30 && pay[pl] && v.c > pay[pl] * 0.6;
            return (
              <div key={k} className="flex justify-between gap-2 text-sm border-t pt-1" style={{ borderColor: "var(--line)" }}>
                <span className="min-w-0 truncate">{p ? <Link href={`/app/ops/ai?member=${k}&days=${days}`} className="underline">{p.full_name || p.username || p.email}</Link> : "Signed-out visitors"} <span className="muted">· {pl}</span></span>
                <span className="whitespace-nowrap" style={over ? { color: "var(--danger)" } : {}}><b>{usd(v.c)}</b> <span className="muted">· {v.n}</span>{over ? " ⚠" : ""}</span>
              </div>
            );
          })}
          <p className="text-xs muted pt-1">⚠ = costing more than 60% of what they pay. Red means look closer; it&apos;s fine for one busy month.</p>
        </section>
      )}

      {member && (
        <section className="card p-4 space-y-1">
          <p className="font-bold">Every call</p>
          {all.slice(0, 300).map((r, i) => (
            <div key={i} className="flex justify-between text-xs border-t pt-1" style={{ borderColor: "var(--line)" }}><span>{new Date(r.created_at).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {FEATURE[r.feature] || r.feature}</span><span>{usd(Number(r.cost_usd))} <span className="muted">({r.input_tokens.toLocaleString()} in / {r.output_tokens.toLocaleString()} out)</span></span></div>
          ))}
        </section>
      )}
    </div>
  );
}
