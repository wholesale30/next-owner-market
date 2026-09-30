import { NextResponse } from "next/server";
import { quoteShipping } from "@/lib/shipping";
/** GET ?itemId=&zip= → { amount, service, mode } */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const q = await quoteShipping(u.searchParams.get("itemId") || "", u.searchParams.get("zip"));
  if (!q) return NextResponse.json({ error: "This item doesn't ship." }, { status: 400 });
  return NextResponse.json(q);
}
