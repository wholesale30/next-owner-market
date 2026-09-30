import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import PrintButton from "./PrintButton";

export const metadata = { title: "Bill of sale" };

type Party = { full_name: string | null; business_name?: string | null; address1: string | null; address2: string | null; city: string | null; state: string | null; zip: string | null; email: string | null; phone: string | null };

export default async function BillOfSale({ params }: PageProps<"/account/orders/[id]/bill-of-sale">) {
  const { id } = await params;
  const me = await getProfile();
  if (!me) redirect(`/login?next=/account/orders/${id}/bill-of-sale`);
  const supabase = await createClient();
  const [{ data, error }, { data: biz }] = await Promise.all([supabase.rpc("bill_of_sale", { p_order: id }), supabase.from("settings").select("value").eq("key", "business").maybeSingle()]);
  if (error || !data) return <main className="p-6 text-center">{error?.message || "Not available."}</main>;
  const d = data as { order: { id: string; amount: number; full_price: number | null; balance_due: number; paid_at: string | null }; buyer: Party; seller: Party; item: { sku: string; title: string; year: number | null; brand: string | null; model: string | null; vin: string | null; mileage: number | null; title_status: string | null } };
  const business = (biz?.value as { name: string }) || { name: "Next Owner Market" };
  const price = Number(d.order.full_price ?? d.order.amount);
  const addr = (p: Party) => [p.address1, p.address2, [p.city, p.state].filter(Boolean).join(", ") + (p.zip ? " " + p.zip : "")].filter(Boolean).join(", ");
  const $ = (n: number) => `$${Number(n).toFixed(2)}`;
  const isVehicle = !!(d.item.vin || d.item.year);
  return (
    <main className="max-w-2xl mx-auto p-6 space-y-5 text-[15px]" style={{ background: "#fff", color: "#000" }}>
      <div className="no-print flex gap-2"><PrintButton /><a href={`/account/orders/${id}`} className="btn btn-secondary">Back to order</a></div>
      <div className="text-center">
        <h1 className="text-2xl font-extrabold">BILL OF SALE</h1>
        <p className="text-sm">Prepared via {business.name} · Order {d.order.id.slice(0, 8).toUpperCase()} · {new Date().toLocaleDateString()}</p>
      </div>
      <section className="grid grid-cols-2 gap-4">
        <div><p className="font-bold uppercase text-xs">Seller</p><p>{d.seller.business_name || d.seller.full_name}</p>{d.seller.business_name && d.seller.full_name && <p>{d.seller.full_name}</p>}<p>{addr(d.seller)}</p><p>{d.seller.phone}</p></div>
        <div><p className="font-bold uppercase text-xs">Buyer</p><p>{d.buyer.full_name}</p><p>{addr(d.buyer)}</p><p>{d.buyer.phone}</p></div>
      </section>
      <section>
        <p className="font-bold uppercase text-xs">Item</p>
        <table className="w-full text-sm"><tbody>
          <tr><td className="py-1 w-40">Description</td><td className="font-semibold">{d.item.title}</td></tr>
          {d.item.year && <tr><td className="py-1">Year</td><td>{d.item.year}</td></tr>}
          {(d.item.brand || d.item.model) && <tr><td className="py-1">Make / Model</td><td>{[d.item.brand, d.item.model].filter(Boolean).join(" ")}</td></tr>}
          {d.item.vin && <tr><td className="py-1">VIN / Hull / Serial</td><td className="font-mono">{d.item.vin}</td></tr>}
          {d.item.mileage != null && <tr><td className="py-1">Odometer / Hours</td><td>{d.item.mileage.toLocaleString()} (seller certifies this is the actual reading unless noted: ____________)</td></tr>}
          {d.item.title_status && <tr><td className="py-1">Title</td><td className="capitalize">{d.item.title_status.replace(/_/g, " ")}</td></tr>}
        </tbody></table>
      </section>
      <section>
        <p className="font-bold uppercase text-xs">Price</p>
        <table className="w-full text-sm"><tbody>
          <tr><td className="py-1 w-40">Sale price</td><td className="font-semibold">{$(price)}</td></tr>
          {d.order.full_price != null && <><tr><td className="py-1">Deposit paid via {business.name}</td><td>{$(d.order.amount)}{d.order.paid_at ? ` on ${new Date(d.order.paid_at).toLocaleDateString()}` : ""}</td></tr><tr><td className="py-1">Balance due at delivery</td><td className="font-semibold">{$(d.order.balance_due)}</td></tr><tr><td className="py-1">Balance paid by</td><td>☐ Cash &nbsp; ☐ Cashier&apos;s check &nbsp; ☐ Other: ____________</td></tr></>}
        </tbody></table>
      </section>
      <section className="text-sm space-y-2">
        <p>The Seller sells and transfers the item described above to the Buyer for the price stated. The Seller certifies that they are the lawful owner, that the item is free of all liens and claims{isVehicle ? ", and that the title will be signed over to the Buyer upon receipt of the full price" : ""}.</p>
        <p><b>The item is sold AS-IS, WHERE-IS, with no warranty of any kind, express or implied.</b> The Buyer has inspected the item and accepts it in its current condition.{isVehicle ? " The Buyer is responsible for registration, taxes, and insurance from the moment of delivery." : ""}</p>
        <p>{business.name} is a marketplace that facilitated this sale and processed the deposit; it is not a party to this agreement.</p>
      </section>
      <section className="grid grid-cols-2 gap-8 pt-6 text-sm">
        <div><div className="border-b border-black h-10"></div><p>Seller signature</p><p className="mt-4 border-b border-black h-6"></p><p>Date</p></div>
        <div><div className="border-b border-black h-10"></div><p>Buyer signature</p><p className="mt-4 border-b border-black h-6"></p><p>Date</p></div>
      </section>
      <p className="text-xs pt-4">Print two copies; each party keeps one. {isVehicle ? "Virginia and most states also require the title itself to be signed by the seller; some require notarization. Check your DMV." : ""}</p>
    </main>
  );
}
