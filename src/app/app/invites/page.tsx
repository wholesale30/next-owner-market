import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import InvitesClient from "./InvitesClient";

export const metadata = { title: "Free Pro invites" };

export default async function InvitesPage() {
  const me = await getProfile();
  if (!me || (me.role !== "admin" && me.role !== "staff")) redirect("/app");
  const supabase = await createClient();
  const { data: invites } = await supabase.from("invites").select("*").order("created_at", { ascending: false });
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://nextownermarket.com";
  return <InvitesClient invites={invites || []} site={site} meId={me.id} />;
}
