import { createHash } from "crypto";
import { admin } from "@/lib/stripe";

export const nyDay = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

/** Count one more against `key` (a settings row); returns the new count, or 0 when it's already at `max`. */
export async function bump(key: string, max: number) {
  const d = admin();
  const { data } = await d.from("settings").select("value").eq("key", key).maybeSingle();
  const n = Number((data?.value as { n?: number } | null)?.n || 0);
  if (n >= max) return 0;
  await d.from("settings").upsert({ key, value: { n: n + 1 } });
  return n + 1;
}

/** A short private fingerprint of the visitor's IP (never stored raw). */
export function ipKey(h: Headers) {
  const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  return createHash("sha256").update(ip + (process.env.SUPABASE_SERVICE_ROLE_KEY || "").slice(0, 8)).digest("hex").slice(0, 16);
}
