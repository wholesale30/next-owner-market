import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/listing";
import { CONDITION_LABELS, type Item } from "@/lib/types";
import TagSheet from "./TagSheet";

export const metadata = { title: "Print tag" };

export default async function TagPage({ params, searchParams }: PageProps<"/app/items/[id]/tag">) {
  const { id } = await params;
  const { size } = (await searchParams) as { size?: string };
  const supabase = await createClient();
  const [{ data: item }, { data: biz }] = await Promise.all([
    supabase.from("items").select("*, locations(code), categories(name)").eq("id", id).single(),
    supabase.from("settings").select("value").eq("key", "business").maybeSingle(),
  ]);
  if (!item) notFound();
  const it = item as unknown as Item;
  const base = process.env.NEXT_PUBLIC_SITE_URL || "";
  const url = `${base}/item/${it.sku}`;
  const businessName = (biz?.value as { name?: string })?.name || "Next Owner Market";

  return (
    <TagSheet
      size={size === "large" ? "large" : size === "small" ? "small" : "medium"}
      tag={{
        sku: it.sku,
        url,
        title: it.title,
        price: money(it.price),
        condition: it.condition ? CONDITION_LABELS[it.condition] : "",
        location: it.locations?.code || "",
        category: it.categories?.name || "",
        description: it.description,
        brand: it.brand || "",
        model: it.model || "",
        tested: it.tested,
        serviced: it.serviced,
        businessName,
      }}
    />
  );
}
