"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { TOPICS, hintFor } from "@/lib/help";

/** A "?" that opens a short plain-English answer in a bottom sheet. */
export function HelpTip({ topic, label = "?" }: { topic: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const t = TOPICS.find((x) => x.id === topic);
  if (!t) return null;
  return (
    <>
      <button type="button" aria-label="Help" onClick={() => setOpen(true)} className="inline-flex items-center justify-center rounded-full font-bold" style={{ width: 28, height: 28, background: "var(--brand)", color: "#fff", fontSize: 15 }}>{label}</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,.45)" }} onClick={() => setOpen(false)}>
          <div className="card w-full max-w-lg p-4 space-y-3 rounded-b-none" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold text-lg">{t.q}</p>
            {t.a.map((p, i) => <p key={i} className="text-sm">{p}</p>)}
            <div className="flex gap-2">
              <button className="btn btn-primary flex-1" onClick={() => setOpen(false)}>Got it</button>
              <Link href="/help" className="btn btn-secondary">All help</Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** One plain sentence at the top of each app screen, with a ? for more. */
export function ScreenHint() {
  const path = usePathname();
  const h = hintFor(path || "");
  const [hidden, setHidden] = useState(false);
  if (!h || hidden) return null;
  return (
    <div className="card p-3 text-sm flex items-start gap-2" style={{ borderColor: "var(--brand)", background: "color-mix(in srgb, var(--brand) 8%, var(--surface))" }}>
      <span className="flex-1">{h.text}</span>
      <div className="flex items-center gap-1 shrink-0">
        {h.topic && <HelpTip topic={h.topic} />}
        <button type="button" aria-label="Hide" onClick={() => setHidden(true)} className="muted px-1">×</button>
      </div>
    </div>
  );
}
