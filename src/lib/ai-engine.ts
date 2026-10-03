import Anthropic from "@anthropic-ai/sdk";
import { admin } from "@/lib/stripe";
import { askWithTool } from "@/lib/ai-tool";
import { aiImages, allowanceOf, outOfUsesMessage, refundUse } from "@/lib/usage";

/**
 * One place for "photos in, structured answer out":
 *  - charges one AI use (spend_ai_credit: Pro 300/month, Power 1,000, Thrift Pro 30/day, staff and comped free), gives it back if the call fails
 *  - the AI reads a smaller copy of each photo; every call's real cost is logged to ai_usage
 *  - forces a tool call so the answer always has the schema's shape (no JSON parsing)
 *  - logs failures to settings as err:<name>:<ts>
 */
export const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";

export type EngineResult<T> = { ok: true; result: T } | { ok: false; error: string; upgrade?: boolean; topup?: boolean; status: number };

export async function runVision<T>(opts: {
  name: string;                       // tool name + log key
  userId: string;
  photoUrls: string[];
  prompt: string;
  schema: Record<string, unknown>;
  maxPhotos?: number;
  maxTokens?: number;
  charge?: boolean;                   // default true
}): Promise<EngineResult<T>> {
  const db = admin();
  if (opts.charge !== false) {
    const { data: ok } = await db.rpc("spend_ai_credit", { p_profile: opts.userId });
    if (!ok) return { ok: false, error: outOfUsesMessage(await allowanceOf(opts.userId)), upgrade: true, topup: true, status: 402 };
  }
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: "Not available right now.", status: 500 };
  const photos = (opts.photoUrls || []).slice(0, opts.maxPhotos ?? 6);
  if (!photos.length) return { ok: false, error: "Add at least one photo.", status: 400 };
  const client = new Anthropic();
  const content: Anthropic.MessageParam["content"] = [
    ...(await aiImages(photos)),
    { type: "text", text: opts.prompt },
  ];
  try {
    const result = await askWithTool<T>(client, { model: MODEL, max_tokens: opts.maxTokens ?? 2500, messages: [{ role: "user", content }], tool: { name: opts.name, description: "Record the answer.", input_schema: opts.schema as unknown as Anthropic.Tool.InputSchema }, log: { ownerId: opts.userId, feature: opts.name } });
    return { ok: true, result };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.from("settings").upsert({ key: `err:${opts.name}:${Date.now()}`, value: { message, photos: photos.slice(0, 3), user: opts.userId } }).then(() => {}, () => {});
    if (opts.charge !== false) await refundUse(opts.userId);
    return { ok: false, error: "Couldn't read that one. Try a clearer photo of the whole item, or add a note about what it is.", status: 500 };
  }
}

/** Marketplace fee models used by Buy or Pass. One place to update. Verified Sept 2026; re-check quarterly. */
export const FEES: { key: string; label: string; pct: number; fixed: number; note: string }[] = [
  { key: "ebay", label: "eBay", pct: 13.6, fixed: 0.30, note: "most categories; on item + shipping" },
  { key: "mercari", label: "Mercari", pct: 10, fixed: 0, note: "plus payment processing about 2.9% + 50¢" },
  { key: "poshmark", label: "Poshmark", pct: 20, fixed: 0, note: "flat $2.95 under $15" },
  { key: "facebook", label: "Facebook Marketplace (local)", pct: 0, fixed: 0, note: "free for local pickup" },
  { key: "nom", label: "Next Owner Market", pct: 15, fixed: 0, note: "sale price only, shipping not included" },
];
