import type Anthropic from "@anthropic-ai/sdk";
import { admin } from "@/lib/stripe";

/**
 * AI money, in one place.
 *  - logUsage: every AI call writes what it really cost (tokens x price) to ai_usage. Operations adds it up.
 *  - aiImage: the AI reads a smaller copy of each photo (about half the cost per photo); buyers still see the full photo.
 *  - allowanceFor: what someone has left this month, for the meter and friendly limit messages.
 * Prices checked Oct 2, 2026 (platform.claude.com/docs/en/about-claude/pricing). Per million tokens.
 */
const PRICES: { match: RegExp; inp: number; out: number }[] = [
  { match: /haiku/i, inp: 1, out: 5 },
  { match: /opus/i, inp: 5, out: 25 },
  { match: /sonnet/i, inp: 2, out: 10 },
];
export const PRO_USES = 300;
export const POWER_USES = 1000;
export const THRIFT_DAILY = 30;

export function costOf(model: string, u: Partial<Anthropic.Usage> | null | undefined) {
  const p = PRICES.find((x) => x.match.test(model)) || PRICES[2];
  const inp = Number(u?.input_tokens || 0), out = Number(u?.output_tokens || 0);
  const cr = Number(u?.cache_read_input_tokens || 0), cw = Number(u?.cache_creation_input_tokens || 0);
  // web searches (Find it for less) are $10 per 1,000 on top of tokens
  const searches = Number((u as { server_tool_use?: { web_search_requests?: number } } | null | undefined)?.server_tool_use?.web_search_requests || 0);
  return (inp * p.inp + out * p.out + cr * p.inp * 0.1 + cw * p.inp * 1.25) / 1e6 + searches * 0.01;
}

export async function logUsage(ownerId: string | null | undefined, feature: string, model: string, u: Partial<Anthropic.Usage> | null | undefined) {
  if (!u) return;
  try {
    await admin().from("ai_usage").insert({
      owner_id: ownerId && /^[0-9a-f-]{36}$/.test(ownerId) ? ownerId : null, feature, model,
      input_tokens: u.input_tokens || 0, output_tokens: u.output_tokens || 0,
      cache_read_tokens: u.cache_read_input_tokens || 0, cache_write_tokens: u.cache_creation_input_tokens || 0,
      cost_usd: costOf(model, u),
    });
  } catch { /* logging must never break a lookup */ }
}

/** A ~1100px copy of the photo for the AI. Falls back to the URL if anything goes wrong. */
export async function aiImage(url: string): Promise<Anthropic.ImageBlockParam> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(String(r.status));
    const sharp = (await import("sharp")).default;
    const buf = await sharp(Buffer.from(await r.arrayBuffer())).rotate().resize(1100, 1100, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
    return { type: "image", source: { type: "base64", media_type: "image/jpeg", data: buf.toString("base64") } };
  } catch {
    return { type: "image", source: { type: "url", url } };
  }
}
export const aiImages = (urls: string[]) => Promise.all(urls.map(aiImage));

export type Allowance = { kind: "staff" | "comped" | "power" | "pro" | "thrift" | "free"; used: number; allow: number | null; left: number | null; extra: number };

/** What this person has left. allow/left are null for unlimited (staff, comped). */
export function allowanceFor(p: { role?: string | null; plan?: string | null; comped?: boolean | null; power?: boolean | null; thrift_pro?: boolean | null; ai_credits?: number | null; uses_month?: string | null; uses_count?: number | null; uses_day?: string | null; uses_day_count?: number | null; extra_uses?: number | null }): Allowance {
  const extra = Number(p.extra_uses || 0);
  if (p.role === "admin" || p.role === "staff") return { kind: "staff", used: 0, allow: null, left: null, extra };
  if (p.comped) return { kind: "comped", used: 0, allow: null, left: null, extra };
  const month = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }).slice(0, 7);
  const used = p.uses_month === month ? Number(p.uses_count || 0) : 0;
  if (p.plan === "pro") { const allow = p.power ? POWER_USES : PRO_USES; return { kind: p.power ? "power" : "pro", used, allow, left: Math.max(0, allow - used) + extra, extra }; }
  if (p.thrift_pro) {
    const day = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    const today = p.uses_day === day ? Number(p.uses_day_count || 0) : 0;
    return { kind: "thrift", used: today, allow: THRIFT_DAILY, left: Math.max(0, THRIFT_DAILY - today) + extra, extra };
  }
  return { kind: "free", used, allow: null, left: Number(p.ai_credits || 0) + extra, extra };
}

/** Friendly words for when someone runs out (shown with the top-up buttons). */
export function outOfUsesMessage(a: Allowance) {
  if (a.kind === "pro" || a.kind === "power") return `You've used all ${a.allow} AI uses for this month. Nice work! Add more now, or they reset on the 1st.`;
  if (a.kind === "thrift") return `That's ${a.allow} checks today, the most Thrift Pro covers in a day. More tomorrow, or add extra checks now.`;
  return "You've used your free AI lookups. Go Pro for 300 a month, or add a pack of 100.";
}

export const ALLOW_SELECT = "role, plan, comped, power, thrift_pro, ai_credits, uses_month, uses_count, uses_day, uses_day_count, extra_uses";

export async function allowanceOf(id: string) {
  const { data } = await admin().from("profiles").select(ALLOW_SELECT).eq("id", id).maybeSingle();
  return allowanceFor(data || {});
}

export async function refundUse(id: string) {
  await admin().rpc("refund_ai_credit", { p_profile: id }).then(() => {}, () => {});
}

/** One-time packs of extra AI uses. They never expire. */
export const PACKS: Record<string, { uses: number; cents: number }> = { "100": { uses: 100, cents: 699 }, "300": { uses: 300, cents: 1499 } };
