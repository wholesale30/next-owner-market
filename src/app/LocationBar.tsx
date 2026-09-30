"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STATES } from "@/lib/geo";

const RADII = [["25", "25 mi"], ["50", "50 mi"], ["100", "100 mi"], ["250", "250 mi"], ["any", "Anywhere"]];

export default function LocationBar({ zip, state, mi, here, params }: { zip: string; state: string; mi: string; here: string | null; params: Record<string, string> }) {
  const router = useRouter();
  const [z, setZ] = useState(zip);
  const [st, setSt] = useState(state);
  const [open, setOpen] = useState(false);
  const go = (extra: Record<string, string>) => {
    const o: Record<string, string> = {};
    for (const [k, v] of Object.entries({ ...params, zip: z, state: st, mi, ...extra })) if (v) o[k] = v;
    if (o.sort === "near" && !o.zip) delete o.sort;
    router.push(`/?${new URLSearchParams(o).toString()}`);
  };
  const label = here ? `📍 Near ${here} · ${mi === "any" ? "anywhere" : `${mi} mi`}` : state ? `📍 ${state} only` : "📍 Set your location";
  return (
    <div className="card p-2 text-sm space-y-2">
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="font-semibold" onClick={() => setOpen(!open)}>{label} {open ? "▴" : "▾"}</button>
        {(zip || state) && <button type="button" className="pill" onClick={() => { setZ(""); setSt(""); go({ zip: "", state: "", mi: "", sort: "" }); }}>Clear</button>}
      </div>
      {open && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input className="input" inputMode="numeric" maxLength={5} placeholder="ZIP code" value={z} onChange={(e) => setZ(e.target.value)} />
            <select className="input w-24" value={st} onChange={(e) => setSt(e.target.value)}><option value="">State</option>{STATES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
            <button type="button" className="btn btn-primary" onClick={() => go({ sort: z ? "near" : params.sort })}>Go</button>
          </div>
          <div className="flex gap-1 overflow-x-auto">{RADII.map(([k, l]) => <button key={k} type="button" className={`pill whitespace-nowrap ${mi === k ? "pill-active" : ""}`} onClick={() => go({ mi: k })}>{l}</button>)}</div>
          <p className="text-[11px] muted">Items that ship are shown from anywhere. Pickup-only items show only within your distance. Add a ZIP to your profile and the store opens on what&apos;s near you.</p>
        </div>
      )}
    </div>
  );
}
