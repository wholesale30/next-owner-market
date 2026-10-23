import { NextResponse } from "next/server";
import { gunzipSync } from "node:zlib";
import { createDecipheriv } from "node:crypto";
import { admin } from "@/lib/stripe";

export const maxDuration = 60;

/**
 * GET ?key=…&file=data/…enc&owner=<uuid> — loads an encrypted Facebook listings file from the repo into
 * fb_import_queue (Oct 23, 2026). The file is AES-encrypted in the public repo; the key lives only in settings
 * "import:run" (blob_key), so nobody can read it from GitHub. Skips ads already queued or already brought in.
 */
export async function GET(req: Request) {
  const db = admin();
  const sp = new URL(req.url).searchParams;
  const { data: k } = await db.from("settings").select("value").eq("key", "import:run").maybeSingle();
  const v = (k?.value || {}) as { key?: string; blob_key?: string };
  if (!v.key || sp.get("key") !== v.key || !v.blob_key) return NextResponse.json({ error: "no" }, { status: 403 });
  const file = sp.get("file") || "";
  const owner = sp.get("owner") || "";
  if (!/^data\/[\w.-]+\.enc$/.test(file) || !/^[0-9a-f-]{36}$/.test(owner)) return NextResponse.json({ error: "bad args" }, { status: 400 });
  const r = await fetch(`https://raw.githubusercontent.com/wholesale30/next-owner-market/main/${file}`, { cache: "no-store" });
  if (!r.ok) return NextResponse.json({ error: `file ${r.status}` }, { status: 502 });
  const blob = (await r.json()) as { iv: string; tag: string; data: string };
  const d = createDecipheriv("aes-256-gcm", Buffer.from(v.blob_key, "hex"), Buffer.from(blob.iv, "base64"));
  d.setAuthTag(Buffer.from(blob.tag, "base64"));
  const ads = JSON.parse(gunzipSync(Buffer.concat([d.update(Buffer.from(blob.data, "base64")), d.final()])).toString("utf8")) as { listing_url?: string }[];
  const [{ data: queued }, { data: items }] = await Promise.all([
    db.from("fb_import_queue").select("data").limit(5000),
    db.from("items").select("fb_old_url").not("fb_old_url", "is", null).limit(5000),
  ]);
  const have = new Set([...(queued || []).map((q) => String((q.data as { listing_url?: string })?.listing_url || "")), ...(items || []).map((i) => i.fb_old_url as string)]);
  const fresh = ads.filter((a) => !a.listing_url || !have.has(a.listing_url));
  for (let i = 0; i < fresh.length; i += 50) {
    const { error } = await db.from("fb_import_queue").insert(fresh.slice(i, i + 50).map((data) => ({ owner_id: owner, data })));
    if (error) return NextResponse.json({ error: error.message, loaded: i }, { status: 500 });
  }
  return NextResponse.json({ in_file: ads.length, queued: fresh.length });
}
