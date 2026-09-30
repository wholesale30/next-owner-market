import { NextResponse } from "next/server";
import { admin } from "@/lib/stripe";

/** GET ?u=name → { ok, reason } */
export async function GET(req: Request) {
  const u = (new URL(req.url).searchParams.get("u") || "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_]{2,19}$/.test(u)) return NextResponse.json({ ok: false, reason: "3–20 letters, numbers, or _ (no spaces)." });
  const { data } = await admin().rpc("username_available", { p_name: u });
  return NextResponse.json({ ok: !!data, reason: data ? "" : "That one's taken." });
}
