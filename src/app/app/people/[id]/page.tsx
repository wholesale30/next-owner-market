import { notFound, redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import PersonForm from "./PersonForm";

export const metadata = { title: "Person" };

export default async function PersonPage({ params }: PageProps<"/app/people/[id]">) {
  const me = (await getProfile())!;
  if (me.role !== "admin" && me.role !== "staff") redirect("/app");
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: p }, { data: items }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).single(),
    supabase.from("items").select("id, sku, title, status, price").eq("owner_id", id).order("created_at", { ascending: false }).limit(50),
  ]);
  if (!p) notFound();
  return <PersonForm person={p} items={items || []} isAdmin={me.role === "admin"} />;
}
