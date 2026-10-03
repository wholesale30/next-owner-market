import StoreHeader from "../StoreHeader";
import { getProfile } from "@/lib/supabase/server";
import { admin } from "@/lib/stripe";
import FeedbackClient from "./FeedbackClient";

export const metadata = { title: "Ideas & problems", description: "Tell us how to make Next Owner Market better, or tell us what isn't working. We read every one." };
export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { new: "📬 Got it", planned: "🛠 We're on it", done: "✅ Done", not_now: "⏸ Not right now" };

export default async function FeedbackPage({ searchParams }: PageProps<"/feedback">) {
  const sp = (await searchParams) as { kind?: string; from?: string };
  const me = await getProfile();
  const { data: mine } = me ? await admin().from("feedback").select("id, kind, message, status, staff_note, created_at").eq("owner_id", me.id).order("created_at", { ascending: false }).limit(50) : { data: [] };
  return (
    <div className="flex-1">
      <StoreHeader business={{ name: "Next Owner Market" }} signedIn={!!me} />
      <main className="max-w-2xl mx-auto p-4 space-y-4">
        <div>
          <h1 className="text-2xl font-extrabold">💡 Ideas &amp; problems</h1>
          <p className="text-sm muted">Got an idea that would make this better? Something not working? Tell us here. The owner reads every one, and you&apos;ll see here when it&apos;s done.</p>
        </div>
        <FeedbackClient signedIn={!!me} startKind={sp.kind === "problem" ? "problem" : sp.kind === "idea" ? "idea" : null} from={typeof sp.from === "string" ? sp.from : ""} />
        {(mine || []).length > 0 && (
          <section className="card p-4 space-y-2">
            <p className="font-bold">What you&apos;ve sent</p>
            {(mine || []).map((f) => (
              <div key={f.id} className="border-t pt-2 text-sm space-y-1" style={{ borderColor: "var(--line)" }}>
                <div className="flex justify-between gap-2"><span>{f.kind === "problem" ? "🐞" : "💡"} {new Date(f.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span><b>{STATUS[f.status] || f.status}</b></div>
                <p className="line-clamp-3">{f.message}</p>
                {f.staff_note && <p className="p-2 rounded-lg" style={{ background: "color-mix(in srgb, var(--brand) 10%, var(--surface))" }}><b>From us:</b> {f.staff_note}</p>}
              </div>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
