import Link from "next/link";
import { notFound } from "next/navigation";
import StoreHeader from "../../StoreHeader";
import { createClient, getProfile } from "@/lib/supabase/server";
import { BOARDS } from "@/lib/md";
import ThreadClient from "./ThreadClient";

export default async function ThreadPage({ params }: PageProps<"/community/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const me = await getProfile();
  const [{ data: t }, { data: replies }, { data: biz }] = await Promise.all([
    supabase.from("threads").select("*, items(sku, title, price)").eq("id", id).maybeSingle(),
    supabase.from("replies").select("id, body, hidden, created_at, author_id").eq("thread_id", id).order("created_at"),
    supabase.from("settings").select("value").eq("key", "business").maybeSingle(),
  ]);
  if (!t) notFound();
  const business = (biz?.value as { name: string }) || { name: "Next Owner Market" };
  const staff = me?.role === "admin" || me?.role === "staff";
  const ids = [...new Set([t.author_id, ...(replies || []).map((r) => r.author_id)])];
  const names = new Map<string, string>(((await supabase.from("seller_public").select("id, display_name").in("id", ids)).data || []).map((p) => [p.id, p.display_name as string]));
  return (
    <div className="flex-1">
      <StoreHeader business={business} signedIn={!!me} />
      <main className="max-w-2xl mx-auto p-4 space-y-4">
        <Link href={`/community?board=${t.board}`} className="text-sm muted">← {BOARDS.find((b) => b.key === t.board)?.label || "Community"}</Link>
        <ThreadClient
          thread={{ id: t.id, title: t.title, body: t.body, photo_url: t.photo_url, author: names.get(t.author_id) || "member", author_id: t.author_id, created_at: t.created_at, locked: t.locked, hidden: t.hidden, pinned: t.pinned, item: (t.items as unknown as { sku: string; title: string; price: number } | null) }}
          replies={(replies || []).map((r) => ({ id: r.id, body: r.body, hidden: r.hidden, created_at: r.created_at, author_id: r.author_id, author: names.get(r.author_id) || "member" }))}
          meId={me?.id || null} staff={staff} />
      </main>
    </div>
  );
}
