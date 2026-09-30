"use client";

import { useEffect, useState } from "react";

export default function SafeSpots({ zip }: { zip: string }) {
  const [spots, setSpots] = useState<{ name: string; miles: number; maps: string }[] | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/safe-spots?zip=${zip}`).then((r) => r.json()).then((j) => live && setSpots(j.spots || [])).catch(() => live && setSpots([]));
    return () => { live = false; };
  }, [zip]);
  if (!spots || !spots.length) return null;
  return (
    <details className="card p-3 text-sm">
      <summary className="font-semibold cursor-pointer">🛡 Safe places to meet near the seller</summary>
      <p className="text-xs muted mt-1">Police stations nearby. Many have a marked Safe Exchange Zone in the parking lot with cameras. Daylight, public, bring a friend.</p>
      <ul className="mt-2 space-y-1">
        {spots.map((s) => <li key={s.maps}><a className="underline" href={s.maps} target="_blank" rel="noreferrer">{s.name}</a> <span className="muted">· {s.miles} mi</span></li>)}
      </ul>
    </details>
  );
}
