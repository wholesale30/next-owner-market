import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import StoreHeader from "../../../StoreHeader";
import OrderClient from "./OrderClient";

export const metadata = { title: "Your order" };

export default async function OrderPage({ params, searchParams }: PageProps<"/account/orders/[id]">) {
  const { id } = await params;
  const { paid } = (await searchParams) as { paid?: string };
  const me = await getProfile();
  if (!me) redirect(`/login?next=/account/orders/${id}`);
  const supabase = await createClient();
  const [{ data: order }, { data: biz }] = await Promise.all([
    supabase.from("orders").select("*, items(sku, title, item_photos(url, is_primary)), disputes(status, reason, resolution_note, opened_by), ratings(rater_id, stars)").eq("id", id).maybeSingle(),
    supabase.from("settings").select("value").eq("key", "business").maybeSingle(),
  ]);
  if (!order) notFound();
  const business = (biz?.value as { name: string; location?: string; address?: string; pickup_hours?: string; contact_phone?: string }) || { name: "Next Owner Market" };
  const role = order.buyer_id === me.id ? "buyer" : order.seller_id === me.id ? "seller" : me.role !== "buyer" ? "staff" : null;
  if (!role) notFound();
  const [{ data: sellerPub }, { data: buyerPub }] = await Promise.all([
    supabase.from("seller_public").select("*").eq("id", order.seller_id).maybeSingle(),
    supabase.from("seller_public").select("id, display_name, city, state, rating_avg, rating_count").eq("id", order.buyer_id).maybeSingle(),
  ]);
  const { data: buyerContact } = role === "staff" ? await supabase.from("profiles").select("email, phone").eq("id", order.buyer_id).maybeSingle() : { data: null };
  const sellerIsPlatform = sellerPub?.role === "admin" || sellerPub?.role === "staff";
  const { data: booked } = await supabase.from("pickups").select("pickup_slots(starts_at, ends_at)").eq("order_id", order.id).in("status", ["requested", "confirmed"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const bookedSlot = (booked?.pickup_slots as unknown as { starts_at: string; ends_at: string } | null) || null;
  const enriched = { ...order, profiles: sellerPub ? { role: sellerPub.role, full_name: sellerPub.display_name, business_name: null } : null };
  return (
    <div className="flex-1">
      <StoreHeader business={business} signedIn />
      <main className="max-w-3xl mx-auto p-4 space-y-4">
        <Link href={role === "buyer" ? "/account" : "/app/orders"} className="text-sm muted">← {role === "buyer" ? "My account" : "Orders"}</Link>
        <OrderClient order={enriched as never} role={role} meId={me.id} justPaid={paid === "1"} business={business} sellerName={sellerIsPlatform ? business.name : sellerPub?.display_name || "Seller"} sellerLoc={sellerIsPlatform ? business.location || "" : [sellerPub?.city, sellerPub?.state].filter(Boolean).join(", ")} sellerIsPlatform={sellerIsPlatform} buyerName={buyerPub?.display_name || "Buyer"} buyerLoc={[buyerPub?.city, buyerPub?.state].filter(Boolean).join(", ")} buyerContact={buyerContact ? buyerContact.email || buyerContact.phone || null : null} bookedSlot={bookedSlot} sellerZip={sellerIsPlatform ? ((business as { zip?: string }).zip || (business.address || "").match(/\b(\d{5})\b/)?.[1] || null) : ((sellerPub as unknown as { zip?: string } | null)?.zip || null)} />
      </main>
    </div>
  );
}
