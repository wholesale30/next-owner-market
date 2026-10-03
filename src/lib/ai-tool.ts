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
  const track = (m: Anthropic.Message) => { if (p.log) void logUsage(p.log.ownerId, p.log.feature, p.model, m.usage); };
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
    track(m);
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
  track(m2);
  const r2 = pick(m2);
  if (!r2) throw new Error("No structured answer returned");
  return r2;
}
