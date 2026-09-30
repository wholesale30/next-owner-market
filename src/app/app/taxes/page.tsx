import { createClient, getProfile } from "@/lib/supabase/server";
import { money } from "@/lib/listing";
import { HelpTip } from "@/components/Help";
import ExportButtons from "./ExportButtons";

export const metadata = { title: "Year summary" };

export default async function TaxesPage() {
  const me = (await getProfile())!;
  const supabase = await createClient();
  const { data: rows } = await supabase.from("tax_year_summary").select("*").eq("owner_id", me.id).order("year", { ascending: false });
  const years = (rows || []) as { year: number; sales_count: number; gross_sales: number; shipping_collected: number; platform_fees: number; commissions: number; shipping_paid: number; cost_of_goods: number }[];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">Year summary <HelpTip topic="taxes" /></h1>
      <p className="text-sm muted">Your sales, costs, and fees for each year, from your records here. Hand it to whoever does your taxes. <b>This is a summary, not tax advice, and we don&apos;t file anything.</b></p>
      {!years.length && <p className="card p-6 text-center muted">No completed sales yet. This fills in as you sell.</p>}
      {years.map((y) => {
        const net = Number(y.gross_sales) + Number(y.shipping_collected) - Number(y.platform_fees) - Number(y.commissions) - Number(y.shipping_paid) - Number(y.cost_of_goods);
        return (
          <div key={y.year} className="card p-4 space-y-2">
            <div className="flex items-center justify-between"><p className="font-bold text-lg">{y.year}</p><span className="pill">{y.sales_count} sales</span></div>
            <table className="w-full text-sm"><tbody>
              <tr><td>Sales (item prices)</td><td className="text-right font-semibold">{money(y.gross_sales)}</td></tr>
              <tr><td>Shipping collected from buyers</td><td className="text-right">{money(y.shipping_collected)}</td></tr>
              <tr className="muted"><td>Platform & payment fees</td><td className="text-right">−{money(y.platform_fees)}</td></tr>
              <tr className="muted"><td>Commissions</td><td className="text-right">−{money(y.commissions)}</td></tr>
              <tr className="muted"><td>Shipping labels you paid</td><td className="text-right">−{money(y.shipping_paid)}</td></tr>
              <tr className="muted"><td>What you paid for the items (cost)</td><td className="text-right">−{money(y.cost_of_goods)}</td></tr>
              <tr className="border-t" style={{ borderColor: "var(--line)" }}><td className="pt-1 font-bold">Net before other expenses</td><td className="pt-1 text-right font-bold">{money(net)}</td></tr>
            </tbody></table>
            <ExportButtons year={y.year} />
          </div>
        );
      })}
      <div className="card p-4 text-sm space-y-2">
        <p className="font-semibold">Plain English, no advice</p>
        <p>If you sell things for more than you paid, that profit is generally taxable income, whether or not any marketplace sends you a form. Selling your own used stuff for less than you paid is generally not income. Keep receipts for what you paid, mileage to sales, packing supplies, and fees; those usually count against the income. Whether you get a 1099-K from a marketplace depends on that year&apos;s federal threshold and your state; not getting one doesn&apos;t change what&apos;s taxable.</p>
        <p className="muted">We don&apos;t prepare or file returns and can&apos;t tell you what you owe. Take this summary to a tax preparer, or the IRS free-file tools. Cost of goods only counts here if you entered a cost on the item.</p>
      </div>
    </div>
  );
}
