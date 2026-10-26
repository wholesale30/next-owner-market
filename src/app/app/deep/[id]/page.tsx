import { notFound, redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import type { DeepReport, QA } from "@/lib/deepcheck";
import ReportView from "./ReportView";

export const metadata = { title: "Deep report" };
export const dynamic = "force-dynamic";

export default async function DeepReportPage({ params }: PageProps<"/app/deep/[id]">) {
  const { id } = await params;
  const me = (await getProfile())!;
  if (me.role !== "admin") redirect("/app");
  const supabase = await createClient();
  const { data: row } = await supabase.from("deep_reports").select("id, notes, photo_urls, report, qa, created_at, cost").eq("id", id).maybeSingle();
  if (!row?.report) notFound();
  return <ReportView id={row.id} report={row.report as DeepReport} qa={(row.qa as QA[]) || []} notes={row.notes} photos={row.photo_urls || []} createdAt={row.created_at} cost={Number(row.cost || 0)} />;
}
