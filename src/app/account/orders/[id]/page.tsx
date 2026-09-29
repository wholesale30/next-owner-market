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
    supabase.from("orders").select("*, items(sku, title, item_photos(url, is_primary)), profiles!orders_seller_id_fkey(role, full_name, business_name), disputes(status, reason, resolution_note), ratings(rater_id, stars)").eq("id", id).maybeSingle(),
    supabase.from("settings").select("value").eq("key", "business").maybeSingle(),
  ]);
  if (!order) notFound();
  const business = (biz?.value as { name: string; location?: string; contact_phone?: string }) || { name: "Next Owner Market" };
  const role = order.buyer_id === me.id ? "buyer" : order.seller_id === me.id ? "seller" : me.role !== "buyer" ? "staff" : null;
  if (!role) notFound();
  return (
    <div className="flex-1">
      <StoreHeader business={business} />
      <main className="max-w-3xl mx-auto p-4 space-y-4">
        <Link href={role === "buyer" ? "/account" : "/app/orders"} className="text-sm muted">← {role === "buyer" ? "My account" : "Orders"}</Link>
        <OrderClient order={order as never} role={role} meId={me.id} justPaid={paid === "1"} business={business} />
      </main>
    </div>
  );
}
