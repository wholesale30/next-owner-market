import Anthropic from "@anthropic-ai/sdk";
import { logUsage } from "@/lib/usage";

/**
 * Ask the model to answer by calling one tool (so the answer has a fixed shape).
 * Some newer models reject a forced tool_choice with a 400 ("not supported for this model").
 * When that happens we retry with tool_choice "auto" plus a plain instruction to use the tool,
 * and as a last resort read a JSON object out of the text. Returns the tool input.
 */
export async function askWithTool<T = Record<string, unknown>>(client: Anthropic, p: {
  model: string; max_tokens: number; messages: Anthropic.MessageParam[];
  tool: { name: string; description: string; input_schema: Anthropic.Tool.InputSchema };
  log?: { ownerId: string | null; feature: string };
}): Promise<T> {
  const track = async (m: Anthropic.Message) => {
    if (p.log) await logUsage(p.log.ownerId, p.log.feature, p.model, m.usage);
    // tripwire: an answer cut off at the word limit comes back incomplete; record it so the limit gets raised
    if (m.stop_reason === "max_tokens") {
      const { admin } = await import("@/lib/stripe");
      await admin().from("settings").upsert({ key: `err:cutoff:${p.log?.feature || p.tool.name}:${Date.now()}`, value: { feature: p.log?.feature || p.tool.name, max_tokens: p.max_tokens, out: m.usage?.output_tokens } }).then(() => {}, () => {});
    }
  };
  const pick = (m: Anthropic.Message): T | null => {
    const call = m.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === p.tool.name);
    if (call) return call.input as T;
    const text = m.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    const a = text.indexOf("{"), z = text.lastIndexOf("}");
    if (a >= 0 && z > a) { try { return JSON.parse(text.slice(a, z + 1)) as T; } catch { /* fall through */ } }
    return null;
  };
  try {
    const m = await client.messages.create({ model: p.model, max_tokens: p.max_tokens, messages: p.messages, tools: [p.tool], tool_choice: { type: "tool", name: p.tool.name } });
    await track(m);
    const r = pick(m); if (r) return r;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/tool_choice/i.test(msg)) throw e;
  }
  // Retry without forcing: say it plainly.
  const msgs = [...p.messages];
  const last = msgs[msgs.length - 1];
  const nudge = { type: "text" as const, text: `\n\nAnswer ONLY by calling the "${p.tool.name}" tool with every required field filled in. Do not write anything else.` };
  msgs[msgs.length - 1] = { ...last, content: typeof last.content === "string" ? [{ type: "text", text: last.content }, nudge] : [...last.content, nudge] };
  const m2 = await client.messages.create({ model: p.model, max_tokens: p.max_tokens, messages: msgs, tools: [p.tool], tool_choice: { type: "auto" } });
  await track(m2);
  const r2 = pick(m2);
  if (!r2) throw new Error("No structured answer returned");
  return r2;
}

/**
 * Oct 9, 2026: the AI account ran out of prepaid credit and every tool told customers "try a clearer photo."
 * These tell an outage apart from a bad photo: out of credit, bad key, rate limit, overloaded or server errors.
 */
export function aiServiceDown(e: unknown): boolean {
  const status = Number((e as { status?: number } | null)?.status || 0);
  const msg = e instanceof Error ? e.message : String(e);
  return status === 401 || status === 403 || status === 429 || status >= 500 || /credit balance|billing|overloaded|rate.?limit|authentication|api key/i.test(msg);
}
export const AI_DOWN_MESSAGE = "Our AI is taking a short break right now. Nothing was used or charged. Please try again in a little while.";

/** Text and email the owner the first time the AI goes down (at most once an hour). Never throws. */
export async function reportAiDown(e: unknown): Promise<void> {
  try {
    const { admin } = await import("@/lib/stripe");
    const d = admin();
    const key = "err:ai_down:last_alert";
    const { data } = await d.from("settings").select("value").eq("key", key).maybeSingle();
    const last = Number((data?.value as { at?: number } | null)?.at || 0);
    const now = new Date().getTime();
    if (now - last < 3600_000) return;
    await d.from("settings").upsert({ key, value: { at: now } });
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 200);
    const credit = /credit balance|billing/i.test(msg);
    const { alertStaff } = await import("@/lib/alert");
    await alertStaff(credit ? "AI is OFF: out of prepaid credit" : "AI tools are failing",
      credit
        ? "Every AI tool (What's it worth, listings, Sort the pile, Buy or Pass, Help) is stopped until credit is added. Customers see a short-break message and aren't charged. Fix: platform.claude.com, sign in, Settings, Billing, Buy credits. Turn on Auto-reload there so it can't run out again."
        : `The AI service is refusing requests: ${msg}. Customers see a short-break message and aren't charged. Tell Claude.`,
      "/app/ops");
  } catch { /* alerts must never break a request */ }
}
