import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import PostEditor from "./PostEditor";

export default async function EditPost({ params }: PageProps<"/app/blog/[id]">) {
  const { id } = await params;
  const me = await getProfile();
  if (!me || (me.role !== "admin" && me.role !== "staff")) redirect("/app");
  const supabase = await createClient();
  const { data: p } = id === "new" ? { data: null } : await supabase.from("posts").select("*").eq("id", id).maybeSingle();
  return <PostEditor post={p ? { id: p.id, slug: p.slug, title: p.title, excerpt: p.excerpt || "", body: p.body, cover_url: p.cover_url || "", published: !!p.published_at } : null} meId={me.id} />;
}
