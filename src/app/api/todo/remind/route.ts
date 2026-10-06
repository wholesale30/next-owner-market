import { NextResponse } from "next/server";
import { admin } from "@/lib/stripe";
import { runAutomations } from "@/lib/automations";

/**
 * The owner's to-do list by email and text at 11 AM and 5 PM Eastern (asked for Oct 5, 2026).
 * Called by the database's scheduler (pg_cron) at :00, :20 and :40 of 15, 16, 21 and 22 UTC, so it lands on 11 and 5 in
 * both summer and winter time; only calls that fall in the 11 or 5 o'clock hour in New York count, and a slot sends once
 * (the :20 and :40 calls are retries in case :00 failed).
 * The key lives in settings "todo:remind" (readable by staff only).
 */
export const maxDuration = 60;
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key") || "";
  const db = admin();
  const { data } = await db.from("settings").select("value").eq("key", "todo:remind").maybeSingle();
  const v = (data?.value as { key?: string; last_slot?: string }) || {};
  if (!key || key !== v.key) return NextResponse.json({ error: "not allowed" }, { status: 403 });
  const now = new Date();
  const hour = Number(now.toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }));
  if (hour !== 11 && hour !== 17) return NextResponse.json({ skipped: `it's ${hour}:00 in New York` });
  const slot = `${now.toLocaleDateString("en-CA", { timeZone: "America/New_York" })} ${hour}`;
  if (v.last_slot === slot) return NextResponse.json({ skipped: "already sent this slot" });
  await db.from("settings").update({ value: { ...v, last_slot: slot } }).eq("key", "todo:remind");
  const ran = await runAutomations("todo_reminders");
  // If it didn't go out, release the slot so the retry call 20 minutes later can send it (pattern from the political posting app).
  const r = ran.todo_reminders as { sent?: unknown; error?: unknown } | undefined;
  if (!r || r.error || r.sent === false) await db.from("settings").update({ value: { ...v, last_slot: v.last_slot || null } }).eq("key", "todo:remind");
  return NextResponse.json({ slot, ran });
}
