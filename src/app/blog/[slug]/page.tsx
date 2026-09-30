import Link from "next/link";
import { notFound } from "next/navigation";
import StoreHeader from "../../StoreHeader";
import { createClient } from "@/lib/supabase/server";
import { renderMarkdown } from "@/lib/md";

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: p } = await supabase.from("posts").select("title, excerpt, cover_url").eq("slug", slug).maybeSingle();
  return { title: p?.title || "Blog", description: p?.excerpt || undefined, openGraph: p?.cover_url ? { images: [p.cover_url] } : undefined };
}

export default async function PostPage({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const supabase = await createClient();
  const [{ data: p }, { data: biz }, { data: { user } }] = await Promise.all([
    supabase.from("posts").select("*").eq("slug", slug).maybeSingle(),
    supabase.from("settings").select("value").eq("key", "business").maybeSingle(),
    supabase.auth.getUser(),
  ]);
  if (!p) notFound();
  const business = (biz?.value as { name: string }) || { name: "Next Owner Market" };
  return (
    <div className="flex-1">
      <StoreHeader business={business} signedIn={!!user} />
      <main className="max-w-2xl mx-auto p-4 space-y-4">
        <Link href="/blog" className="text-sm muted">← Blog</Link>
        {p.cover_url && <img src={p.cover_url} alt="" className="w-full rounded-2xl aspect-[2/1] object-cover" />}
        <h1 className="text-3xl font-extrabold leading-tight">{p.title}</h1>
        <p className="text-xs muted">{p.published_at ? new Date(p.published_at).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" }) : "Draft"}</p>
        <article className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(p.body) }} />
        <div className="card p-4 text-center space-y-2">
          <p className="font-semibold">Got stuff to sell?</p>
          <p className="text-sm muted">Upload photos, the AI writes the listing, buyers pay by card.</p>
          <Link href="/pro" className="btn btn-primary">Start selling free</Link>
        </div>
      </main>
    </div>
  );
}
