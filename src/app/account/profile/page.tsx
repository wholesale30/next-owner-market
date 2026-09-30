import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import StoreHeader from "../../StoreHeader";
import ProfileForm from "./ProfileForm";

export const metadata = { title: "My profile" };

export default async function ProfilePage() {
  const me = await getProfile();
  if (!me) redirect("/login?next=/account/profile");
  const supabase = await createClient();
  const { data: biz } = await supabase.from("settings").select("value").eq("key", "business").maybeSingle();
  const business = (biz?.value as { name: string }) || { name: "Next Owner Market" };
  return (
    <div className="flex-1">
      <StoreHeader business={business} signedIn />
      <main className="max-w-3xl mx-auto p-4 space-y-4">
        <Link href="/account" className="text-sm muted">← My account</Link>
        <ProfileForm me={{ username: (me as unknown as { username?: string | null }).username ?? null, sms_gateway: (me as unknown as { sms_gateway?: string | null }).sms_gateway ?? null, alert_messages: (me as unknown as { alert_messages?: boolean }).alert_messages !== false, alert_orders: (me as unknown as { alert_orders?: boolean }).alert_orders !== false, id: me.id, email: me.email, full_name: me.full_name, phone: me.phone, business_name: me.business_name, city: me.city || "", state: me.state || "", zip: me.zip || "", address1: me.address1 || "", address2: me.address2 || "", role: me.role, referral_code: me.referral_code, plan: me.plan || "free", created_at: me.created_at }} />
      </main>
    </div>
  );
}
