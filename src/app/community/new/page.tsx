import { redirect } from "next/navigation";
import StoreHeader from "../../StoreHeader";
import { createClient, getProfile } from "@/lib/supabase/server";
import NewThread from "./NewThread";

export const metadata = { title: "New post" };

export default async function NewThreadPage({ searchParams }: PageProps<"/community/new">) {
  const { board } = (await searchParams) as { board?: string };
  const me = await getProfile();
  if (!me) redirect("/signup?buyer=1&next=/community/new");
  const supabase = await createClient();
  const { data: biz } = await supabase.from("settings").select("value").eq("key", "business").maybeSingle();
  const business = (biz?.value as { name: string }) || { name: "Next Owner Market" };
  return (
    <div className="flex-1">
      <StoreHeader business={business} signedIn />
      <main className="max-w-2xl mx-auto p-4 space-y-4">
        <h1 className="text-2xl font-extrabold">New post</h1>
        <NewThread meId={me.id} board={board || "general"} />
      </main>
    </div>
  );
}
