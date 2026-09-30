import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import InboxClient from "./InboxClient";

export const metadata = { title: "Inbox" };

export default async function InboxPage({ searchParams }: PageProps<"/app/inbox">) {
  const me = (await getProfile())!;
  const staff = me.role === "admin" || me.role === "staff";
  if (me.role === "buyer") redirect("/account");
  const { c, show } = (await searchParams) as { c?: string; show?: string };
  const supabase = await createClient();
  let q = supabase.from("conversations").select("*, items(id, sku, title, price, status, item_photos(url, is_primary))").order("last_message_at", { ascending: false }).limit(200);
  if (!staff) q = q.eq("seller_profile_id", me.id);
  if (show !== "all") q = q.neq("status", "closed");
  const { data: convos } = await q;
  const { data: msgs } = c ? await supabase.from("messages").select("*").eq("conversation_id", c).order("created_at") : { data: [] };
  if (c) await supabase.from("conversations").update(staff ? { unread_for_staff: false } : { unread_for_seller: false }).eq("id", c);
  return <InboxClient convos={(convos || []) as never} active={c || null} messages={msgs || []} showAll={show === "all"} staff={staff} />;
}
