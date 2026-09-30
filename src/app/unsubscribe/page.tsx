import { createClient as createAdmin } from "@supabase/supabase-js";
import Link from "next/link";

export const metadata = { title: "Unsubscribed" };

export default async function Unsubscribe({ searchParams }: PageProps<"/unsubscribe">) {
  const { t } = (await searchParams) as { t?: string };
  let ok = false;
  if (t) {
    const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data } = await admin.from("subscribers").update({ unsubscribed: true }).eq("unsub_token", t).select("id");
    ok = !!data?.length;
  }
  return (
    <main className="flex-1 flex items-center justify-center p-4">
      <div className="card p-6 max-w-sm text-center space-y-2">
        <h1 className="text-xl font-bold">{ok ? "You're unsubscribed." : "Link not recognized."}</h1>
        <p className="muted text-sm">{ok ? "No more new-arrivals emails. Order and pickup messages still come through." : "If you keep getting emails, reply to one and we'll remove you by hand."}</p>
        <Link href="/" className="btn btn-secondary">Back to the store</Link>
      </div>
    </main>
  );
}
