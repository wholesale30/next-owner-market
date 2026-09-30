import Link from "next/link";
import StoreHeader from "../StoreHeader";
import { createClient } from "@/lib/supabase/server";
import { BOARDS } from "@/lib/md";

export const metadata = { title: "Community", description: "Resellers helping resellers: finds, what's it worth, questions, tips." };

export default async function CommunityPage({ searchParams }: PageProps<"/community">) {
  const { board } = (await searchParams) as { board?: string };
  const supabase = await createClient();
  let q = supabase.from("threads").select("id, board, title, body, photo_url, reply_count, last_reply_at, pinned, created_at, author_id").eq("hidden", false).order("pinned", { ascending: false }).order("last_reply_at", { ascending: false }).limit(100);
  if (board) q = q.eq("board", board);
  const [{ data: threads }, { data: biz }, { data: { user } }] = await Promise.all([q, supabase.from("settings").select("value").eq("key", "business").maybeSingle(), supabase.auth.getUser()]);
  const business = (biz?.value as { name: string }) || { name: "Next Owner Market" };
  const ids = [...new Set((threads || []).map((t) => t.author_id))];
  const names = new Map<string, string>(ids.length ? ((await supabase.from("seller_public").select("id, display_name").in("id", ids)).data || []).map((p) => [p.id, p.display_name as string]) : []);
  const now = new Date(new Date().toISOString()).getTime();
  const ago = (d: string) => { const m = Math.round((now - new Date(d).getTime()) / 60000); return m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`; };
  return (
    <div className="flex-1">
      <StoreHeader business={business} signedIn={!!user} />
      <main className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div><h1 className="text-2xl font-extrabold">Community</h1><p className="muted text-sm">Resellers helping resellers.</p></div>
          <Link href={user ? "/community/new" : "/signup?buyer=1&next=/community/new"} className="btn btn-primary">+ Post</Link>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          <Link href="/community" className={`pill px-3 py-2 whitespace-nowrap ${!board ? "pill-active" : ""}`}>All</Link>
          {BOARDS.map((b) => <Link key={b.key} href={`/community?board=${b.key}`} className={`pill px-3 py-2 whitespace-nowrap ${board === b.key ? "pill-active" : ""}`}>{b.label}</Link>)}
        </div>
        {board && <p className="text-sm muted">{BOARDS.find((b) => b.key === board)?.blurb}</p>}
        {!threads?.length && <div className="card p-6 text-center space-y-2"><p className="font-semibold">Nothing here yet.</p><p className="muted text-sm">Be the first. Show us what you found this week.</p></div>}
        {threads?.map((t) => {
          return (
            <Link key={t.id} href={`/community/${t.id}`} className="card p-3 flex gap-3">
              {t.photo_url && <img src={t.photo_url} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-tight">{t.pinned ? "📌 " : ""}{t.title}</p>
                <p className="text-sm muted line-clamp-2">{t.body}</p>
                <p className="text-xs muted mt-1">@{names.get(t.author_id) || "member"} · {BOARDS.find((b) => b.key === t.board)?.label} · 💬 {t.reply_count} · {ago(t.last_reply_at)}</p>
              </div>
            </Link>
          );
        })}
        <p className="text-xs muted text-center">Be decent. No contact info, no deals outside the site. Tap ⚑ on anything that&apos;s off and staff will look.</p>
      </main>
    </div>
  );
}
