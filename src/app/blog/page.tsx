import Link from "next/link";
import StoreHeader from "../StoreHeader";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Blog", description: "Selling tips, what things are worth, and what's new at Next Owner Market." };

export default async function BlogPage() {
  const supabase = await createClient();
  const [{ data: posts }, { data: biz }, { data: { user } }] = await Promise.all([
    supabase.from("posts").select("slug, title, excerpt, cover_url, published_at").not("published_at", "is", null).lte("published_at", new Date().toISOString()).order("published_at", { ascending: false }).limit(50),
    supabase.from("settings").select("value").eq("key", "business").maybeSingle(),
    supabase.auth.getUser(),
  ]);
  const business = (biz?.value as { name: string }) || { name: "Next Owner Market" };
  return (
    <div className="flex-1">
      <StoreHeader business={business} signedIn={!!user} />
      <main className="max-w-2xl mx-auto p-4 space-y-4">
        <div><h1 className="text-2xl font-extrabold">Blog</h1><p className="muted text-sm">Selling tips, what things are worth, and what&apos;s new.</p></div>
        {!posts?.length && <p className="card p-6 text-center muted">First post coming soon.</p>}
        {posts?.map((p) => (
          <Link key={p.slug} href={`/blog/${p.slug}`} className="card overflow-hidden block">
            {p.cover_url && <img src={p.cover_url} alt="" className="w-full aspect-[2/1] object-cover" />}
            <div className="p-4 space-y-1">
              <p className="font-bold text-lg leading-tight">{p.title}</p>
              {p.excerpt && <p className="text-sm muted">{p.excerpt}</p>}
              <p className="text-xs muted">{new Date(p.published_at!).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}</p>
            </div>
          </Link>
        ))}
      </main>
    </div>
  );
}
