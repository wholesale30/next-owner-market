import { notFound } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import ItemForm from "../../ItemForm";

export const metadata = { title: "Edit item" };

export default async function EditItemPage({ params }: PageProps<"/app/items/[id]/edit">) {
  const { id } = await params;
  const supabase = await createClient();
  const profile = (await getProfile())!;
  const [{ data: item }, { data: photos }, { data: categories }, { data: locations }] = await Promise.all([
    supabase.from("items").select("*").eq("id", id).single(),
    supabase.from("item_photos").select("*").eq("item_id", id).order("sort_order"),
    supabase.from("categories").select("id, name, parent_id, slug, sort_order").order("sort_order"),
    supabase.from("locations").select("id, code, kind, description, sorted").order("code"),
  ]);
  if (!item) notFound();
  return <ItemForm mode="edit" profile={profile} categories={categories || []} locations={locations || []} item={item} photos={photos || []} />;
}
