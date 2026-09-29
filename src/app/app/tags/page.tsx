import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import { money } from "@/lib/listing";
import { CONDITION_LABELS, type Item } from "@/lib/types";
import TagSheet from "../items/[id]/tag/TagSheet";

export const metadata = { title: "Print tags" };

export default async function TagsPage({ searchParams }: PageProps<"/app/tags">) {
  const me = (await getProfile())!;
  if (me.role !== "admin" && me.role !== "staff") redirect("/app");
  const { ids, size } = (await searchParams) as { ids?: string; size?: string };
  const list = (ids || "").split(",").filter(Boolean);
  const supabase = await createClient();
  const [{ data: items }, { data: biz }] = await Promise.all([
    supabase.from("items").select("*, locations(code), categories(name)").in("id", list),
    supabase.from("settings").select("value").eq("key", "business").maybeSingle(),
  ]);
  const base = process.env.NEXT_PUBLIC_SITE_URL || "";
  const businessName = (biz?.value as { name?: string })?.name || "Next Owner Market";
  return (
    <TagSheet
      size={size === "large" ? "large" : size === "small" ? "small" : "medium"}
      tags={((items as unknown as Item[]) || []).map((it) => ({
        sku: it.sku, url: `${base}/item/${it.sku}`, title: it.title, price: money(it.price),
        condition: it.condition ? CONDITION_LABELS[it.condition] : "", location: it.locations?.code || "", category: it.categories?.name || "",
        description: it.description, brand: it.brand || "", model: it.model || "", tested: it.tested, serviced: it.serviced, businessName,
      }))}
    />
  );
}
