import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import TodoClient, { type Todo } from "./TodoClient";

export const metadata = { title: "To-do" };
export const revalidate = 0;

export default async function TodoPage() {
  const me = await getProfile();
  if (!me || (me.role !== "admin" && me.role !== "staff")) redirect("/app");
  const supabase = await createClient();
  const { data } = await supabase.from("todos").select("id, title, notes, priority, due_date, remind, done_at, snooze_until, created_at").order("created_at", { ascending: false }).limit(500);
  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl font-bold">📝 To-do</h1>
        <p className="text-sm muted">Your assistant&apos;s list. Add anything here (or tell Claude). You get a reminder every Monday, and again when something is coming due.</p>
      </div>
      <TodoClient initial={(data || []) as Todo[]} meId={me.id} />
    </div>
  );
}
