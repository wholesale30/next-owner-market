import { admin } from "@/lib/stripe";

/**
 * Saved lookups (Oct 2, 2026): every What's it worth, Buy or Pass and Sort the pile answer is kept
 * in the person's "My lookups" until they delete it, so they can check a pallet's worth of things
 * now and list them later. Deleting is a soft delete (recoverable).
 */
export type Tool = "worth" | "buy_or_pass" | "pile" | "find";

export async function saveLookup(p: { id?: string | null; ownerId: string; tool: Tool; title: string; photoUrls: string[]; hints?: string | null; result: unknown; low?: number | null; high?: number | null; refId?: string | null }): Promise<string | null> {
  const d = admin();
  const row = {
    owner_id: p.ownerId, tool: p.tool, title: String(p.title || "").slice(0, 200), photo_urls: (p.photoUrls || []).slice(0, 10),
    hints: p.hints ? String(p.hints).slice(0, 1000) : null, result: p.result ?? {}, value_low: p.low ?? null, value_high: p.high ?? null,
    ref_id: p.refId || null, updated_at: new Date().toISOString(),
  };
  try {
    // update the same saved lookup when it's a fix (by id, or by the scan it came from)
    if (p.id && /^[0-9a-f-]{36}$/.test(p.id)) {
      const { data } = await d.from("lookups").update(row).eq("id", p.id).eq("owner_id", p.ownerId).select("id").maybeSingle();
      if (data) return data.id;
    }
    if (p.refId) {
      const { data } = await d.from("lookups").update(row).eq("ref_id", p.refId).eq("owner_id", p.ownerId).is("deleted_at", null).select("id").maybeSingle();
      if (data) return data.id;
    }
    const { data } = await d.from("lookups").insert(row).select("id").single();
    return data?.id || null;
  } catch {
    return null; // saving must never break the answer
  }
}

export async function getLookup(id: string, ownerId: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data } = await admin().from("lookups").select("*").eq("id", id).eq("owner_id", ownerId).is("deleted_at", null).maybeSingle();
  return data;
}

export async function countLookups(ownerId: string) {
  const { count } = await admin().from("lookups").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).is("deleted_at", null);
  return count || 0;
}
