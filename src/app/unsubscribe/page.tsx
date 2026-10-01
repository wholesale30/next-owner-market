import { createClient as createAdmin } from "@supabase/supabase-js";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import OptOutButton from "./OptOutButton";

export const metadata = { title: "Unsubscribe" };

export default async function Unsubscribe({ searchParams }: PageProps<"/unsubscribe">) {
  const { t } = (await searchParams) as { t?: string };
  let ok = false;
  if (t) {
    const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data } = await admin.from("subscribers").update({ unsubscribed: true }).eq("unsub_token", t).select("id");
    ok = !!data?.length;
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <main className="flex-1 flex items-center justify-center p-4">
      <div className="card p-6 max-w-sm text-center space-y-3">
        {t ? (
          <><h1 className="text-xl font-bold">{ok ? "You're unsubscribed." : "Link not recognized."}</h1><p className="muted text-sm">{ok ? "No more new-arrivals emails. Order and pickup messages still come through." : "If you keep getting emails, sign in below and turn them off, or reply to one and we'll remove you by hand."}</p></>
        ) : (
          <><h1 className="text-xl font-bold">Email settings</h1><p className="muted text-sm">Turn off tips, nudges, and milestone emails. Messages about your orders, pickups, and payments always come through.</p></>
        )}
        {user ? <OptOutButton /> : <Link href="/login?next=/unsubscribe" className="btn btn-primary">Sign in to turn off emails</Link>}
        <Link href="/" className="btn btn-secondary">Back to the store</Link>
      </div>
    </main>
  );
}
