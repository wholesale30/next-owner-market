import { createClient } from "@/lib/supabase/server";

export type Business = { name: string; tagline?: string; location?: string; address?: string; contact_phone?: string; contact_email?: string };

/** The store's public identity (name, city, phone, email) from settings. Same values everywhere so Google sees one business. */
export async function getBusiness(): Promise<Business> {
  const supabase = await createClient();
  const { data } = await supabase.from("settings").select("value").eq("key", "business").maybeSingle();
  const v = (data?.value as Business) || { name: "Next Owner Market" };
  return { ...v, name: v.name || "Next Owner Market" };
}
