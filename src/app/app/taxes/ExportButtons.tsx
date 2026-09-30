"use client";
export default function ExportButtons({ year }: { year: number }) {
  return <div className="flex gap-2"><a className="btn btn-secondary flex-1" href={`/api/export?year=${year}`}>Download CSV</a><a className="btn btn-secondary flex-1" href={`/api/export?all=1`}>All sales (CSV)</a></div>;
}
