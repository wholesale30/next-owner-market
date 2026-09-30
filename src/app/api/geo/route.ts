import { NextResponse } from "next/server";
import { lookupZip } from "@/lib/geo";
/** GET ?zip=23220 → city/state/lat/lng (public; used by forms to autofill city/state). */
export async function GET(req: Request) {
  const zip = new URL(req.url).searchParams.get("zip") || "";
  const g = lookupZip(zip);
  return NextResponse.json(g ? { ok: true, ...g } : { ok: false });
}
