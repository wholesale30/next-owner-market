import { createClient, getProfile } from "@/lib/supabase/server";
import ItemForm from "../ItemForm";

export const metadata = { title: "Add item" };

export default async function NewItemPage({ searchParams }: PageProps<"/app/items/new">) {
  const { bin } = (await searchParams) as { bin?: string };
  const supabase = await createClient();
  const profile = (await getProfile())!;
  const [{ data: categories }, { data: locations }, { data: biz }] = await Promise.all([
    supabase.from("categories").select("id, name, parent_id, slug, sort_order").order("sort_order"),
    supabase.from("locations").select("id, code, kind, description, sorted").order("code"),
    supabase.from("settings").select("value").eq("key", "business").maybeSingle(),
  ]);
  const photoBg = (biz?.value as { photo_bg?: string })?.photo_bg || "#ffffff";
  return (
    <ItemForm
      mode="new"
      profile={profile}
      categories={categories || []}
      locations={locations || []}
      defaultLocationId={bin}
      photoBg={photoBg}
    />
  );
}
