import { redirect } from "next/navigation";
import { getProfile } from "@/lib/supabase/server";
import { admin } from "@/lib/stripe";
import FeedbackAdmin, { type FRow } from "./FeedbackAdmin";

export const metadata = { title: "Ideas & problems" };
export const dynamic = "force-dynamic";

export default async function FeedbackAdminPage() {
  const me = await getProfile();
  if (!me || (me.role !== "admin" && me.role !== "staff")) redirect("/app");
  const { data } = await admin().from("feedback").select("id, kind, message, page, email, photo_url, status, staff_note, created_at, owner_id").order("created_at", { ascending: false }).limit(500);
  const ids = [...new Set((data || []).map((f) => f.owner_id).filter(Boolean))] as string[];
  const { data: people } = ids.length ? await admin().from("profiles").select("id, full_name, username").in("id", ids) : { data: [] };
  const name = new Map((people || []).map((p) => [p.id, p.full_name || p.username]));
  const rows: FRow[] = (data || []).map((f) => ({ ...f, who: f.owner_id ? name.get(f.owner_id) || "a member" : f.email || "not signed in" }));
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">💡 Ideas &amp; problems</h1>
        <p className="text-sm muted">What people sent from the 💡 Ideas &amp; problems page. You get an alert for each one. Mark it so they see where it stands; a note is shown to them.</p>
      </div>
      <FeedbackAdmin rows={rows} />
    </div>
  );
}
