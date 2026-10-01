import { NextResponse } from "next/server";
import { getProfile } from "@/lib/supabase/server";
import { listFromScan } from "@/lib/thrift";

/** "I bought it: list it now." */
export async function POST(req: Request) {
  const me = await getProfile();
  if (!me) return NextResponse.json({ error: "Make a free account first.", signup: true }, { status: 401 });
  const { id, photo_urls } = (await req.json()) as { id?: string; photo_urls?: string[] };
  const r = await listFromScan(me, id || "", photo_urls || []);
  if (!r.item_id) return NextResponse.json({ error: r.error }, { status: r.status || 500 });
  return NextResponse.json({ item_id: r.item_id });
}
