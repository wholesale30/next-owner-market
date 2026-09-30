import Link from "next/link";
import StoreHeader from "../StoreHeader";
import { createClient } from "@/lib/supabase/server";
import ToolPitch from "@/components/ToolPitch";

export const metadata = { title: "What things are worth: real valuations from real people's stuff", description: "Thousands of everyday items, valued from photos: stereos, tools, lamps, toys, furniture, collectibles. See what yours might be worth, then check it yourself in 30 seconds." };
export const revalidate = 600;

export default async function ValuedIndex({ searchParams }: PageProps<"/valued">) {
  const { q, page } = (await searchParams) as { q?: string; page?: string };
  const supabase = await createClient();
  const p = Math.max(1, Number(page || 1)); const per = 48;
  let query = supabase.from("valuations").select("slug, title, era, value_low, value_high, photo_url, category, created_at").eq("is_public", true).order("created_at", { ascending: false }).range((p - 1) * per, p * per - 1);
  if (q) query = query.ilike("title", `%${q}%`);
  const [{ data: rows }, { data: biz }, { data: { user } }] = await Promise.all([query, supabase.from("settings").select("value").eq("key", "business").maybeSingle(), supabase.auth.getUser()]);
  const business = (biz?.value as { name: string }) || { name: "Next Owner Market" };
  const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
  return (
    <div className="flex-1">
      <StoreHeader business={business} signedIn={!!user} />
      <main className="max-w-5xl mx-auto p-4 space-y-4">
        <div><h1 className="text-2xl font-extrabold">What things are worth</h1><p className="muted text-sm">Real items, valued from photos by people cleaning out garages, attics, and warehouses. Shared with their OK, no names.</p></div>
        <form className="flex gap-2"><input className="input" name="q" placeholder="Search: receiver, drill, lamp…" defaultValue={q || ""} /><button className="btn btn-primary">Search</button></form>
        {!rows?.length && <p className="card p-6 text-center muted">Nothing here yet. Be the first: <Link href="/worth" className="underline">value something</Link> and tick &quot;share it.&quot;</p>}
        <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {rows?.map((v) => (
            <li key={v.slug}><Link href={`/valued/${v.slug}`} className="card overflow-hidden block h-full">
              <div className="aspect-square flex items-center justify-center text-4xl" style={{ background: "var(--line)" }}>{v.photo_url ? <img src={v.photo_url} alt={v.title} className="w-full h-full object-cover" loading="lazy" /> : "💰"}</div>
              <div className="p-2"><p className="font-bold">{money(v.value_low)}–{money(v.value_high)}</p><p className="text-sm leading-tight line-clamp-2">{v.title}</p>{v.era && <p className="text-xs muted">{v.era}</p>}</div>
            </Link></li>
          ))}
        </ul>
        {rows && rows.length === per && <Link href={`/valued?${q ? `q=${encodeURIComponent(q)}&` : ""}page=${p + 1}`} className="btn btn-secondary w-full">More</Link>}
        <ToolPitch compact />
      </main>
    </div>
  );
}
