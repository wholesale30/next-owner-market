"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/listing";
import type { Order } from "@/lib/types";
import LabelBox from "./LabelBox";
import PickupPicker from "./PickupPicker";

type O = Order & {
  items: { sku: string; title: string; item_photos: { url: string; is_primary: boolean }[] } | null;
  profiles: { role: string; full_name: string | null; business_name: string | null } | null;
  disputes: { status: string; reason: string; resolution_note: string | null }[] | null;
  ratings: { rater_id: string; stars: number }[] | null;
};

const STATUS: Record<string, string> = { pending_payment: "Awaiting payment", paid: "Paid • money held", released: "Complete • seller paid", refunded: "Refunded", disputed: "Problem reported • on hold", cancelled: "Cancelled" };

export default function OrderClient({ order, role, meId, justPaid, business, sellerName, sellerLoc, sellerIsPlatform, buyerName, buyerLoc, buyerContact, bookedSlot }: { order: O; role: "buyer" | "seller" | "staff"; meId: string; justPaid: boolean; business: { name: string; location?: string; address?: string; pickup_hours?: string; contact_phone?: string }; sellerName: string; sellerLoc: string; sellerIsPlatform: boolean; buyerName: string; buyerLoc: string; buyerContact: string | null; bookedSlot: { starts_at: string; ends_at: string } | null }) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [track, setTrack] = useState({ carrier: order.tracking_carrier || "", number: order.tracking_number || "" });
  const [problem, setProblem] = useState("");
  const [showProblem, setShowProblem] = useState(false);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const photo = order.items?.item_photos?.find((p) => p.is_primary)?.url || order.items?.item_photos?.[0]?.url;
  const dispute = order.disputes?.[0];
  const myRating = order.ratings?.find((r) => r.rater_id === meId);
  const isBuyer = role === "buyer";
  const platformSeller = sellerIsPlatform;
  const [msgBusy, setMsgBusy] = useState(false);
  async function suggestTime() {
    setMsgBusy(true);
    const { data: cid, error } = await supabase.rpc("order_conversation", { p_order: order.id });
    if (error || !cid) { setMsgBusy(false); return setErr(error?.message || "Couldn't open messages"); }
    const text = prompt("When can you pick up? (e.g. \"Sat 10–12 or Sun afternoon\")", "Hi! I paid for this. Could I pick it up ");
    if (text && text.trim()) {
      await supabase.rpc("reply_conversation", { p_conversation_id: cid, p_body: text.trim() });
      fetch("/api/messages/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId: cid }) }).catch(() => {});
    }
    setMsgBusy(false);
    router.push("/account#messages");
  }
  async function openThread() {
    setMsgBusy(true);
    const { data: cid, error } = await supabase.rpc("order_conversation", { p_order: order.id });
    setMsgBusy(false);
    if (error || !cid) return setErr(error?.message || "Couldn't open messages");
    router.push(isBuyer ? "/account#messages" : `/app/inbox?c=${cid}`);
  }

  // If they just came back from Stripe and the webhook hasn't landed yet, poll a few times.
  useEffect(() => {
    if (!justPaid || order.status !== "pending_payment") return;
    let n = 0;
    const t = setInterval(() => { n++; router.refresh(); if (n > 10) clearInterval(t); }, 2000);
    return () => clearInterval(t);
  }, [justPaid, order.status, router]);

  async function post(url: string, body: Record<string, unknown>) {
    setBusy(true); setErr(null);
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = (await r.json()) as { error?: string };
    setBusy(false);
    if (!r.ok) return setErr(j.error || "Something went wrong");
    router.refresh();
  }
  async function rate() {
    if (!stars) return;
    const ratee = isBuyer ? order.seller_id : order.buyer_id;
    const { error } = await supabase.from("ratings").insert({ order_id: order.id, rater_id: meId, ratee_id: ratee, stars, comment: comment || null });
    if (error) return setErr(error.message);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="card p-3 flex gap-3 items-center">
        <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0" style={{ background: "var(--line)" }}>{photo && <img src={photo} alt="" className="w-full h-full object-cover" />}</div>
        <div className="min-w-0 flex-1">
          <Link href={`/item/${order.items?.sku}`} className="font-semibold truncate block">{order.items?.title}</Link>
          <p className="text-sm">{money(order.total)}{order.shipping > 0 ? ` (incl. ${money(order.shipping)} shipping)` : ""} • {order.fulfillment === "ship" ? "Shipping" : "Local pickup"}</p>
          <p className="text-sm font-semibold">{STATUS[order.status]}</p>
        </div>
      </div>

      <div className="card p-3 text-sm space-y-1">
        {isBuyer ? (
          <p><b>Seller:</b> {sellerName}{sellerLoc ? ` • ${sellerLoc}` : ""}</p>
        ) : (
          <p><b>Buyer:</b> {buyerName}{buyerLoc ? ` • ${buyerLoc}` : ""}{buyerContact ? ` • ${buyerContact}` : ""}</p>
        )}
        {order.fulfillment === "pickup" && (
          platformSeller ? (
            <p><b>Pickup:</b> {order.status === "paid" || order.status === "released" ? (business.address || business.location || "Warehouse") : (business.location || "Warehouse")}{business.pickup_hours ? ` • ${business.pickup_hours}` : ""}{business.contact_phone && order.status === "paid" ? ` • ${business.contact_phone}` : ""}</p>
          ) : (
            <p><b>Pickup:</b> {sellerLoc || "seller's area"} • {isBuyer ? "The seller will message you the exact spot and time." : "Message the buyer with the spot and time."}</p>
          )
        )}
        {order.status !== "pending_payment" && <button className="btn btn-secondary w-full" disabled={msgBusy} onClick={openThread}>💬 {isBuyer ? "Message the seller" : "Message the buyer"}</button>}
      </div>

      {order.status === "pending_payment" && <div className="card p-4 text-sm">{justPaid ? "Confirming your payment…" : "Payment wasn't completed. Go back to the item to try again."}</div>}

      {order.status === "paid" && order.fulfillment === "pickup" && isBuyer && (
        <div className="card p-4 space-y-2 text-center">
          <p className="text-sm muted">Show this code at pickup. The seller enters it and your payment is released.</p>
          <p className="text-4xl font-extrabold tracking-[.3em]">{order.pickup_code}</p>
          <p className="text-xs muted">Don&apos;t share this code until you have the item in hand. Not picked up within 7 days = automatic refund.</p>
        </div>
      )}
      {order.status === "paid" && order.fulfillment === "pickup" && isBuyer && platformSeller && <PickupPicker orderId={order.id} booked={bookedSlot} />}
      {order.status === "paid" && order.fulfillment === "pickup" && isBuyer && !platformSeller && (
        <div className="card p-3 text-sm space-y-2">
          <p className="font-semibold">📅 Set up the pickup with the seller</p>
          <p className="muted">Suggest a couple of times that work for you; the seller answers in the same thread and you both get each message by email.</p>
          <button className="btn btn-primary w-full" disabled={msgBusy} onClick={() => suggestTime()}>Suggest a time</button>
        </div>
      )}
      {order.status === "paid" && order.fulfillment === "pickup" && !isBuyer && bookedSlot && <p className="card p-3 text-sm">📅 Buyer booked pickup: {new Date(bookedSlot.starts_at).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>}

      {order.status === "paid" && order.fulfillment === "pickup" && !isBuyer && (
        <div className="card p-4 space-y-2">
          <p className="text-sm font-semibold">Handing it over? Enter the buyer&apos;s 6-digit code to get paid.</p>
          <div className="flex gap-2">
            <input className="input text-2xl tracking-[.3em] text-center" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" />
            <button className="btn btn-primary" disabled={busy || code.length !== 6} onClick={() => post("/api/orders/release", { orderId: order.id, code })}>Release</button>
          </div>
          <p className="text-xs muted">You get {money(order.seller_due)} in your bank within 2 business days.</p>
        </div>
      )}

      {order.status === "paid" && order.fulfillment === "ship" && (
        <div className="card p-4 space-y-2 text-sm">
          {order.tracking_number ? (
            <p><b>Shipped</b> • {order.tracking_carrier} {order.tracking_number}{order.delivered_at ? ` • delivered ${new Date(order.delivered_at).toLocaleDateString()}` : ""}</p>
          ) : (
            <p className="muted">{isBuyer ? "Waiting for the seller to ship." : "Ship it and add tracking below."}</p>
          )}
          {!isBuyer && order.shipping_address?.address && (
            <p className="card p-2"><b>Ship to:</b><br />{order.shipping_address.name}<br />{order.shipping_address.address.line1}{order.shipping_address.address.line2 ? `, ${order.shipping_address.address.line2}` : ""}<br />{order.shipping_address.address.city}, {order.shipping_address.address.state} {order.shipping_address.address.postal_code}</p>
          )}
          {!isBuyer && !order.label_url && <LabelBox orderId={order.id} onDone={() => router.refresh()} />}
          {order.label_url && !isBuyer && <p><a className="btn btn-primary" href={order.label_url} target="_blank" rel="noreferrer">🖨 Print label (4×6 PDF)</a> <span className="muted text-xs">Label cost {money(order.label_cost || 0)} comes out of your payout.</span></p>}
          {order.tracking_url && <p><a className="underline" href={order.tracking_url} target="_blank" rel="noreferrer">Track package</a></p>}
          {!isBuyer && (
            <div className="flex gap-2 flex-wrap">
              <input className="input flex-1" placeholder="Carrier (USPS, UPS…)" value={track.carrier} onChange={(e) => setTrack({ ...track, carrier: e.target.value })} />
              <input className="input flex-1" placeholder="Tracking number" value={track.number} onChange={(e) => setTrack({ ...track, number: e.target.value })} />
              <button className="btn btn-secondary" disabled={busy || !track.number} onClick={() => post("/api/orders/ship", { orderId: order.id, carrier: track.carrier, number: track.number })}>Save tracking</button>
              {order.tracking_number && !order.delivered_at && <button className="btn btn-secondary" disabled={busy} onClick={() => post("/api/orders/ship", { orderId: order.id, delivered: true })}>Mark delivered</button>}
            </div>
          )}
          {isBuyer && order.tracking_number && <button className="btn btn-primary w-full" disabled={busy} onClick={() => post("/api/orders/delivered", { orderId: order.id })}>✅ I received it, release payment</button>}
          {order.release_after && <p className="text-xs muted">Payment releases automatically on {new Date(order.release_after).toLocaleDateString()} unless a problem is reported.</p>}
        </div>
      )}

      {order.status === "paid" && (
        <div className="flex gap-2 flex-wrap">
          {!order.shipped_at && <button className="btn btn-secondary" disabled={busy} onClick={() => { if (confirm("Cancel this order and refund the buyer in full?")) post("/api/orders/refund", { orderId: order.id }); }}>Cancel & refund</button>}
          <button className="btn btn-secondary" onClick={() => setShowProblem(!showProblem)}>⚠ Report a problem</button>
        </div>
      )}
      {showProblem && order.status === "paid" && (
        <div className="card p-3 space-y-2">
          <textarea className="input" rows={3} placeholder="What went wrong? Be specific; staff will read this." value={problem} onChange={(e) => setProblem(e.target.value)} />
          <button className="btn btn-primary" disabled={busy || !problem.trim()} onClick={() => post("/api/orders/dispute", { orderId: order.id, reason: problem })}>Send to staff</button>
          <p className="text-xs muted">The money stays on hold until staff decide. Most problems are sorted in a day.</p>
        </div>
      )}

      {dispute && (
        <div className="card p-3 text-sm space-y-1">
          <p className="font-semibold">Problem report: {dispute.status.replace("_", " ")}</p>
          <p>{dispute.reason}</p>
          {dispute.resolution_note && <p className="muted">Staff: {dispute.resolution_note}</p>}
        </div>
      )}

      {order.status === "released" && !myRating && role !== "staff" && (
        <div className="card p-3 space-y-2">
          <p className="font-semibold text-sm">How did it go with the {isBuyer ? "seller" : "buyer"}?</p>
          <div className="flex gap-1 text-3xl">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => setStars(n)} aria-label={`${n} stars`}>{n <= stars ? "★" : "☆"}</button>)}</div>
          <input className="input" placeholder="Optional comment" value={comment} onChange={(e) => setComment(e.target.value)} />
          <button className="btn btn-primary" disabled={!stars} onClick={rate}>Submit rating</button>
        </div>
      )}
      {myRating && <p className="text-sm muted">You rated this {myRating.stars}★. Thanks.</p>}

      {err && <p className="text-sm" style={{ color: "var(--danger)" }}>{err}</p>}
      <p className="text-[11px] muted">Order {order.id.slice(0, 8)} • {new Date(order.created_at).toLocaleString()}</p>
    </div>
  );
}
